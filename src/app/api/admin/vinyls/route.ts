import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { formatGenres, parseGenres } from '@/lib/genreUtils';
import {
  deleteMediaUrlsFromStoragePool,
  getPrimaryAdminDb,
} from '@/lib/server/storagePool';
import {
  mapVinylRow,
  sanitizeClipMode,
  sanitizeFadeSec,
  sanitizeReleaseType,
} from '@/lib/supabase/mappers';
import { TrackItem } from '@/types/orihour';

export const dynamic = 'force-dynamic';

function asOptionalString(val: unknown): string | undefined {
  return typeof val === 'string' ? val : undefined;
}

function cleanText(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLen);
}

function cleanOptionalUrl(val: unknown): string | null {
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/')) {
    return trimmed.slice(0, 1200);
  }
  return null;
}

function extractVinylRowMediaUrls(row: {
  cover_url?: string | null;
  audio_url?: string | null;
  tracks?: unknown;
} | null): string[] {
  if (!row) return [];
  const urls: string[] = [];
  if (typeof row.cover_url === 'string' && row.cover_url.trim()) {
    urls.push(row.cover_url.trim());
  }
  if (typeof row.audio_url === 'string' && row.audio_url.trim()) {
    urls.push(row.audio_url.trim());
  }
  if (Array.isArray(row.tracks)) {
    for (const trk of row.tracks as Array<Record<string, unknown>>) {
      if (trk && typeof trk === 'object') {
        if (typeof trk.audioUrl === 'string' && trk.audioUrl.trim()) {
          urls.push(trk.audioUrl.trim());
        }
        if (typeof trk.audio_url === 'string' && trk.audio_url.trim()) {
          urls.push(trk.audio_url.trim());
        }
      }
    }
  }
  return urls;
}

function sanitizeTracks(raw: unknown): TrackItem[] {
  if (!Array.isArray(raw)) return [];
  const out: TrackItem[] = [];
  for (let i = 0; i < Math.min(raw.length, 60); i++) {
    const item = raw[i] as Record<string, unknown>;
    if (!item || typeof item !== 'object') continue;
    const title = cleanText(item.title, 160);
    if (!title) continue;
    const clipStart = Math.max(0, Math.round(Number(item.clipStartSec) || 0));
    const clipEnd = Math.max(clipStart + 5, Math.round(Number(item.clipEndSec) || 30));
    out.push({
      id: cleanText(item.id, 64) || `trk-${Date.now()}-${i}`,
      title,
      duration: cleanText(item.duration, 16) || '03:30',
      audioUrl: cleanOptionalUrl(item.audioUrl) || undefined,
      clipMode: sanitizeClipMode(asOptionalString(item.clipMode)),
      clipStartSec: clipStart,
      clipEndSec: clipEnd,
      fadeInSec: sanitizeFadeSec(item.fadeInSec),
      fadeOutSec: sanitizeFadeSec(item.fadeOutSec),
    });
  }
  return out;
}

function slugifyGenre(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'genre'
  );
}

async function getAuthorizedSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();

  if (!url || !anonKey) {
    return {
      error: 'Supabase belum dikonfigurasi.',
      status: 500 as const,
      supabase: null,
    };
  }

  const cookieStore = await cookies();
  const sessionClient = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Ignore write in read-only contexts
        }
      },
    },
  });

  const {
    data: { user },
  } = await sessionClient.auth.getUser();

  if (!user) {
    return {
      error: 'Unauthorized. Silakan login sebagai admin.',
      status: 401 as const,
      supabase: null,
    };
  }

  if (adminEmail && (user.email || '').toLowerCase() !== adminEmail) {
    return {
      error: 'Forbidden. Akun tidak memiliki akses admin.',
      status: 403 as const,
      supabase: null,
    };
  }

  const dbClient = serviceKey
    ? createClient(url, serviceKey, { auth: { persistSession: false } })
    : sessionClient;

  return { error: null, status: 200 as const, supabase: dbClient };
}

