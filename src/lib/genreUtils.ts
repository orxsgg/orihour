import { GuestbookPostcard, VinylRecord } from '@/types/orihour';

const CANONICAL_ACRONYMS: Record<string, string> = {
  'r&b': 'R&B',
  rnb: 'R&B',
  'r & b': 'R&B',
  edm: 'EDM',
  'lo-fi': 'Lo-Fi',
  lofi: 'Lo-Fi',
  'lo fi': 'Lo-Fi',
  'hip-hop': 'Hip-Hop',
  hiphop: 'Hip-Hop',
  'hip hop': 'Hip-Hop',
  'k-pop': 'K-Pop',
  kpop: 'K-Pop',
  'j-pop': 'J-Pop',
  jpop: 'J-Pop',
  'c-pop': 'C-Pop',
  'synth-pop': 'Synth-Pop',
  synthpop: 'Synth-Pop',
  'post-punk': 'Post-Punk',
  'post-rock': 'Post-Rock',
  'alt-rock': 'Alt-Rock',
  'neo-soul': 'Neo-Soul',
  dnb: 'DnB',
  ost: 'OST',
  'uk garage': 'UK Garage',
  'id indie': 'ID Indie',
};

/**
 * Normalizes any free-typed genre into a single consistent canonical label.
 * Examples:
 *  - "indie", "Indie", " INDIE  " -> "Indie"
 *  - "dream   pop", "DREAM POP"   -> "Dream Pop"
 *  - "rnb", "r&b", "R&B"          -> "R&B"
 *  - "lofi", "lo-fi"              -> "Lo-Fi"
 */
export function normalizeGenre(raw: string, existingGenres: string[] = []): string {
  const cleaned = raw.trim().replace(/\s+/g, ' ');
  if (!cleaned) return 'Uncategorized';

  const lower = cleaned.toLowerCase();

  // 1. Exact acronym / known canonical match
  if (CANONICAL_ACRONYMS[lower]) {
    return CANONICAL_ACRONYMS[lower];
  }

  // 2. Match existing genre case-insensitively (keeps existing naming 100% consistent)
  const existingMatch = existingGenres.find(
    (g) => g.trim().replace(/\s+/g, ' ').toLowerCase() === lower
  );
  if (existingMatch) {
    return existingMatch.trim().replace(/\s+/g, ' ');
  }

  // 3. Smart Title Case (handles hyphenated sub-genres like "Indie-Folk")
  return cleaned
    .split(' ')
    .map((word) => {
      const wLower = word.toLowerCase();
      if (CANONICAL_ACRONYMS[wLower]) return CANONICAL_ACRONYMS[wLower];
      return word
        .split('-')
        .map((part) => {
          const pLower = part.toLowerCase();
          if (CANONICAL_ACRONYMS[pLower]) return CANONICAL_ACRONYMS[pLower];
          if (!part) return part;
          return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
        })
        .join('-');
    })
    .join(' ');
}

/**
 * Returns sorted unique canonical genre labels across all vinyl records (zero duplicates).
 */
export function extractUniqueGenres(vinyls: VinylRecord[]): string[] {
  const map = new Map<string, string>();
  for (const v of vinyls) {
    const normalized = normalizeGenre(v.genre || v.mood || '');
    const key = normalized.toLowerCase();
    if (!map.has(key)) {
      map.set(key, normalized);
    }
  }
  return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
}

/**
 * Orders postcards for display on the 3D corkboard & Pinboard modal:
 * 1. Admin-pinned postcards stay locked at the front in their explicit `pinOrder`.
 * 2. All other visitor postcards follow strictly newest-first (pushing oldest off the 3D board).
 */
export function sortPostcardsForBoard(postcards: GuestbookPostcard[]): GuestbookPostcard[] {
  return [...postcards].sort((a, b) => {
    const aPinned = Boolean(a.isPinned);
    const bPinned = Boolean(b.isPinned);

    if (aPinned && bPinned) {
      const orderA = a.pinOrder ?? 9999;
      const orderB = b.pinOrder ?? 9999;
      if (orderA !== orderB) return orderA - orderB;
    } else if (aPinned !== bPinned) {
      return aPinned ? -1 : 1;
    }

    const timeA = a.createdAt ? Date.parse(a.createdAt) : 0;
    const timeB = b.createdAt ? Date.parse(b.createdAt) : 0;
    if (timeA !== timeB) return timeB - timeA;

    return b.id.localeCompare(a.id);
  });
}