import { NextRequest, NextResponse } from 'next/server';
import {
  checkRateLimit,
  getClientIp,
  isValidRecordId,
  sanitizePlainText,
  sanitizeSafeUrl,
} from '@/lib/security';
import { fetchFullRoomPayload } from '@/lib/supabase/mappers';
import { requireAdminUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(`admin-settings:${ip}`, 40, 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Terlalu banyak permintaan.' }, { status: 429 });
  }

  const { supabase, user, error } = await requireAdminUser();
  if (error || !supabase || !user) {
    return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof body.siteName === 'string') {
      updates.site_name = sanitizePlainText(body.siteName, 40) || 'ORIHOUR';
    }
    if (typeof body.wallTitle === 'string') {
      updates.wall_title = sanitizePlainText(body.wallTitle, 40) || 'ORIHOUR';
    }
    if (typeof body.wallSubtitle === 'string') {
      updates.wall_subtitle = sanitizePlainText(body.wallSubtitle, 80);
    }
    if (typeof body.bio === 'string') {
      updates.bio = sanitizePlainText(body.bio, 420);
    }

    if (body.activeTurntableVinylId !== undefined) {
      const rawId =
        typeof body.activeTurntableVinylId === 'string'
          ? body.activeTurntableVinylId.trim()
          : '';
      const nextId = rawId && isValidRecordId(rawId) ? rawId : null;
      updates.active_turntable_vinyl_id = nextId;

      if (nextId) {
        await supabase
          .from('vinyl_records')
          .update({ rack_slot: null, updated_at: new Date().toISOString() })
          .eq('id', nextId);
      }
    }

    if (body.ownerProfile && typeof body.ownerProfile === 'object') {
      const op = body.ownerProfile as Record<string, unknown>;
      updates.owner_profile = {
        name: sanitizePlainText(op.name, 50) || 'Oriha Hizkia',
        role: sanitizePlainText(op.role, 60),
        idCode: sanitizePlainText(op.idCode, 28),
        location: sanitizePlainText(op.location, 50),
        avatarUrl: sanitizeSafeUrl(op.avatarUrl),
        spotifyHandle: sanitizePlainText(op.spotifyHandle, 40),
        spotifyUrl: sanitizeSafeUrl(op.spotifyUrl),
        instagramHandle: sanitizePlainText(op.instagramHandle, 40),
        instagramUrl: sanitizeSafeUrl(op.instagramUrl),
      };
    }

    const { error: upsertErr } = await supabase
      .from('room_settings')
      .upsert({ id: 1, ...updates }, { onConflict: 'id' });

    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }

    const payload = await fetchFullRoomPayload(supabase, true);
    return NextResponse.json(payload);
  } catch (err) {
    console.error('[PATCH /api/admin/settings]', err);
    return NextResponse.json({ error: 'Payload tidak valid.' }, { status: 400 });
  }
}