import { SupabaseClient } from '@supabase/supabase-js';
import {
  DEFAULT_ROOM_CONFIG,
  INITIAL_POSTCARDS,
  INITIAL_VINYLS,
} from '@/data/mockVinyls';
import { extractUniqueGenres, normalizeGenre, sortPostcardsForBoard } from '@/lib/genreUtils';
import { sanitizePlainText, sanitizeSafeUrl } from '@/lib/security';
import {
  ClipMode,
  GenreItem,
  GuestbookPostcard,
  MAX_PINBOARD_VISIBLE,
  OwnerProfile,
  PosterItem,
  RELEASE_TYPES,
  ReleaseType,
  RoomConfig,
  TrackItem,
  VinylRecord,
} from '@/types/orihour';

export interface RoomSettingsRow {
  id: number;
  site_name: string;
  wall_title: string;
  wall_subtitle: string;
  bio: string;
  active_turntable_vinyl_id: string | null;
  owner_profile: Partial<OwnerProfile> | null;
}

export interface VinylRecordRow {
  id: string;
  title: string;
  artist: string;
  album: string;
  release_type: string;
  release_year: number;
  duration: string;
  genre: string;
  label_color: string;
  art_style: number;
  cover_url: string | null;
  show_cover_overlay: boolean;
  audio_url: string | null;
  clip_mode?: string | null;
  clip_start_sec?: number | null;
  clip_end_sec?: number | null;
  fade_in_sec?: number | null;
  fade_out_sec?: number | null;
  favorite_lyric: string;
  favorite_song?: string | null;
  tracks?: unknown;
  liner_notes: string;
  likes_count: number;
  rack_slot: number | null;
  created_at: string;
}

export interface WallPosterRow {
  id: string;
  slot_index: number;
  title: string;
  subtitle: string;
  accent_color: string;
  style: number;
  image_url: string | null;
}

export interface PostcardRow {
  id: string;
  song_title: string;
  artist: string;
  sender_name: string;
  reason: string;
  date_label: string;
  pin_color: string;
  is_pinned: boolean;
  pin_order: number | null;
  is_hidden: boolean;
  created_at: string;
}

export interface GenreRow {
  id: string;
  name: string;
}

export function sanitizeReleaseType(raw?: string | null): ReleaseType {
  if (raw && (RELEASE_TYPES as string[]).includes(raw)) {
    return raw as ReleaseType;
  }
  return 'Song';
}

export function sanitizeClipMode(raw?: string | null): ClipMode {
  if (raw === 'snippet') return 'snippet';
  if (raw === 'trimmed') return 'trimmed';
  return 'full';
}

export function sanitizeFadeSec(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(30, Math.round(n * 10) / 10);
}

export function sanitizeTracksArray(raw: unknown): TrackItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 60)
    .map((item, idx): TrackItem | null => {
      if (!item || typeof item !== 'object') return null;
      const obj = item as Record<string, unknown>;
      const title = sanitizePlainText(obj.title, 120);
      if (!title) return null;

      const clipStart = Math.max(0, Math.round(Number(obj.clipStartSec) || 0));
      const clipEnd = Math.max(
        clipStart + 3,
        Math.round(Number(obj.clipEndSec) || clipStart + 30)
      );

      return {
        id:
          typeof obj.id === 'string' && obj.id.trim()
            ? obj.id.trim().slice(0, 64)
            : `trk-${idx + 1}`,
        title,
        duration: sanitizePlainText(obj.duration, 16) || '03:30',
        audioUrl: sanitizeSafeUrl(obj.audioUrl) || undefined,
        clipMode: sanitizeClipMode(typeof obj.clipMode === 'string' ? obj.clipMode : 'full'),
        clipStartSec: clipStart,
        clipEndSec: clipEnd,
        fadeInSec: sanitizeFadeSec(obj.fadeInSec),
        fadeOutSec: sanitizeFadeSec(obj.fadeOutSec),
      };
    })
    .filter((t): t is TrackItem => Boolean(t));
}

export function mapVinylRow(row: VinylRecordRow): VinylRecord {
  const canonicalGenre = normalizeGenre(row.genre || 'Indie');
  const clipStart = Math.max(0, Number(row.clip_start_sec) || 0);
  const clipEnd = Math.max(clipStart + 3, Number(row.clip_end_sec) || clipStart + 30);

  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    album: row.album || '',
    releaseType: sanitizeReleaseType(row.release_type),
    releaseYear: Number(row.release_year) || 2026,
    duration: row.duration || '03:30',
    genre: canonicalGenre,
    mood: canonicalGenre,
    labelColor: row.label_color || '#4A2E1B',
    artStyle: Number(row.art_style) || 0,
    coverUrl: row.cover_url || undefined,
    showCoverOverlay: row.show_cover_overlay ?? true,
    audioUrl: row.audio_url || undefined,
    clipMode: sanitizeClipMode(row.clip_mode),
    clipStartSec: clipStart,
    clipEndSec: clipEnd,
    fadeInSec: sanitizeFadeSec(row.fade_in_sec),
    fadeOutSec: sanitizeFadeSec(row.fade_out_sec),
    favoriteLyric: row.favorite_lyric || '',
    favoriteSong: row.favorite_song || '',
    tracks: sanitizeTracksArray(row.tracks),
    linerNotes: row.liner_notes || '',
    likesCount: Number(row.likes_count) || 0,
    rackSlot:
      typeof row.rack_slot === 'number' && row.rack_slot >= 1 && row.rack_slot <= 6
        ? row.rack_slot
        : null,
    createdAt: row.created_at,
  };
}

