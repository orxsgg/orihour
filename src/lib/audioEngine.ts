import { TrackItem, VinylRecord, WeatherType } from '@/types/orihour';
import {
  connectRealtimeAudioEnhancer,
  parseAudioEnhancePreset,
  stripAudioEnhancePreset,
} from '@/lib/audioEnhancer';

export function formatDurationSeconds(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export async function extractAudioDurationSeconds(file: File): Promise<number | null> {
  if (typeof window === 'undefined') return null;

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const audio = document.createElement('audio');
    audio.preload = 'metadata';

    let settled = false;
    const finish = (value: number | null) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(objectUrl);
      audio.src = '';
      resolve(value);
    };

    const timeout = window.setTimeout(() => finish(null), 5000);

    audio.onloadedmetadata = () => {
      window.clearTimeout(timeout);
      const dur = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : null;
      finish(dur);
    };

    audio.onerror = () => {
      window.clearTimeout(timeout);
      finish(null);
    };

    audio.src = objectUrl;
  });
}

function createNoiseBuffer(
  ctx: AudioContext,
  durationSec: number,
  mode: 'rain' | 'crackle'
): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * durationSec);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  if (mode === 'rain') {
    let lastOut = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.03 * white) / 1.03;
      data[i] = lastOut * 2.4;
    }
  } else {
    for (let i = 0; i < length; i++) {
      const r = Math.random();
      if (r > 0.9985) {
        data[i] = (Math.random() * 2 - 1) * 0.72;
      } else if (r > 0.992) {
        data[i] = (Math.random() * 2 - 1) * 0.16;
      } else {
        data[i] = (Math.random() * 2 - 1) * 0.012;
      }
    }
  }

  return buffer;
}

class OrihourAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private crackleGain: GainNode | null = null;
  private rainSource: AudioBufferSourceNode | null = null;
  private crackleSource: AudioBufferSourceNode | null = null;

  private soundEnabled = true;
  private musicVol = 0.78;
  private rainVol = 0.35;
  private crackleVol = 0.22;
  private currentWeather: WeatherType = 'CLEAR';

  private audioEl: HTMLAudioElement | null = null;
  private audioElRoutedToWebAudio = false;
  private currentSourceKey: string | null = null;
  private isPausedState = false;

  private clipMode: 'full' | 'snippet' = 'full';
  private clipStartSec = 0;
  private clipEndSec = 30;
  private progressRaf: number | null = null;
  private onProgressCb: ((ratio: number) => void) | null = null;
  private onEndedCb: (() => void) | null = null;

  // Procedural analog fallback when a vinyl has no uploaded MP3
  private synthActive = false;
  private synthInterval: number | null = null;
  private synthStepIndex = 0;
  private synthStartedAtMs = 0;
  private synthPausedOffsetSec = 0;
  private synthTotalSec = 42;
  private synthVinyl: VinylRecord | null = null;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;

      const ctx = new AudioCtx();
      const master = ctx.createGain();
      const music = ctx.createGain();
      const rain = ctx.createGain();
      const crackle = ctx.createGain();

      master.gain.value = this.soundEnabled ? 1 : 0;
      music.gain.value = this.musicVol;
      rain.gain.value = 0;
      crackle.gain.value = this.crackleVol * 0.14;

      music.connect(master);
      rain.connect(master);
      crackle.connect(master);
      master.connect(ctx.destination);

      this.ctx = ctx;
      this.masterGain = master;
      this.musicGain = music;
      this.rainGain = rain;
      this.crackleGain = crackle;

      this.startAmbientLoops();
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  private startAmbientLoops() {
    if (!this.ctx || !this.rainGain || !this.crackleGain) return;

    try {
      if (!this.rainSource) {
        const rainBuf = createNoiseBuffer(this.ctx, 4.0, 'rain');
        const src = this.ctx.createBufferSource();
        src.buffer = rainBuf;
        src.loop = true;

        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 1150;

        src.connect(lp);
        lp.connect(this.rainGain);
        src.start();
        this.rainSource = src;
      }

      if (!this.crackleSource) {
        const crackleBuf = createNoiseBuffer(this.ctx, 3.5, 'crackle');
        const src = this.ctx.createBufferSource();
        src.buffer = crackleBuf;
        src.loop = true;

        const hp = this.ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 1800;

        src.connect(hp);
        hp.connect(this.crackleGain);
        src.start();
        this.crackleSource = src;
      }
    } catch {
      // Ignore autoplay restrictions until user gesture
    }
  }

  public unlockAndInit(withSound = true) {
    this.soundEnabled = withSound;
    this.ensureContext();
    this.applyGainTargets();
  }

  public setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
    this.applyGainTargets();
  }

  public setVolumes(music: number, rain: number, crackle: number) {
    this.musicVol = Math.max(0, Math.min(1, music));
    this.rainVol = Math.max(0, Math.min(1, rain));
    this.crackleVol = Math.max(0, Math.min(1, crackle));
    this.applyGainTargets();
  }

  public syncWeatherAmbience(weather: WeatherType) {
    this.currentWeather = weather;
    this.applyGainTargets();
  }

  private applyGainTargets() {
    if (this.ctx && this.masterGain && this.musicGain && this.rainGain && this.crackleGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.setTargetAtTime(this.soundEnabled ? 1 : 0, now, 0.06);
      this.musicGain.gain.setTargetAtTime(this.musicVol, now, 0.05);

      const weatherRainFactor =
        this.currentWeather === 'RAIN'
          ? 0.42
          : this.currentWeather === 'BREEZY'
          ? 0.12
          : this.currentWeather === 'CLOUDY'
          ? 0.04
          : 0;
      this.rainGain.gain.setTargetAtTime(this.rainVol * weatherRainFactor, now, 0.25);

      const isRecordSpinning =
        (Boolean(this.audioEl) && !this.isPausedState) || this.synthActive;
      const crackleScale = isRecordSpinning ? 0.24 : 0.05;
      this.crackleGain.gain.setTargetAtTime(this.crackleVol * crackleScale, now, 0.15);
    }

    if (this.audioEl && !this.audioElRoutedToWebAudio) {
      this.audioEl.volume = this.soundEnabled ? this.musicVol : 0;
    }
  }

  public triggerNeedleDrop() {
    if (!this.soundEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.09);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.14, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.12);
    } catch {
      // Ignore if context is locked
    }
  }

  private clearProgressLoop() {
    if (this.progressRaf !== null) {
      window.cancelAnimationFrame(this.progressRaf);
      this.progressRaf = null;
    }
  }

  private stopSynthLoop() {
    if (this.synthInterval !== null) {
      window.clearInterval(this.synthInterval);
      this.synthInterval = null;
    }
    this.synthActive = false;
  }

  private teardownAudioElement() {
    if (this.audioEl) {
      this.audioEl.onended = null;
      this.audioEl.onerror = null;
      this.audioEl.onloadedmetadata = null;
      try {
        this.audioEl.pause();
        this.audioEl.src = '';
      } catch {
        // Ignore cleanup errors
      }
      this.audioEl = null;
      this.audioElRoutedToWebAudio = false;
    }
  }

  public stopRecord() {
    this.clearProgressLoop();
    this.stopSynthLoop();
    this.teardownAudioElement();
    this.currentSourceKey = null;
    this.isPausedState = false;
    this.synthPausedOffsetSec = 0;
    this.onProgressCb = null;
    this.onEndedCb = null;
    this.applyGainTargets();
  }

  public hasPausedSource(sourceKey: string): boolean {
    return (
      this.isPausedState &&
      this.currentSourceKey === sourceKey &&
      (Boolean(this.audioEl) || Boolean(this.synthVinyl))
    );
  }

  public pauseRecord() {
    this.clearProgressLoop();
    this.isPausedState = true;

    if (this.audioEl) {
      try {
        this.audioEl.pause();
      } catch {
        // Ignore
      }
    }

    if (this.synthActive) {
      const elapsed = (performance.now() - this.synthStartedAtMs) / 1000;
      this.synthPausedOffsetSec = Math.min(this.synthTotalSec, elapsed);
      this.stopSynthLoop();
    }

    this.applyGainTargets();
  }

  public resumeRecord(): boolean {
    if (!this.isPausedState) return false;
    this.ensureContext();

    if (this.audioEl) {
      this.isPausedState = false;
      this.audioEl.play().catch(() => {});
      this.startHtmlAudioProgressLoop();
      this.applyGainTargets();
      return true;
    }

    if (this.synthVinyl) {
      this.isPausedState = false;
      this.startProceduralSynth(this.synthVinyl, this.synthPausedOffsetSec);
      this.applyGainTargets();
      return true;
    }

    return false;
  }

  public seekToRatio(ratio: number) {
    const clamped = Math.max(0, Math.min(1, ratio));

    if (this.audioEl) {
      const totalDur =
        Number.isFinite(this.audioEl.duration) && this.audioEl.duration > 0
          ? this.audioEl.duration
          : this.clipEndSec;

      if (this.clipMode === 'snippet') {
        const start = Math.max(0, this.clipStartSec);
        const end = Math.min(totalDur || this.clipEndSec, Math.max(start + 5, this.clipEndSec));
        const target = start + clamped * (end - start);
        try {
          this.audioEl.currentTime = target;
        } catch {
          // Ignore seek before metadata loaded
        }
      } else if (totalDur > 0) {
        try {
          this.audioEl.currentTime = clamped * totalDur;
        } catch {
          // Ignore
        }
      }
      this.onProgressCb?.(clamped);
      return;
    }

    if (this.synthVinyl) {
      const newSec = clamped * this.synthTotalSec;
      this.synthPausedOffsetSec = newSec;
      this.synthStartedAtMs = performance.now() - newSec * 1000;
      this.onProgressCb?.(clamped);
    }
  }

  public playRecord(
    vinyl: VinylRecord,
    onProgress: (ratio: number) => void,
    onEnded: () => void,
    track?: TrackItem | null
  ) {
    this.stopRecord();
    const ctx = this.ensureContext();

    this.currentSourceKey = track ? `${vinyl.id}:${track.id}` : vinyl.id;
    this.isPausedState = false;
    this.onProgressCb = onProgress;
    this.onEndedCb = onEnded;

    const rawAudioUrl = (track?.audioUrl || vinyl.audioUrl || '').trim();
    const clipMode = track?.clipMode || vinyl.clipMode || 'full';
    const clipStartSec = Math.max(0, track?.clipStartSec ?? vinyl.clipStartSec ?? 0);
    const clipEndSec = Math.max(
      clipStartSec + 5,
      track?.clipEndSec ?? vinyl.clipEndSec ?? 30
    );

    this.clipMode = clipMode;
    this.clipStartSec = clipStartSec;
    this.clipEndSec = clipEndSec;

    if (rawAudioUrl) {
      this.startHtmlAudio(rawAudioUrl, vinyl, ctx, false);
    } else {
      this.synthVinyl = vinyl;
      this.startProceduralSynth(vinyl, 0);
    }

    this.applyGainTargets();
  }

  private startHtmlAudio(
    rawAudioUrl: string,
    vinyl: VinylRecord,
    ctx: AudioContext | null,
    bypassCorsEnhancer: boolean
  ) {
    this.teardownAudioElement();

    const preset = bypassCorsEnhancer ? 'none' : parseAudioEnhancePreset(rawAudioUrl);
    const cleanUrl = stripAudioEnhancePreset(rawAudioUrl);

    const audio = new Audio();
    audio.preload = 'auto';

    let routed = false;
    if (preset !== 'none' && ctx && this.musicGain) {
      audio.crossOrigin = 'anonymous';
      const connected = connectRealtimeAudioEnhancer(ctx, audio, preset, this.musicGain);
      if (connected) {
        routed = true;
      }
    }

    audio.src = cleanUrl;
    audio.volume = routed ? 1 : this.soundEnabled ? this.musicVol : 0;

    this.audioEl = audio;
    this.audioElRoutedToWebAudio = routed;

    const seekInitialSnippet = () => {
      if (this.clipMode === 'snippet' && this.clipStartSec > 0) {
        try {
          audio.currentTime = this.clipStartSec;
        } catch {
          // Ignore
        }
      }
    };

    audio.onloadedmetadata = seekInitialSnippet;

    audio.onended = () => {
      if (this.audioEl !== audio) return;
      this.clearProgressLoop();
      this.isPausedState = false;
      this.onProgressCb?.(0);
      const cb = this.onEndedCb;
      this.teardownAudioElement();
      this.applyGainTargets();
      cb?.();
    };

    audio.onerror = () => {
      if (this.audioEl !== audio) return;
      // If CORS prevented Web Audio mastering on an external host, retry direct playback
      if (!bypassCorsEnhancer && routed) {
        this.startHtmlAudio(rawAudioUrl, vinyl, ctx, true);
        return;
      }
      // Final fallback to warm analog chord synthesis
      this.teardownAudioElement();
      this.synthVinyl = vinyl;
      this.startProceduralSynth(vinyl, 0);
    };

    seekInitialSnippet();
    audio
      .play()
      .then(() => {
        if (this.audioEl === audio) {
          this.startHtmlAudioProgressLoop();
          this.applyGainTargets();
        }
      })
      .catch(() => {
        // Autoplay may wait for next gesture
      });
  }

  private startHtmlAudioProgressLoop() {
    this.clearProgressLoop();

    const tick = () => {
      const audio = this.audioEl;
      if (!audio || this.isPausedState) return;

      const cur = audio.currentTime || 0;
      const dur = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;

      if (this.clipMode === 'snippet') {
        const start = Math.max(0, this.clipStartSec);
        const end = dur > 0 ? Math.min(dur, Math.max(start + 5, this.clipEndSec)) : Math.max(start + 5, this.clipEndSec);
        const span = Math.max(1, end - start);

        if (cur >= end) {
          audio.pause();
          this.clearProgressLoop();
          this.isPausedState = false;
          this.onProgressCb?.(0);
          const cb = this.onEndedCb;
          this.teardownAudioElement();
          this.applyGainTargets();
          cb?.();
          return;
        }

        const ratio = Math.max(0, Math.min(1, (cur - start) / span));
        this.onProgressCb?.(ratio);
      } else if (dur > 0) {
        const ratio = Math.max(0, Math.min(1, cur / dur));
        this.onProgressCb?.(ratio);
      }

      this.progressRaf = window.requestAnimationFrame(tick);
    };

    this.progressRaf = window.requestAnimationFrame(tick);
  }

  private startProceduralSynth(vinyl: VinylRecord, offsetSec: number) {
    this.stopSynthLoop();
    const ctx = this.ensureContext();
    this.synthVinyl = vinyl;
    this.synthActive = true;
    this.synthTotalSec = 42;
    this.synthStartedAtMs = performance.now() - offsetSec * 1000;

    const chordSets: number[][] = [
      [220.0, 261.63, 329.63, 392.0], // Am7
      [174.61, 220.0, 261.63, 329.63], // Fmaj7
      [196.0, 246.94, 293.66, 392.0], // G6
      [164.81, 196.0, 246.94, 293.66], // Em7
    ];

    const seedOffset = (vinyl.artStyle || 0) % chordSets.length;
    this.synthStepIndex = Math.floor(offsetSec / 2.6) % chordSets.length;

    const triggerChord = () => {
      if (!ctx || !this.musicGain || !this.synthActive) return;
      const chord = chordSets[(this.synthStepIndex + seedOffset) % chordSets.length];
      this.synthStepIndex = (this.synthStepIndex + 1) % chordSets.length;

      const now = ctx.currentTime;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 920;

      const chordGain = ctx.createGain();
      chordGain.gain.setValueAtTime(0.0001, now);
      chordGain.gain.linearRampToValueAtTime(0.065, now + 0.35);
      chordGain.gain.exponentialRampToValueAtTime(0.0008, now + 2.5);

      lp.connect(chordGain);
      chordGain.connect(this.musicGain);

      chord.forEach((freq) => {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        osc.connect(lp);
        osc.start(now);
        osc.stop(now + 2.55);
      });
    };

    triggerChord();
    this.synthInterval = window.setInterval(triggerChord, 2600);

    const tick = () => {
      if (!this.synthActive || this.isPausedState) return;
      const elapsed = (performance.now() - this.synthStartedAtMs) / 1000;
      if (elapsed >= this.synthTotalSec) {
        this.stopSynthLoop();
        this.clearProgressLoop();
        this.onProgressCb?.(0);
        const cb = this.onEndedCb;
        this.synthVinyl = null;
        this.applyGainTargets();
        cb?.();
        return;
      }
      this.onProgressCb?.(Math.max(0, Math.min(1, elapsed / this.synthTotalSec)));
      this.progressRaf = window.requestAnimationFrame(tick);
    };

    this.progressRaf = window.requestAnimationFrame(tick);
  }
}

export const audioEngine = new OrihourAudioEngine();