import { GuestbookPostcard, VinylRecord } from '@/types/orihour';

const ACRONYMS: Record<string, string> = {
  'r&b': 'R&B',
  rnb: 'R&B',
  edm: 'EDM',
  'lo-fi': 'Lo-Fi',
  lofi: 'Lo-Fi',
  'k-pop': 'K-Pop',
  'j-pop': 'J-Pop',
  'hip-hop': 'Hip-Hop',
  'hip hop': 'Hip-Hop',
  'post-rock': 'Post-Rock',
  'post-punk': 'Post-Punk',
  'synth-pop': 'Synth-Pop',
  'dream-pop': 'Dream Pop',
  'indie-pop': 'Indie Pop',
  'indie-rock': 'Indie Rock',
  'alt-rock': 'Alt-Rock',
  'neo-soul': 'Neo-Soul',
};

export function normalizeSingleGenre(raw: string): string {
  const cleaned = (raw || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';

  const lower = cleaned.toLowerCase();
  if (ACRONYMS[lower]) return ACRONYMS[lower];

  return cleaned
    .split(' ')
    .map((word) => {
      const wLower = word.toLowerCase();
      if (ACRONYMS[wLower]) return ACRONYMS[wLower];
      return word
        .split('-')
        .map((seg) =>
          seg ? seg.charAt(0).toUpperCase() + seg.slice(1).toLowerCase() : ''
        )
        .join('-');
    })
    .join(' ');
}

export function parseGenres(raw?: string | null): string[] {
  if (!raw) return [];
  const parts = raw
    .split(/[,;/]+/)
    .map((p) => normalizeSingleGenre(p))
    .filter(Boolean);

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const p of parts) {
    const key = p.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(p);
    }
  }
  return unique;
}

export function formatGenres(list: string[]): string {
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const item of list) {
    for (const token of parseGenres(item)) {
      const key = token.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        clean.push(token);
      }
    }
  }
  return clean.join(', ');
}

export function normalizeGenre(raw: string, existingGenres?: string[]): string {
  const parsed = parseGenres(raw);
  if (parsed.length === 0) return 'Indie';

  if (existingGenres && existingGenres.length > 0) {
    const existingLookup = new Map<string, string>();
    for (const g of existingGenres) {
      const clean = g.trim();
      if (clean && !existingLookup.has(clean.toLowerCase())) {
        existingLookup.set(clean.toLowerCase(), clean);
      }
    }

    return parsed
      .map((item) => existingLookup.get(item.toLowerCase()) || item)
      .join(', ');
  }

  return parsed.join(', ');
}

export function extractUniqueGenres(vinyls: VinylRecord[]): string[] {
  const map = new Map<string, string>();
  for (const v of vinyls) {
    for (const g of parseGenres(v.genre || v.mood)) {
      const key = g.toLowerCase();
      if (!map.has(key)) {
        map.set(key, g);
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
}

export function vinylMatchesGenre(
  vinyl: Pick<VinylRecord, 'genre' | 'mood'>,
  selectedGenre: string
): boolean {
  const target = selectedGenre.trim().toLowerCase();
  if (!target || target === 'all') return true;
  const list = parseGenres(vinyl.genre || vinyl.mood);
  return list.some((g) => g.toLowerCase() === target);
}

export function hasMultipleTracks(
  vinyl: Pick<VinylRecord, 'releaseType' | 'tracks'>
): boolean {
  if (vinyl.releaseType === 'Song') return false;
  return Array.isArray(vinyl.tracks) && vinyl.tracks.length > 1;
}

export function isSingleSongRelease(
  vinyl: Pick<VinylRecord, 'releaseType' | 'tracks'>
): boolean {
  if (vinyl.releaseType === 'Song') return true;
  if (
    vinyl.releaseType === 'Single' ||
    vinyl.releaseType === 'Live Version' ||
    vinyl.releaseType === 'Cover'
  ) {
    return !hasMultipleTracks(vinyl);
  }
  return false;
}

export function sortPostcardsForBoard(
  postcards: GuestbookPostcard[]
): GuestbookPostcard[] {
  return [...postcards].sort((a, b) => {
    const pinDiff = Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned));
    if (pinDiff !== 0) return pinDiff;
    const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tB - tA;
  });
}