export function mapPosterRow(row: WallPosterRow): PosterItem {
  return {
    id: row.id,
    slotIndex: row.slot_index,
    title: row.title,
    subtitle: row.subtitle || '',
    accentColor: row.accent_color || '#4A2E1B',
    style: Number(row.style) || 0,
    imageUrl: row.image_url || '',
  };
}

export function mapPostcardRow(row: PostcardRow): GuestbookPostcard {
  return {
    id: row.id,
    songTitle: row.song_title,
    artist: row.artist,
    senderName: row.sender_name,
    reason: row.reason,
    dateLabel: row.date_label,
    pinColor:
      row.pin_color && row.pin_color.toUpperCase() !== '#D94E28'
        ? row.pin_color
        : '#4A2E1B',
    isPinned: Boolean(row.is_pinned),
    pinOrder: row.pin_order ?? null,
    isHidden: Boolean(row.is_hidden),
    createdAt: row.created_at,
  };
}

export function mapRoomConfig(
  settings: RoomSettingsRow | null,
  posters: PosterItem[]
): RoomConfig {
  const mergedOwner: OwnerProfile = {
    ...DEFAULT_ROOM_CONFIG.ownerProfile,
    ...(settings?.owner_profile || {}),
  };

  const orderedPosters =
    posters.length > 0
      ? [...posters].sort((a, b) => (a.slotIndex ?? 99) - (b.slotIndex ?? 99))
      : DEFAULT_ROOM_CONFIG.posters;

  return {
    siteName: settings?.site_name || DEFAULT_ROOM_CONFIG.siteName,
    wallTitle: settings?.wall_title || DEFAULT_ROOM_CONFIG.wallTitle,
    wallSubtitle: settings?.wall_subtitle || DEFAULT_ROOM_CONFIG.wallSubtitle,
    bio: settings?.bio || DEFAULT_ROOM_CONFIG.bio,
    activeTurntableVinylId:
      settings !== null
        ? settings.active_turntable_vinyl_id
        : DEFAULT_ROOM_CONFIG.activeTurntableVinylId,
    ownerProfile: mergedOwner,
    posters: orderedPosters,
  };
}

export async function fetchFullRoomPayload(
  supabase: SupabaseClient,
  includeHiddenPostcards = false
): Promise<{
  config: RoomConfig;
  vinyls: VinylRecord[];
  postcards: GuestbookPostcard[];
  genres: GenreItem[];
}> {
  const postcardsQuery = supabase
    .from('guestbook_postcards')
    .select('*')
    .order('created_at', { ascending: false });

  if (!includeHiddenPostcards) {
    postcardsQuery.eq('is_hidden', false);
  }

  const [settingsRes, vinylsRes, postersRes, postcardsRes, genresRes] = await Promise.all([
    supabase.from('room_settings').select('*').eq('id', 1).maybeSingle(),
    supabase
      .from('vinyl_records')
      .select('*')
      .order('rack_slot', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false }),
    supabase.from('wall_posters').select('*').order('slot_index', { ascending: true }),
    postcardsQuery,
    supabase.from('genres').select('*').order('name', { ascending: true }),
  ]);

  if (settingsRes.error) throw settingsRes.error;
  if (vinylsRes.error) throw vinylsRes.error;
  if (postersRes.error) throw postersRes.error;
  if (postcardsRes.error) throw postcardsRes.error;

  const vinyls =
    (vinylsRes.data as VinylRecordRow[] | null)?.map(mapVinylRow) ?? INITIAL_VINYLS;
  const posters = (postersRes.data as WallPosterRow[] | null)?.map(mapPosterRow) ?? [];
  const rawPostcards =
    (postcardsRes.data as PostcardRow[] | null)?.map(mapPostcardRow) ?? INITIAL_POSTCARDS;

  const config = mapRoomConfig(settingsRes.data as RoomSettingsRow | null, posters);
  const sortedPostcards = sortPostcardsForBoard(rawPostcards);
  const postcards = includeHiddenPostcards
    ? sortedPostcards
    : sortedPostcards.slice(0, MAX_PINBOARD_VISIBLE);

  let genres: GenreItem[] = [];
  if (!genresRes.error && Array.isArray(genresRes.data)) {
    genres = (genresRes.data as GenreRow[]).map((g) => ({
      id: g.id,
      name: normalizeGenre(g.name),
    }));
  } else {
    genres = extractUniqueGenres(vinyls).map((name, i) => ({
      id: `fallback-${i}`,
      name,
    }));
  }

  return { config, vinyls, postcards, genres };
}