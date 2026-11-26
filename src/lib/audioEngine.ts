import { ClipMode, TrackItem, VinylRecord, WeatherType } from '@/types/orihour';

export interface PlayableAudioSource {
  id: string;
  audioUrl?: string;
  duration?: string;
  clipMode?: ClipMode;
  clipStartSec?: number;
  clipEndSec?: number;
}

/**
 * Formats seconds into MM:SS (e.g., 218 -> "03:38").
 */
export function formatDurationSeconds(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '03:30';
  const rounded = Math.round(totalSeconds);
  const mins = Math.floor(rounded / 60);
  const secs = rounded % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Reads an uploaded local MP3/audio file's duration in seconds in the browser.
 */
export function extractAudioDurationSeconds(file: File): Promise<number | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = 'metadata';

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      audio.removeAttribute('src');
    };

    const timer = window.setTimeout(() => {
      cleanup();
      resolve(null);
    }, 4500);

    audio.onloadedmetadata = () => {
      window.clearTimeout(timer);
      const secs =
        Number.isFinite(audio.duration) && audio.duration > 0
          ? Math.round(audio.duration)
          : null;
      cleanup();
      resolve(secs);
    };

    audio.onerror = () => {
      window.clearTimeout(timer);
      cleanup();
      resolve(null);
    };

    audio.src = objectUrl;
  });
}

/**
 * Reads an uploaded local MP3/audio file's exact duration formatted as MM:SS.
 */
export async function extractAudioDuration(file: File): Promise<string | null> {
  const secs = await extractAudioDurationSeconds(file);
  return secs !== null ? formatDurationSeconds(secs) : null;
}

function parseDurationToSeconds(durationLabel?: string): number {
  if (!durationLabel) return 180;
  const parts = durationLabel.split(':').map((p) => parseInt(p.trim(), 10));
  if (parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
    return Math.max(10, parts[0] * 60 + parts[1]);
  }
  return 180;
}

function resolvePlayWindow(
  source: PlayableAudioSource,
  totalSec: number
): { start: number; end: number; span: number } {
  const safeTotal = Math.max(5, totalSec);
  if (source.clipMode === 'snippet') {
    const rawStart = Math.max(0, Number(source.clipStartSec) || 0);
    const start = Math.min(rawStart, Math.max(0, safeTotal - 3));
    const rawEnd = Number(source.clipEndSec) || start + 30;
    const end = Math.min(safeTotal, Math.max(start + 3, rawEnd));
    return { start, end, span: Math.max(1, end - start) };
  }
  return { start: 0, end: safeTotal, span: safeTotal };
}

class OrihourAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private crackleGain: GainNode | null = null;

  private crackleSource: AudioBufferSourceNode | null = null;
  private rainSource: AudioBufferSourceNode | null = null;
  private rainFilter: BiquadFilterNode | null = null;

  // Real MP3 HTMLAudioElement playback
  private audioEl: HTMLAudioElement | null = null;
  private rafId: number | null = null;
  private activeSource: PlayableAudioSource | null = null;
  private windowStart = 0;
  private windowEnd = 180;
  private windowSpan = 180;

  // Fallback procedural analog chord timer
  private synthTimer: number | null = null;
  private synthProgressTimer: number | null = null;
  private synthChords: number[][] = [];
  private synthStep = 0;
  private synthElapsedSec = 0;
  private synthLastTick = 0;

  private isSoundEnabled = true;
  private isPlayingRecord = false;
  private isPausedRecord = false;
  private currentWeather: WeatherType = 'CLEAR';

  private musicVolume = 0.72;
  private rainVolume = 0.36;
  private crackleVolume = 0.24;

  private activeProgressCb: ((ratio: number) => void) | null = null;
  private activeEndedCb: (() => void) | null = null;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;

      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.rainGain = this.ctx.createGain();
      this.crackleGain = this.ctx.createGain();

      // Strictly initialize all gains to 0 to eliminate initial WebAudio pop ("dor")
      this.masterGain.gain.value = 0;
      this.musicGain.gain.value = 0;
      this.rainGain.gain.value = 0;
      this.crackleGain.gain.value = 0;

      this.musicGain.connect(this.masterGain);
      this.rainGain.connect(this.masterGain);
      this.crackleGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.startAmbientLoops();
      this.applyGains();
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  private startAmbientLoops() {
    if (!this.ctx || !this.crackleGain || !this.rainGain) return;

    const sampleRate = this.ctx.sampleRate;

    // 1. Subtle Vinyl Crackle & Warm Analog Floor Loop (4s seamless buffer)
    const crackleLen = sampleRate * 4;
    const crackleBuf = this.ctx.createBuffer(1, crackleLen, sampleRate);
    const cData = crackleBuf.getChannelData(0);
    for (let i = 0; i < crackleLen; i++) {
      const baseHiss = (Math.random() * 2 - 1) * 0.014;
      const pop = Math.random() > 0.9995 ? (Math.random() * 2 - 1) * 0.34 : 0;
      const dust = Math.random() > 0.9975 ? (Math.random() * 2 - 1) * 0.09 : 0;
      cData[i] = baseHiss + pop + dust;
    }

    const crackleSrc = this.ctx.createBufferSource();
    crackleSrc.buffer = crackleBuf;
    crackleSrc.loop = true;

    const crackleHp = this.ctx.createBiquadFilter();
    crackleHp.type = 'highpass';
    crackleHp.frequency.value = 1150;

    crackleSrc.connect(crackleHp);
    crackleHp.connect(this.crackleGain);
    crackleSrc.start();
    this.crackleSource = crackleSrc;

    // 2. Soft Rain / Breeze Ambience Loop (4s pink-filtered noise)
    const rainLen = sampleRate * 4;
    const rainBuf = this.ctx.createBuffer(1, rainLen, sampleRate);
    const rData = rainBuf.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < rainLen; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.95 * b2 + white * 0.048;
      rData[i] = (b0 + b1 + b2 + white * 0.04) * 0.35;
    }

    const rainSrc = this.ctx.createBufferSource();
    rainSrc.buffer = rainBuf;
    rainSrc.loop = true;

    const rainLp = this.ctx.createBiquadFilter();
    rainLp.type = 'lowpass';
    rainLp.frequency.value = 1450;

    rainSrc.connect(rainLp);
    rainLp.connect(this.rainGain);
    rainSrc.start();
    this.rainSource = rainSrc;
    this.rainFilter = rainLp;
  }

  private applyGains() {
    if (this.audioEl) {
      this.audioEl.volume = this.isSoundEnabled ? Math.max(0, Math.min(1, this.musicVolume)) : 0;
    }

    if (!this.ctx || !this.masterGain || !this.musicGain || !this.rainGain || !this.crackleGain) {
      return;
    }

    const now = this.ctx.currentTime;
    const masterTarget = this.isSoundEnabled ? 1.0 : 0.0;
    this.masterGain.gain.setTargetAtTime(masterTarget, now, 0.08);

    this.musicGain.gain.setTargetAtTime(this.musicVolume * 0.45, now, 0.08);

    const crackleActive =
      this.isPlayingRecord && !this.isPausedRecord ? this.crackleVolume * 0.32 : 0.0;
    this.crackleGain.gain.setTargetAtTime(crackleActive, now, 0.14);

    let weatherMult = 0.0;
    if (this.currentWeather === 'RAIN') {
      weatherMult = 1.0;
      if (this.rainFilter) this.rainFilter.frequency.setTargetAtTime(1550, now, 0.2);
    } else if (this.currentWeather === 'BREEZY') {
      weatherMult = 0.24;
      if (this.rainFilter) this.rainFilter.frequency.setTargetAtTime(520, now, 0.2);
    }
    this.rainGain.gain.setTargetAtTime(this.rainVolume * 0.55 * weatherMult, now, 0.24);
  }

  public unlockAndInit(soundOn: boolean) {
    this.isSoundEnabled = soundOn;
    this.ensureContext();
    this.applyGains();
  }

  public setSoundEnabled(enabled: boolean) {
    this.isSoundEnabled = enabled;
    if (enabled) this.ensureContext();
    this.applyGains();
  }

  public setVolumes(music: number, rain: number, crackle: number) {
    this.musicVolume = Math.max(0, Math.min(1, music));
    this.rainVolume = Math.max(0, Math.min(1, rain));
    this.crackleVolume = Math.max(0, Math.min(1, crackle));
    this.applyGains();
  }

  public syncWeatherAmbience(weather: WeatherType) {
    this.currentWeather = weather;
    this.applyGains();
  }

  public triggerNeedleDrop() {
    if (!this.isSoundEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(102, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.075);

    // Soft tactile thump (gentle level so it never sounds like a loud bang)
    thumpGain.gain.setValueAtTime(0.0001, now);
    thumpGain.gain.linearRampToValueAtTime(0.11 * this.crackleVolume + 0.035, now + 0.015);
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

    osc.connect(thumpGain);
    thumpGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  /**
   * Plays a VinylRecord or a specific TrackItem (supporting full song or partial snippet clip).
   */
  public playRecord(
    vinyl: VinylRecord,
    onProgress?: (ratio: number) => void,
    onEnded?: () => void,
    trackOverride?: TrackItem | null
  ) {
    const source: PlayableAudioSource = trackOverride
      ? {
          id: `${vinyl.id}:${trackOverride.id}`,
          audioUrl: trackOverride.audioUrl || vinyl.audioUrl,
          duration: trackOverride.duration || vinyl.duration,
          clipMode: trackOverride.clipMode ?? vinyl.clipMode ?? 'full',
          clipStartSec: trackOverride.clipStartSec ?? vinyl.clipStartSec ?? 0,
          clipEndSec: trackOverride.clipEndSec ?? vinyl.clipEndSec ?? 30,
        }
      : {
          id: vinyl.id,
          audioUrl: vinyl.audioUrl,
          duration: vinyl.duration,
          clipMode: vinyl.clipMode ?? 'full',
          clipStartSec: vinyl.clipStartSec ?? 0,
          clipEndSec: vinyl.clipEndSec ?? 30,
        };

    this.playSource(source, onProgress, onEnded);
  }

  public playSource(
    source: PlayableAudioSource,
    onProgress?: (ratio: number) => void,
    onEnded?: () => void
  ) {
    this.stopRecord();
    this.ensureContext();

    this.activeSource = source;
    this.isPlayingRecord = true;
    this.isPausedRecord = false;
    this.activeProgressCb = onProgress ?? null;
    this.activeEndedCb = onEnded ?? null;

    const estimatedTotal = parseDurationToSeconds(source.duration);
    const win = resolvePlayWindow(source, estimatedTotal);
    this.windowStart = win.start;
    this.windowEnd = win.end;
    this.windowSpan = win.span;

    this.applyGains();

    const cleanUrl = source.audioUrl?.trim();
    if (cleanUrl) {
      this.playHtmlAudio(cleanUrl, source);
    } else {
      this.playProceduralFallback(source);
    }
  }

  public pauseRecord() {
    if (!this.isPlayingRecord || this.isPausedRecord) return;
    this.isPausedRecord = true;

    if (this.audioEl) {
      this.audioEl.pause();
      if (this.rafId !== null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
    }

    if (this.synthTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.synthTimer);
      this.synthTimer = null;
    }
    if (this.synthProgressTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.synthProgressTimer);
      this.synthProgressTimer = null;
    }

    this.applyGains();
  }

  public resumeRecord(): boolean {
    if (!this.activeSource || !this.isPausedRecord) return false;

    this.ensureContext();
    this.isPausedRecord = false;
    this.isPlayingRecord = true;
    this.applyGains();

    if (this.audioEl) {
      const audio = this.audioEl;
      audio
        .play()
        .then(() => {
          if (this.audioEl === audio && this.isPlayingRecord && !this.isPausedRecord) {
            this.startHtmlAudioTick(audio);
          }
        })
        .catch(() => {});
      return true;
    }

    // Resume procedural fallback from saved synthElapsedSec
    this.startSynthTimers();
    return true;
  }

  public hasPausedSource(sourceId: string): boolean {
    return Boolean(this.isPausedRecord && this.activeSource?.id === sourceId);
  }

  /**
   * Seeks smoothly to any normalized position (0..1) within the active track or snippet window.
   */
  public seekToRatio(ratio: number) {
    const clamped = Math.max(0, Math.min(1, ratio));

    if (this.audioEl) {
      const targetSec = this.windowStart + clamped * this.windowSpan;
      const safeMax = Number.isFinite(this.audioEl.duration)
        ? Math.max(0, this.audioEl.duration - 0.15)
        : this.windowEnd;
      try {
        this.audioEl.currentTime = Math.max(0, Math.min(safeMax, targetSec));
      } catch {
        // Ignore seek errors before metadata loads
      }
    } else if (this.activeSource) {
      this.synthElapsedSec = clamped * this.windowSpan;
      this.synthLastTick = performance.now();
    }

    this.activeProgressCb?.(clamped);
  }

  private startHtmlAudioTick(audio: HTMLAudioElement) {
    if (typeof window === 'undefined') return;
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    const tick = () => {
      if (!this.audioEl || this.audioEl !== audio || !this.isPlayingRecord || this.isPausedRecord) {
        return;
      }

      const cur = audio.currentTime;
      if (this.activeSource?.clipMode === 'snippet' && cur >= this.windowEnd) {
        const endedCb = this.activeEndedCb;
        this.stopRecord();
        endedCb?.();
        return;
      }

      const ratio = Math.max(0, Math.min(1, (cur - this.windowStart) / Math.max(0.5, this.windowSpan)));
      this.activeProgressCb?.(ratio);
      this.rafId = window.requestAnimationFrame(tick);
    };

    this.rafId = window.requestAnimationFrame(tick);
  }

  private playHtmlAudio(url: string, source: PlayableAudioSource) {
    if (typeof window === 'undefined') return;

    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = url;
    audio.volume = this.isSoundEnabled ? Math.max(0, Math.min(1, this.musicVolume)) : 0;
    this.audioEl = audio;

    audio.onloadedmetadata = () => {
      if (this.audioEl !== audio) return;
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        const win = resolvePlayWindow(source, audio.duration);
        this.windowStart = win.start;
        this.windowEnd = win.end;
        this.windowSpan = win.span;
        if (win.start > 0 && audio.currentTime < win.start) {
          try {
            audio.currentTime = win.start;
          } catch {
            // Ignore seek failure
          }
        }
      }
    };

    audio.onended = () => {
      if (this.audioEl !== audio) return;
      const endedCb = this.activeEndedCb;
      this.stopRecord();
      endedCb?.();
    };

    audio.onerror = () => {
      if (this.audioEl !== audio) return;
      this.cleanupHtmlAudio();
      if (this.isPlayingRecord && !this.isPausedRecord) {
        this.playProceduralFallback(source);
      }
    };

    audio
      .play()
      .then(() => {
        if (this.audioEl === audio && this.isPlayingRecord && !this.isPausedRecord) {
          if (this.windowStart > 0 && audio.currentTime < this.windowStart) {
            try {
              audio.currentTime = this.windowStart;
            } catch {
              // Ignore seek failure
            }
          }
          this.startHtmlAudioTick(audio);
        }
      })
      .catch(() => {
        if (this.audioEl === audio && this.isPlayingRecord && !this.isPausedRecord) {
          this.cleanupHtmlAudio();
          this.playProceduralFallback(source);
        }
      });
  }

  private playProceduralFallback(source: PlayableAudioSource) {
    if (typeof window === 'undefined') return;

    this.synthElapsedSec = 0;
    this.synthLastTick = performance.now();

    let seed = 0;
    for (let i = 0; i < source.id.length; i++) {
      seed = (seed * 31 + source.id.charCodeAt(i)) % 997;
    }

    const progressions: number[][][] = [
      [
        [220.0, 261.63, 329.63, 392.0],
        [174.61, 220.0, 261.63, 329.63],
        [196.0, 246.94, 293.66, 349.23],
        [164.81, 196.0, 246.94, 329.63],
      ],
      [
        [261.63, 329.63, 392.0, 493.88],
        [220.0, 261.63, 329.63, 392.0],
        [146.83, 220.0, 261.63, 349.23],
        [196.0, 246.94, 293.66, 392.0],
      ],
      [
        [196.0, 233.08, 293.66, 349.23],
        [155.56, 196.0, 233.08, 293.66],
        [174.61, 220.0, 261.63, 349.23],
        [146.83, 174.61, 220.0, 261.63],
      ],
    ];

    this.synthChords = progressions[seed % progressions.length];
    this.synthStep = 0;
    this.startSynthTimers();
  }

  private startSynthTimers() {
    if (typeof window === 'undefined') return;

    this.synthLastTick = performance.now();

    const triggerChord = () => {
      if (!this.isPlayingRecord || this.isPausedRecord) return;
      const ctx = this.ctx;
      if (!ctx || !this.musicGain || this.synthChords.length === 0) return;

      const now = ctx.currentTime;
      const chord = this.synthChords[this.synthStep % this.synthChords.length];
      this.synthStep++;

      chord.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = idx === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.045);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1150, now);

        gain.gain.setValueAtTime(0.0001, now + idx * 0.045);
        gain.gain.linearRampToValueAtTime(0.11, now + idx * 0.045 + 0.14);
        gain.gain.exponentialRampToValueAtTime(0.0008, now + 3.1);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain!);

        osc.start(now + idx * 0.045);
        osc.stop(now + 3.25);
      });
    };

    triggerChord();
    this.synthTimer = window.setInterval(triggerChord, 3200);

    this.synthProgressTimer = window.setInterval(() => {
      if (!this.isPlayingRecord || this.isPausedRecord) return;
      const now = performance.now();
      this.synthElapsedSec += (now - this.synthLastTick) / 1000;
      this.synthLastTick = now;

      const ratio = Math.min(1, this.synthElapsedSec / Math.max(1, this.windowSpan));
      this.activeProgressCb?.(ratio);

      if (ratio >= 1) {
        const endedCb = this.activeEndedCb;
        this.stopRecord();
        endedCb?.();
      }
    }, 180);
  }

  private cleanupHtmlAudio() {
    if (this.rafId !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.audioEl) {
      this.audioEl.onloadedmetadata = null;
      this.audioEl.onended = null;
      this.audioEl.onerror = null;
      this.audioEl.pause();
      this.audioEl.removeAttribute('src');
      this.audioEl.load();
      this.audioEl = null;
    }
  }

  public stopRecord() {
    this.isPlayingRecord = false;
    this.isPausedRecord = false;
    this.activeSource = null;
    this.cleanupHtmlAudio();

    if (this.synthTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.synthTimer);
      this.synthTimer = null;
    }
    if (this.synthProgressTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.synthProgressTimer);
      this.synthProgressTimer = null;
    }

    this.activeProgressCb = null;
    this.activeEndedCb = null;
    this.applyGains();
  }
}

export const audioEngine = new OrihourAudioEngine();