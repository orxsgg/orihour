export type AudioEnhancePreset = 'none' | 'studio' | 'vocal' | 'warm' | 'loud';

export interface AudioEnhancePresetInfo {
  id: AudioEnhancePreset;
  label: string;
  shortLabel: string;
  description: string;
}

export const AUDIO_ENHANCE_PRESETS: AudioEnhancePresetInfo[] = [
  {
    id: 'none',
    label: 'Original (Off)',
    shortLabel: 'Off',
    description: 'Putar audio asli tanpa pemrosesan tambahan.',
  },
  {
    id: 'studio',
    label: 'Studio Clarity',
    shortLabel: 'Studio',
    description: 'Bersihkan rumble bass, hilangkan suara mendem, dan angkat detail instrumen.',
  },
  {
    id: 'vocal',
    label: 'Vocal & Live Boost',
    shortLabel: 'Vocal/Live',
    description: 'Khusus rekaman live, cover, atau rekaman tipis agar vokal jernih dan menonjol.',
  },
  {
    id: 'warm',
    label: 'Warm Vinyl Master',
    shortLabel: 'Warm Vinyl',
    description: 'Tambah kehangatan low-end, haluskan nada tajam, dan ratakan dinamika.',
  },
  {
    id: 'loud',
    label: 'Clean Loudness',
    shortLabel: 'Loudness',
    description: 'Angkat volume audio yang pelan dengan kompresor lembut anti-clipping.',
  },
];

interface DspParams {
  hpFreq: number;
  lowGain: number;
  midFreq: number;
  midGain: number;
  midQ: number;
  presenceFreq: number;
  presenceGain: number;
  airGain: number;
  compThreshold: number;
  compRatio: number;
  compKnee: number;
  makeupGain: number;
}

const PRESET_DSP: Record<AudioEnhancePreset, DspParams> = {
  none: {
    hpFreq: 20,
    lowGain: 0,
    midFreq: 350,
    midGain: 0,
    midQ: 1.0,
    presenceFreq: 3000,
    presenceGain: 0,
    airGain: 0,
    compThreshold: 0,
    compRatio: 1,
    compKnee: 0,
    makeupGain: 1.0,
  },
  studio: {
    hpFreq: 48,
    lowGain: 2.2,
    midFreq: 360,
    midGain: -2.0,
    midQ: 1.15,
    presenceFreq: 3200,
    presenceGain: 2.8,
    airGain: 2.6,
    compThreshold: -18,
    compRatio: 3.2,
    compKnee: 16,
    makeupGain: 1.18,
  },
  vocal: {
    hpFreq: 68,
    lowGain: 1.0,
    midFreq: 310,
    midGain: -3.2,
    midQ: 1.2,
    presenceFreq: 2800,
    presenceGain: 4.2,
    airGain: 3.2,
    compThreshold: -21,
    compRatio: 4.0,
    compKnee: 18,
    makeupGain: 1.26,
  },
  warm: {
    hpFreq: 38,
    lowGain: 3.6,
    midFreq: 420,
    midGain: -1.2,
    midQ: 1.0,
    presenceFreq: 2600,
    presenceGain: 1.4,
    airGain: 1.2,
    compThreshold: -17,
    compRatio: 2.8,
    compKnee: 20,
    makeupGain: 1.14,
  },
  loud: {
    hpFreq: 52,
    lowGain: 1.8,
    midFreq: 350,
    midGain: -1.5,
    midQ: 1.0,
    presenceFreq: 3400,
    presenceGain: 2.0,
    airGain: 2.0,
    compThreshold: -24,
    compRatio: 5.0,
    compKnee: 14,
    makeupGain: 1.38,
  },
};

const VALID_PRESETS = new Set<AudioEnhancePreset>([
  'none',
  'studio',
  'vocal',
  'warm',
  'loud',
]);

export function parseAudioEnhancePreset(url?: string | null): AudioEnhancePreset {
  if (!url) return 'none';
  const hashIdx = url.indexOf('#');
  if (hashIdx < 0) return 'none';
  const hash = url.slice(hashIdx + 1);
  const match = hash.match(/(?:^|&)enhance=([a-z]+)/i);
  const value = (match?.[1] || '').toLowerCase() as AudioEnhancePreset;
  return VALID_PRESETS.has(value) ? value : 'none';
}

