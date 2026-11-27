import { Mp3Encoder } from '@breezystack/lamejs';

const SUPPORTED_MP3_RATES = [
  8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000,
];

export interface VideoToMp3Result {
  file: File;
  durationSec: number;
  suggestedTitle: string;
}

export function suggestTitleFromVideoName(filename: string): string {
  const withoutExt = filename.replace(/\.[^/.]+$/, '');
  const cleaned = withoutExt
    .replace(/^\d{1,3}\s*[-._)]\s*/, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || 'Converted Track';
}

function floatToInt16(channel: Float32Array): Int16Array {
  const out = new Int16Array(channel.length);
  for (let i = 0; i < channel.length; i++) {
    const clamped = Math.max(-1, Math.min(1, channel[i]));
    out[i] = clamped < 0 ? Math.round(clamped * 0x8000) : Math.round(clamped * 0x7fff);
  }
  return out;
}

function toArrayBufferCopy(chunk: Uint8Array | Int8Array): ArrayBuffer {
  const copy = new Uint8Array(chunk.length);
  copy.set(chunk);
  return copy.buffer;
}

async function normalizeAudioBufferForMp3(decoded: AudioBuffer): Promise<AudioBuffer> {
  const targetChannels = Math.min(2, Math.max(1, decoded.numberOfChannels));
  const rateSupported = SUPPORTED_MP3_RATES.includes(decoded.sampleRate);

  if (rateSupported && decoded.numberOfChannels <= 2) {
    return decoded;
  }

  const targetRate = rateSupported ? decoded.sampleRate : 44100;
  const targetLength = Math.max(1, Math.ceil(decoded.duration * targetRate));
  const offline = new OfflineAudioContext(targetChannels, targetLength, targetRate);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start(0);
  return offline.startRendering();
}

export async function convertVideoToMp3(
  videoFile: File,
  onProgress?: (percent: number, stage: string) => void
): Promise<VideoToMp3Result> {
  if (typeof window === 'undefined') {
    throw new Error('Konversi video hanya dapat dijalankan di browser.');
  }

  const maxBytes = 250 * 1024 * 1024;
  if (videoFile.size > maxBytes) {
    throw new Error('Ukuran video terlalu besar (maksimal 250 MB untuk konversi di browser).');
  }

  onProgress?.(6, 'Membaca file video...');
  const rawBuffer = await videoFile.arrayBuffer();

  onProgress?.(16, 'Mengekstrak trek audio dari video...');
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioCtx) {
    throw new Error('Browser ini tidak mendukung Web Audio API untuk ekstraksi audio.');
  }

  const ctx = new AudioCtx();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(rawBuffer.slice(0));
  } catch {
    throw new Error(
      'Gagal mengekstrak audio dari video ini. Pastikan video memiliki suara dan berformat MP4, MOV, atau WebM.'
    );
  } finally {
    ctx.close().catch(() => {});
  }

  onProgress?.(28, 'Menyiapkan sample rate audio...');
  const audioBuffer = await normalizeAudioBufferForMp3(decoded);

  const channels = Math.min(2, Math.max(1, audioBuffer.numberOfChannels));
  const sampleRate = audioBuffer.sampleRate;
  const kbps = 192;

  const leftPcm = floatToInt16(audioBuffer.getChannelData(0));
  const rightPcm =
    channels > 1 ? floatToInt16(audioBuffer.getChannelData(1)) : undefined;

  const encoder = new Mp3Encoder(channels, sampleRate, kbps);
  const blockSize = 1152;
  const totalSamples = leftPcm.length;
  const mp3Parts: ArrayBuffer[] = [];

  onProgress?.(32, 'Mengonversi audio ke MP3 (192 kbps)...');

  let blockCounter = 0;
  for (let i = 0; i < totalSamples; i += blockSize) {
    const leftSlice = leftPcm.subarray(i, i + blockSize);
    const encoded =
      channels > 1 && rightPcm
        ? encoder.encodeBuffer(leftSlice, rightPcm.subarray(i, i + blockSize))
        : encoder.encodeBuffer(leftSlice);

    if (encoded.length > 0) {
      mp3Parts.push(toArrayBufferCopy(encoded));
    }

    blockCounter += 1;
    if (blockCounter % 80 === 0) {
      const ratio = i / Math.max(1, totalSamples);
      const pct = Math.min(94, Math.round(32 + ratio * 62));
      onProgress?.(pct, 'Mengonversi audio ke MP3 (192 kbps)...');
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    }
  }

  const tail = encoder.flush();
  if (tail.length > 0) {
    mp3Parts.push(toArrayBufferCopy(tail));
  }

  onProgress?.(98, 'Menyelesaikan file MP3...');
  const suggestedTitle = suggestTitleFromVideoName(videoFile.name);
  const safeBaseName =
    suggestedTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'converted-audio';

  const mp3Blob = new Blob(mp3Parts, { type: 'audio/mpeg' });
  const mp3File = new File([mp3Blob], `${safeBaseName}.mp3`, {
    type: 'audio/mpeg',
  });

  onProgress?.(100, 'Selesai dikonversi ke MP3');

  return {
    file: mp3File,
    durationSec: audioBuffer.duration,
    suggestedTitle,
  };
}