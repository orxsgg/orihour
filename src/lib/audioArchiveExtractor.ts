export interface ExtractedAudioTrackFile {
  file: File;
  suggestedTitle: string;
  sourceName: string;
}

const AUDIO_EXTENSIONS = new Set(['mp3', 'm4a', 'wav', 'ogg', 'flac', 'aac', 'webm']);

function getFileExtension(name: string): string {
  const clean = name.split('/').pop()?.split('\\').pop() || '';
  const dot = clean.lastIndexOf('.');
  if (dot <= 0) return '';
  return clean.slice(dot + 1).toLowerCase();
}

function getMimeForExtension(ext: string): string {
  switch (ext) {
    case 'mp3':
      return 'audio/mpeg';
    case 'm4a':
    case 'aac':
      return 'audio/mp4';
    case 'wav':
      return 'audio/wav';
    case 'ogg':
      return 'audio/ogg';
    case 'flac':
      return 'audio/flac';
    case 'webm':
      return 'audio/webm';
    default:
      return 'audio/mpeg';
  }
}

export function isSupportedAudioFilename(name: string): boolean {
  const base = name.split('/').pop()?.split('\\').pop() || '';
  if (!base || base.startsWith('.') || base.startsWith('._')) return false;
  if (name.includes('__MACOSX/')) return false;
  return AUDIO_EXTENSIONS.has(getFileExtension(base));
}

export function parseSongTitleFromFilename(rawFilename: string): string {
  const base = rawFilename.split('/').pop()?.split('\\').pop() || rawFilename;
  const withoutExt = base.replace(/\.[^.]+$/, '');

  // Strip common leading track numbers like "01 - ", "01. ", "(01) ", "Track 01 - ", "1-02 "
  let cleaned = withoutExt
    .replace(/^(?:cd\s*\d+\s*[-_.]?\s*)?(?:track\s*)?(?:\[\d{1,3}\]|\(\d{1,3}\)|\d{1,2}[-.]\d{1,2}|\d{1,3})\s*[-._)\]]+\s*/i, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    cleaned = withoutExt.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  }

  return cleaned || 'Untitled Track';
}

function sortNaturally(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

async function inflateRawBytes(compressed: Uint8Array): Promise<ArrayBuffer> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error(
      'Browser ini belum mendukung ekstraksi ZIP otomatis. Gunakan upload folder atau pilih beberapa file audio sekaligus.'
    );
  }
  const safeBuf = new ArrayBuffer(compressed.byteLength);
  new Uint8Array(safeBuf).set(compressed);

  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  const writePromise = writer.write(new Uint8Array(safeBuf)).then(() => writer.close());
  const readPromise = new Response(ds.readable).arrayBuffer();
  await writePromise;
  return readPromise;
}

export async function extractAudioFilesFromZip(
  zipFile: File
): Promise<ExtractedAudioTrackFile[]> {
  const buffer = await zipFile.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  // Locate End of Central Directory (EOCD) signature 0x06054b50 from end of file
  const minOffset = Math.max(0, bytes.length - 65557);
  let eocdOffset = -1;
  for (let i = bytes.length - 22; i >= minOffset; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset < 0) {
    throw new Error('File ZIP tidak valid atau rusak.');
  }

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const cdOffset = view.getUint32(eocdOffset + 16, true);
  const decoder = new TextDecoder('utf-8');

  const rawEntries: {
    name: string;
    method: number;
    compSize: number;
    localHeaderOffset: number;
  }[] = [];

  let ptr = cdOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (ptr + 46 > bytes.length || view.getUint32(ptr, true) !== 0x02014b50) {
      break;
    }
    const method = view.getUint16(ptr + 10, true);
    const compSize = view.getUint32(ptr + 20, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localHeaderOffset = view.getUint32(ptr + 42, true);

    const nameBytes = bytes.subarray(ptr + 46, ptr + 46 + nameLen);
    const entryName = decoder.decode(nameBytes);

    if (!entryName.endsWith('/') && isSupportedAudioFilename(entryName)) {
      rawEntries.push({
        name: entryName,
        method,
        compSize,
        localHeaderOffset,
      });
    }

    ptr += 46 + nameLen + extraLen + commentLen;
  }

  rawEntries.sort((a, b) => sortNaturally(a.name, b.name));

  const extracted: ExtractedAudioTrackFile[] = [];

  for (const entry of rawEntries) {
    const lh = entry.localHeaderOffset;
    if (lh + 30 > bytes.length || view.getUint32(lh, true) !== 0x04034b50) {
      continue;
    }

    const localNameLen = view.getUint16(lh + 26, true);
    const localExtraLen = view.getUint16(lh + 28, true);
    const dataStart = lh + 30 + localNameLen + localExtraLen;
    const dataEnd = dataStart + entry.compSize;
    if (dataEnd > bytes.length) continue;

    const compressedSlice = bytes.subarray(dataStart, dataEnd);
    let outputBuffer: ArrayBuffer;

    if (entry.method === 0) {
      outputBuffer = new ArrayBuffer(compressedSlice.byteLength);
      new Uint8Array(outputBuffer).set(compressedSlice);
    } else if (entry.method === 8) {
      outputBuffer = await inflateRawBytes(compressedSlice);
    } else {
      continue;
    }

    const baseName = entry.name.split('/').pop()?.split('\\').pop() || 'track.mp3';
    const ext = getFileExtension(baseName) || 'mp3';
    const file = new File([outputBuffer], baseName, {
      type: getMimeForExtension(ext),
    });

    extracted.push({
      file,
      suggestedTitle: parseSongTitleFromFilename(baseName),
      sourceName: entry.name,
    });
  }

  return extracted;
}

export async function collectAudioFilesFromSelection(
  fileList: FileList | File[]
): Promise<ExtractedAudioTrackFile[]> {
  const items = Array.from(fileList);
  const results: ExtractedAudioTrackFile[] = [];

  for (const file of items) {
    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith('.zip') || file.type === 'application/zip') {
      const fromZip = await extractAudioFilesFromZip(file);
      results.push(...fromZip);
    } else if (isSupportedAudioFilename(file.webkitRelativePath || file.name)) {
      const rel = file.webkitRelativePath || file.name;
      results.push({
        file,
        suggestedTitle: parseSongTitleFromFilename(file.name),
        sourceName: rel,
      });
    }
  }

  results.sort((a, b) => sortNaturally(a.sourceName, b.sourceName));
  return results;
}