export function stripAudioEnhancePreset(url?: string | null): string {
  if (!url) return '';
  const hashIdx = url.indexOf('#');
  return hashIdx < 0 ? url : url.slice(0, hashIdx);
}

export function applyAudioEnhancePreset(
  url: string,
  preset: AudioEnhancePreset
): string {
  const base = stripAudioEnhancePreset(url).trim();
  if (!base) return '';
  if (preset === 'none') return base;
  return `${base}#enhance=${preset}`;
}

interface AttachedEnhancerChain {
  ctx: AudioContext;
  hp: BiquadFilterNode;
  lowShelf: BiquadFilterNode;
  midCut: BiquadFilterNode;
  presence: BiquadFilterNode;
  air: BiquadFilterNode;
  comp: DynamicsCompressorNode;
  outGain: GainNode;
}

const elementChainMap = new WeakMap<HTMLAudioElement, AttachedEnhancerChain>();

function applyParamsToChain(chain: AttachedEnhancerChain, preset: AudioEnhancePreset) {
  const p = PRESET_DSP[preset] || PRESET_DSP.none;
  const now = chain.ctx.currentTime;
  const tc = 0.03;

  chain.hp.frequency.setTargetAtTime(p.hpFreq, now, tc);
  chain.lowShelf.gain.setTargetAtTime(p.lowGain, now, tc);
  chain.midCut.frequency.setTargetAtTime(p.midFreq, now, tc);
  chain.midCut.gain.setTargetAtTime(p.midGain, now, tc);
  chain.midCut.Q.setTargetAtTime(p.midQ, now, tc);
  chain.presence.frequency.setTargetAtTime(p.presenceFreq, now, tc);
  chain.presence.gain.setTargetAtTime(p.presenceGain, now, tc);
  chain.air.gain.setTargetAtTime(p.airGain, now, tc);

  chain.comp.threshold.setTargetAtTime(p.compThreshold, now, tc);
  chain.comp.ratio.setTargetAtTime(p.compRatio, now, tc);
  chain.comp.knee.setTargetAtTime(p.compKnee, now, tc);
  chain.comp.attack.setTargetAtTime(0.006, now, tc);
  chain.comp.release.setTargetAtTime(0.18, now, tc);

  chain.outGain.gain.setTargetAtTime(p.makeupGain, now, tc);
}

export function connectRealtimeAudioEnhancer(
  ctx: AudioContext,
  audioEl: HTMLAudioElement,
  preset: AudioEnhancePreset,
  destination?: AudioNode
): { setPreset: (next: AudioEnhancePreset) => void } | null {
  try {
    let chain = elementChainMap.get(audioEl);
    if (!chain) {
      const source = ctx.createMediaElementSource(audioEl);

      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.Q.value = 0.7;

      const lowShelf = ctx.createBiquadFilter();
      lowShelf.type = 'lowshelf';
      lowShelf.frequency.value = 115;

      const midCut = ctx.createBiquadFilter();
      midCut.type = 'peaking';

      const presence = ctx.createBiquadFilter();
      presence.type = 'peaking';
      presence.Q.value = 0.9;

      const air = ctx.createBiquadFilter();
      air.type = 'highshelf';
      air.frequency.value = 9500;

      const comp = ctx.createDynamicsCompressor();
      const outGain = ctx.createGain();

      source.connect(hp);
      hp.connect(lowShelf);
      lowShelf.connect(midCut);
      midCut.connect(presence);
      presence.connect(air);
      air.connect(comp);
      comp.connect(outGain);
      outGain.connect(destination || ctx.destination);

      chain = { ctx, hp, lowShelf, midCut, presence, air, comp, outGain };
      elementChainMap.set(audioEl, chain);
    }

    applyParamsToChain(chain, preset);

    return {
      setPreset: (next: AudioEnhancePreset) => {
        if (chain) applyParamsToChain(chain, next);
      },
    };
  } catch {
    return null;
  }
}