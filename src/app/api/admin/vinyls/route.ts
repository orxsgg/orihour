import { NextRequest, NextResponse } from 'next/server';
import { normalizeGenre } from '@/lib/genreUtils';
import {
  checkRateLimit,
  getClientIp,
  isValidRecordId,
  sanitizePlainText,
  sanitizeSafeUrl,
} from '@/lib/security';
import {
  mapVinylRow,
  sanitizeClipMode,
  sanitizeReleaseType,
  sanitizeTracksArray,
  VinylRecordRow,
} from '@/lib/supabase/mappers';
import { requireAdminUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

async function getExistingGenres(
  supabase: NonNullable<Awaited<ReturnType<typeof requireAdminUser>>['supabase']>
): Promise<string[]> {
  const [gRes, vRes] = await Promise.all([
    supabase.from('genres').select('name'),
    supabase.from('vinyl_records').select('genre'),
  ]);
  const names: string[] = [];
  if (!gRes.error && gRes.data) {
    gRes.data.forEach((r) => r.name && names.push(String(r.name)));
  }
  if (!vRes.error && vRes.data) {
    vRes.data.forEach((r) => r.genre && names.push(String(r.genre)));
  }
  return names;
}

async function ensureGenreInTable(
  supabase: NonNullable<Awaited<ReturnType<typeof requireAdminUser>>['supabase']>,
  canonicalGenre: string
) {
  try {
    await supabase.from('genres').upsert({ name: canonicalGenre }, { onConflict: 'name' });
  } catch {
    // Ignore if genres table has not been migrated yet
  }
}

export async function GET() {
  const { supabase, user, error } = await requireAdminUser();
  if (error || !supabase || !user) {
    return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
  }

  const { data, error: dbErr } = await supabase
    .from('vinyl_records')
    .select('*')
    .order('rack_slot', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (dbErr) {
    return NextResponse.json({ error: dbErr.message }, { status: 500 });
  }

  return NextResponse.json({
    vinyls: (data as VinylRecordRow[]).map(mapVinylRow),
  });
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(`admin-vinyls:${ip}`, 60, 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Terlalu banyak permintaan.' }, { status: 429 });
  }

  const { supabase, user, error } = await requireAdminUser();
  if (error || !supabase || !user) {
    return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const title = sanitizePlainText(body?.title, 100);
    const artist = sanitizePlainText(body?.artist, 100);
    if (!title || !artist) {
      return NextResponse.json(
        { error: 'Judul dan nama penyanyi wajib diisi.' },
        { status: 400 }
      );
    }

    const releaseType = sanitizeReleaseType(body?.releaseType);
    const existingGenres = await getExistingGenres(supabase);
    const canonicalGenre = normalizeGenre(
      sanitizePlainText(body?.genre, 40) || 'Indie',
      existingGenres
    );
    await ensureGenreInTable(supabase, canonicalGenre);

    const parsedSlot =
      typeof body?.rackSlot === 'number' && body.rackSlot >= 1 && body.rackSlot <= 6
        ? Math.round(body.rackSlot)
        : null;

    if (parsedSlot !== null) {
      await supabase
        .from('vinyl_records')
        .update({ rack_slot: null })
        .eq('rack_slot', parsedSlot);
    }

    const clipMode = sanitizeClipMode(body?.clipMode);
    const clipStart = Math.max(0, Math.round(Number(body?.clipStartSec) || 0));
    const clipEnd = Math.max(
      clipStart + 3,
      Math.round(Number(body?.clipEndSec) || clipStart + 30)
    );

    const tracks = releaseType === 'Song' ? [] : sanitizeTracksArray(body?.tracks);

    const { data, error: insertErr } = await supabase
      .from('vinyl_records')
      .insert({
        title,
        artist,
        album: sanitizePlainText(body?.album, 100),
        release_type: releaseType,
        release_year: Math.max(
          1900,
          Math.min(2100, Number(body?.releaseYear) || new Date().getFullYear())
        ),
        duration: sanitizePlainText(body?.duration, 12) || '03:30',
        genre: canonicalGenre,
        label_color: /^#[0-9a-fA-F]{6}$/.test(String(body?.labelColor || ''))
          ? String(body.labelColor)
          : '#4A2E1B',
        art_style: Number(body?.artStyle) || 0,
        cover_url: sanitizeSafeUrl(body?.coverUrl) || null,
        show_cover_overlay: body?.showCoverOverlay !== false,
        audio_url: sanitizeSafeUrl(body?.audioUrl) || null,
        clip_mode: clipMode,
        clip_start_sec: clipStart,
        clip_end_sec: clipEnd,
        favorite_lyric: sanitizePlainText(body?.favoriteLyric, 280),
        favorite_song: sanitizePlainText(body?.favoriteSong, 120),
        tracks,
        liner_notes: sanitizePlainText(body?.linerNotes, 1200),
        rack_slot: parsedSlot,
      })
      .select('*')
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ vinyl: mapVinylRow(data as VinylRecordRow) });
  } catch (err) {
    console.error('[POST /api/admin/vinyls]', err);
    return NextResponse.json({ error: 'Payload tidak valid.' }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(`admin-vinyls:${ip}`, 60, 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Terlalu banyak permintaan.' }, { status: 429 });
  }

  const { supabase, user, error } = await requireAdminUser();
  if (error || !supabase || !user) {
    return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();

    // Bulk reorder 6-slot 3D wooden rack container (drag-and-drop)
    if (body?.action === 'reorder_rack' && Array.isArray(body?.rackIds)) {
      const rackIds = (body.rackIds as (string | null)[]).slice(0, 6);

      const { error: clearErr } = await supabase
        .from('vinyl_records')
        .update({ rack_slot: null, updated_at: new Date().toISOString() })
        .not('rack_slot', 'is', null);

      if (clearErr) {
        return NextResponse.json({ error: clearErr.message }, { status: 500 });
      }

      const { data: settings } = await supabase
        .from('room_settings')
        .select('active_turntable_vinyl_id')
        .eq('id', 1)
        .maybeSingle();
      const activeId = settings?.active_turntable_vinyl_id ?? null;

      const assignedIds = new Set<string>();
      for (let idx = 0; idx < rackIds.length; idx++) {
        const id = rackIds[idx];
        if (!id || !isValidRecordId(id) || id === activeId || assignedIds.has(id)) continue;
        assignedIds.add(id);
        await supabase
          .from('vinyl_records')
          .update({ rack_slot: idx + 1, updated_at: new Date().toISOString() })
          .eq('id', id);
      }

      const { data: updated } = await supabase
        .from('vinyl_records')
        .select('*')
        .order('rack_slot', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });

      return NextResponse.json({
        vinyls: ((updated as VinylRecordRow[]) || []).map(mapVinylRow),
      });
    }

    const id = String(body?.id || '').trim();
    if (!id || !isValidRecordId(id)) {
      return NextResponse.json({ error: 'ID vinyl tidak valid.' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof body.title === 'string') updates.title = sanitizePlainText(body.title, 100);
    if (typeof body.artist === 'string') updates.artist = sanitizePlainText(body.artist, 100);
    if (typeof body.album === 'string') updates.album = sanitizePlainText(body.album, 100);
    if (typeof body.releaseType === 'string') {
      updates.release_type = sanitizeReleaseType(body.releaseType);
    }
    if (body.releaseYear !== undefined) {
      updates.release_year = Math.max(
        1900,
        Math.min(2100, Number(body.releaseYear) || new Date().getFullYear())
      );
    }
    if (typeof body.duration === 'string') {
      updates.duration = sanitizePlainText(body.duration, 12) || '03:30';
    }
    if (typeof body.genre === 'string') {
      const existingGenres = await getExistingGenres(supabase);
      const canonical = normalizeGenre(sanitizePlainText(body.genre, 40), existingGenres);
      await ensureGenreInTable(supabase, canonical);
      updates.genre = canonical;
    }
    if (typeof body.labelColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(body.labelColor)) {
      updates.label_color = body.labelColor;
    }
    if (body.artStyle !== undefined) updates.art_style = Number(body.artStyle) || 0;
    if (body.coverUrl !== undefined) {
      updates.cover_url = sanitizeSafeUrl(body.coverUrl) || null;
    }
    if (typeof body.showCoverOverlay === 'boolean') {
      updates.show_cover_overlay = body.showCoverOverlay;
    }
    if (body.audioUrl !== undefined) {
      updates.audio_url = sanitizeSafeUrl(body.audioUrl) || null;
    }
    if (typeof body.clipMode === 'string') {
      updates.clip_mode = sanitizeClipMode(body.clipMode);
    }
    if (body.clipStartSec !== undefined) {
      updates.clip_start_sec = Math.max(0, Math.round(Number(body.clipStartSec) || 0));
    }
    if (body.clipEndSec !== undefined) {
      const baseStart =
        typeof updates.clip_start_sec === 'number' ? updates.clip_start_sec : 0;
      updates.clip_end_sec = Math.max(
        baseStart + 3,
        Math.round(Number(body.clipEndSec) || baseStart + 30)
      );
    }
    if (typeof body.favoriteLyric === 'string') {
      updates.favorite_lyric = sanitizePlainText(body.favoriteLyric, 280);
    }
    if (typeof body.favoriteSong === 'string') {
      updates.favorite_song = sanitizePlainText(body.favoriteSong, 120);
    }
    if (Array.isArray(body.tracks)) {
      updates.tracks =
        updates.release_type === 'Song' ? [] : sanitizeTracksArray(body.tracks);
    }
    if (typeof body.linerNotes === 'string') {
      updates.liner_notes = sanitizePlainText(body.linerNotes, 1200);
    }
    if (body.rackSlot !== undefined) {
      const slot =
        typeof body.rackSlot === 'number' && body.rackSlot >= 1 && body.rackSlot <= 6
          ? Math.round(body.rackSlot)
          : null;
      if (slot !== null) {
        await supabase
          .from('vinyl_records')
          .update({ rack_slot: null })
          .eq('rack_slot', slot)
          .neq('id', id);
      }
      updates.rack_slot = slot;
    }

    const { data, error: updErr } = await supabase
      .from('vinyl_records')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ vinyl: mapVinylRow(data as VinylRecordRow) });
  } catch (err) {
    console.error('[PATCH /api/admin/vinyls]', err);
    return NextResponse.json({ error: 'Payload tidak valid.' }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(`admin-vinyls:${ip}`, 40, 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Terlalu banyak permintaan.' }, { status: 429 });
  }

  const { supabase, user, error } = await requireAdminUser();
  if (error || !supabase || !user) {
    return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get('id')?.trim() || '';
  if (!id || !isValidRecordId(id)) {
    return NextResponse.json({ error: 'ID vinyl tidak valid.' }, { status: 400 });
  }

  await supabase
    .from('room_settings')
    .update({ active_turntable_vinyl_id: null, updated_at: new Date().toISOString() })
    .eq('id', 1)
    .eq('active_turntable_vinyl_id', id);

  const { error: delErr } = await supabase.from('vinyl_records').delete().eq('id', id);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ deletedId: id });
}