async function ensureIndividualGenresExist(
  supabase: ReturnType<typeof createClient> | ReturnType<typeof createServerClient>,
  genreList: string[]
) {
  for (const name of genreList) {
    const slug = slugifyGenre(name);
    try {
      await supabase
        .from('genres')
        .upsert({ name, slug }, { onConflict: 'slug', ignoreDuplicates: true });
    } catch {
      // Abaikan jika sudah terdaftar dengan nama/slug serupa
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthorizedSupabaseClient();
    if (!auth.supabase) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const supabase = auth.supabase;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const title = cleanText(body.title, 160);
    const artist = cleanText(body.artist, 160);

    if (!title || !artist) {
      return NextResponse.json(
        { error: 'Judul dan nama penyanyi wajib diisi.' },
        { status: 400 }
      );
    }

    const releaseType = sanitizeReleaseType(asOptionalString(body.releaseType));
    const tracks = sanitizeTracks(body.tracks);
    const parsedGenres = parseGenres(
      typeof body.genre === 'string'
        ? body.genre
        : typeof body.mood === 'string'
        ? body.mood
        : 'Indie'
    );
    const finalGenres = parsedGenres.length > 0 ? parsedGenres : ['Indie'];
    const genreString = formatGenres(finalGenres);

    await ensureIndividualGenresExist(supabase, finalGenres);

    const rawRack = body.rackSlot;
    const rackSlot =
      typeof rawRack === 'number' &&
      Number.isInteger(rawRack) &&
      rawRack >= 1 &&
      rawRack <= 6
        ? rawRack
        : null;

    if (rackSlot !== null) {
      await supabase
        .from('vinyl_records')
        .update({ rack_slot: null })
        .eq('rack_slot', rackSlot);
    }

    const clipStart = Math.max(0, Math.round(Number(body.clipStartSec) || 0));
    const clipEnd = Math.max(clipStart + 5, Math.round(Number(body.clipEndSec) || 30));
    const releaseYear = Math.min(
      2100,
      Math.max(1900, Math.round(Number(body.releaseYear) || new Date().getFullYear()))
    );

    const newId = `vnl-${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;

    const insertRow = {
      id: newId,
      title,
      artist,
      album: cleanText(body.album, 160),
      release_type: releaseType,
      release_year: releaseYear,
      duration: cleanText(body.duration, 16) || '03:30',
      genre: genreString,
      label_color: cleanText(body.labelColor, 20) || '#4A2E1B',
      art_style: Math.max(0, Math.round(Number(body.artStyle) || 0)),
      cover_url: cleanOptionalUrl(body.coverUrl),
      show_cover_overlay: body.showCoverOverlay !== false,
      audio_url: cleanOptionalUrl(body.audioUrl),
      clip_mode: sanitizeClipMode(asOptionalString(body.clipMode)),
      clip_start_sec: clipStart,
      clip_end_sec: clipEnd,
      fade_in_sec: sanitizeFadeSec(body.fadeInSec),
      fade_out_sec: sanitizeFadeSec(body.fadeOutSec),
      favorite_lyric: cleanText(body.favoriteLyric, 500),
      favorite_song: cleanText(body.favoriteSong, 160),
      tracks,
      liner_notes: cleanText(body.linerNotes, 2500),
      rack_slot: rackSlot,
    };

    const { data, error } = await supabase
      .from('vinyl_records')
      .insert(insertRow)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ vinyl: mapVinylRow(data) }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal menambah koleksi vinyl.' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await getAuthorizedSupabaseClient();
    if (!auth.supabase) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const supabase = auth.supabase;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const id = cleanText(body.id, 80);
    if (!id) {
      return NextResponse.json({ error: 'ID vinyl tidak valid.' }, { status: 400 });
    }

    const patch: Record<string, unknown> = {};

    if ('title' in body) {
      const title = cleanText(body.title, 160);
      if (!title) {
        return NextResponse.json({ error: 'Judul tidak boleh kosong.' }, { status: 400 });
      }
      patch.title = title;
    }

    if ('artist' in body) {
      const artist = cleanText(body.artist, 160);
      if (!artist) {
        return NextResponse.json({ error: 'Penyanyi tidak boleh kosong.' }, { status: 400 });
      }
      patch.artist = artist;
    }

    if ('album' in body) patch.album = cleanText(body.album, 160);
    if ('releaseType' in body) {
      patch.release_type = sanitizeReleaseType(asOptionalString(body.releaseType));
    }
    if ('releaseYear' in body) {
      patch.release_year = Math.min(
        2100,
        Math.max(1900, Math.round(Number(body.releaseYear) || new Date().getFullYear()))
      );
    }
    if ('duration' in body) patch.duration = cleanText(body.duration, 16) || '03:30';

    if ('genre' in body || 'mood' in body) {
      const rawGenre =
        typeof body.genre === 'string'
          ? body.genre
          : typeof body.mood === 'string'
          ? body.mood
          : 'Indie';
      const parsedGenres = parseGenres(rawGenre);
      const finalGenres = parsedGenres.length > 0 ? parsedGenres : ['Indie'];
      const genreString = formatGenres(finalGenres);
      patch.genre = genreString;
      await ensureIndividualGenresExist(supabase, finalGenres);
    }

    if ('labelColor' in body) {
      patch.label_color = cleanText(body.labelColor, 20) || '#4A2E1B';
    }
    if ('artStyle' in body) {
      patch.art_style = Math.max(0, Math.round(Number(body.artStyle) || 0));
    }
    if ('coverUrl' in body) patch.cover_url = cleanOptionalUrl(body.coverUrl);
    if ('showCoverOverlay' in body) {
      patch.show_cover_overlay = body.showCoverOverlay !== false;
    }
    if ('audioUrl' in body) patch.audio_url = cleanOptionalUrl(body.audioUrl);
    if ('clipMode' in body) {
      patch.clip_mode = sanitizeClipMode(asOptionalString(body.clipMode));
    }

    if ('clipStartSec' in body || 'clipEndSec' in body) {
      const startSec = Math.max(0, Math.round(Number(body.clipStartSec) || 0));
      const endSec = Math.max(startSec + 5, Math.round(Number(body.clipEndSec) || 30));
      patch.clip_start_sec = startSec;
      patch.clip_end_sec = endSec;
    }

    if ('fadeInSec' in body) {
      patch.fade_in_sec = sanitizeFadeSec(body.fadeInSec);
    }
    if ('fadeOutSec' in body) {
      patch.fade_out_sec = sanitizeFadeSec(body.fadeOutSec);
    }

    if ('favoriteLyric' in body) patch.favorite_lyric = cleanText(body.favoriteLyric, 500);
    if ('favoriteSong' in body) patch.favorite_song = cleanText(body.favoriteSong, 160);
    if ('tracks' in body) patch.tracks = sanitizeTracks(body.tracks);
    if ('linerNotes' in body) patch.liner_notes = cleanText(body.linerNotes, 2500);

    if ('rackSlot' in body) {
      const rawRack = body.rackSlot;
      const rackSlot =
        typeof rawRack === 'number' &&
        Number.isInteger(rawRack) &&
        rawRack >= 1 &&
        rawRack <= 6
          ? rawRack
          : null;

      if (rackSlot !== null) {
        await supabase
          .from('vinyl_records')
          .update({ rack_slot: null })
          .eq('rack_slot', rackSlot)
          .neq('id', id);
      }
      patch.rack_slot = rackSlot;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Tidak ada perubahan untuk disimpan.' }, { status: 400 });
    }

    // Simpan daftar media lama jika ada perubahan cover/audio/tracks
    const mediaChanged = 'coverUrl' in body || 'audioUrl' in body || 'tracks' in body;
    let previousMediaUrls: string[] = [];
    if (mediaChanged) {
      const { data: prevRow } = await supabase
        .from('vinyl_records')
        .select('cover_url, audio_url, tracks')
        .eq('id', id)
        .maybeSingle();
      previousMediaUrls = extractVinylRowMediaUrls(prevRow);
    }

    const { data, error } = await supabase
      .from('vinyl_records')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Hapus file lama yang diganti/dilepas dari bucket penyimpanan
    if (mediaChanged && previousMediaUrls.length > 0) {
      const nextSet = new Set(extractVinylRowMediaUrls(data));
      const removedUrls = previousMediaUrls.filter((u) => !nextSet.has(u));
      if (removedUrls.length > 0) {
        try {
          const adminDb = getPrimaryAdminDb();
          await deleteMediaUrlsFromStoragePool(adminDb, removedUrls);
        } catch {
          // Non-fatal; tetap dapat dibersihkan lewat Orphan Cleaner
        }
      }
    }

    return NextResponse.json({ vinyl: mapVinylRow(data) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal memperbarui koleksi vinyl.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await getAuthorizedSupabaseClient();
    if (!auth.supabase) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const supabase = auth.supabase;

    const id = cleanText(req.nextUrl.searchParams.get('id'), 80);
    if (!id) {
      return NextResponse.json({ error: 'ID vinyl tidak valid.' }, { status: 400 });
    }

    // 1. Ambil seluruh URL cover & MP3 sebelum baris database dihapus
    const { data: existingRow } = await supabase
      .from('vinyl_records')
      .select('cover_url, audio_url, tracks')
      .eq('id', id)
      .maybeSingle();

    const mediaUrlsToDelete = extractVinylRowMediaUrls(existingRow);

    try {
      await supabase
        .from('room_settings')
        .update({ active_turntable_vinyl_id: null })
        .eq('active_turntable_vinyl_id', id);
    } catch {
      // Abaikan jika pengaturan turntable sudah kosong
    }

    // 2. Hapus record vinyl dari database
    const { error } = await supabase.from('vinyl_records').delete().eq('id', id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 3. Hapus fisik file terkait dari Supabase Storage / Backblaze B2 & perbarui kuota
    let deletedStorageFiles = 0;
    if (mediaUrlsToDelete.length > 0) {
      try {
        const adminDb = getPrimaryAdminDb();
        const cleanup = await deleteMediaUrlsFromStoragePool(adminDb, mediaUrlsToDelete);
        deletedStorageFiles = cleanup.deletedCount;
      } catch {
        // Non-fatal
      }
    }

    return NextResponse.json({ ok: true, id, deletedStorageFiles });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal menghapus vinyl.' },
      { status: 500 }
    );
  }
}