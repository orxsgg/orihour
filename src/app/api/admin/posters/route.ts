import { NextRequest, NextResponse } from 'next/server';
import {
  checkRateLimit,
  getClientIp,
  isValidRecordId,
  sanitizePlainText,
  sanitizeSafeUrl,
} from '@/lib/security';
import { mapPosterRow, WallPosterRow } from '@/lib/supabase/mappers';
import { requireAdminUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(`admin-posters:${ip}`, 40, 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Terlalu banyak permintaan.' }, { status: 429 });
  }

  const { supabase, user, error } = await requireAdminUser();
  if (error || !supabase || !user) {
    return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const id = String(body?.id || '').trim();
    if (!id || !isValidRecordId(id)) {
      return NextResponse.json({ error: 'ID poster tidak valid.' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (typeof body.title === 'string') updates.title = sanitizePlainText(body.title, 60);
    if (typeof body.subtitle === 'string') {
      updates.subtitle = sanitizePlainText(body.subtitle, 80);
    }
    if (typeof body.accentColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(body.accentColor)) {
      updates.accent_color = body.accentColor;
    }
    if (body.style !== undefined) updates.style = Number(body.style) || 0;
    if (body.imageUrl !== undefined) {
      updates.image_url = sanitizeSafeUrl(body.imageUrl);
    }

    const { data, error: updErr } = await supabase
      .from('wall_posters')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ poster: mapPosterRow(data as WallPosterRow) });
  } catch (err) {
    console.error('[PATCH /api/admin/posters]', err);
    return NextResponse.json({ error: 'Payload tidak valid.' }, { status: 400 });
  }
}