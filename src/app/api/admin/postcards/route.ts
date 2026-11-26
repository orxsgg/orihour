import { NextRequest, NextResponse } from 'next/server';
import { sortPostcardsForBoard } from '@/lib/genreUtils';
import { checkRateLimit, getClientIp, isValidRecordId } from '@/lib/security';
import { mapPostcardRow, PostcardRow } from '@/lib/supabase/mappers';
import { requireAdminUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { supabase, user, error } = await requireAdminUser();
  if (error || !supabase || !user) {
    return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
  }

  const { data, error: dbErr } = await supabase
    .from('guestbook_postcards')
    .select('*')
    .order('created_at', { ascending: false });

  if (dbErr) {
    return NextResponse.json({ error: dbErr.message }, { status: 500 });
  }

  const mapped = ((data as PostcardRow[]) || []).map(mapPostcardRow);
  return NextResponse.json({ postcards: sortPostcardsForBoard(mapped) });
}

export async function PATCH(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(`admin-postcards:${ip}`, 60, 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Terlalu banyak permintaan.' }, { status: 429 });
  }

  const { supabase, user, error } = await requireAdminUser();
  if (error || !supabase || !user) {
    return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();

    if (body?.action === 'reorder_pinned' && Array.isArray(body?.orderedIds)) {
      const orderedIds = (body.orderedIds as string[]).filter((id) => isValidRecordId(id));
      for (let i = 0; i < orderedIds.length; i++) {
        await supabase
          .from('guestbook_postcards')
          .update({ is_pinned: true, pin_order: i + 1 })
          .eq('id', orderedIds[i]);
      }

      const { data } = await supabase
        .from('guestbook_postcards')
        .select('*')
        .order('created_at', { ascending: false });

      const mapped = ((data as PostcardRow[]) || []).map(mapPostcardRow);
      return NextResponse.json({ postcards: sortPostcardsForBoard(mapped) });
    }

    const id = String(body?.id || '').trim();
    if (!id || !isValidRecordId(id)) {
      return NextResponse.json({ error: 'ID postcard tidak valid.' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (typeof body.isPinned === 'boolean') {
      updates.is_pinned = body.isPinned;
      if (!body.isPinned) {
        updates.pin_order = null;
      } else if (typeof body.pinOrder === 'number') {
        updates.pin_order = body.pinOrder;
      } else {
        const { count } = await supabase
          .from('guestbook_postcards')
          .select('*', { count: 'exact', head: true })
          .eq('is_pinned', true);
        updates.pin_order = (count ?? 0) + 1;
      }
    } else if (body.pinOrder !== undefined) {
      updates.pin_order = typeof body.pinOrder === 'number' ? body.pinOrder : null;
    }

    if (typeof body.isHidden === 'boolean') {
      updates.is_hidden = body.isHidden;
    }

    const { error: updErr } = await supabase
      .from('guestbook_postcards')
      .update(updates)
      .eq('id', id);

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    const { data } = await supabase
      .from('guestbook_postcards')
      .select('*')
      .order('created_at', { ascending: false });

    const mapped = ((data as PostcardRow[]) || []).map(mapPostcardRow);
    return NextResponse.json({ postcards: sortPostcardsForBoard(mapped) });
  } catch (err) {
    console.error('[PATCH /api/admin/postcards]', err);
    return NextResponse.json({ error: 'Payload tidak valid.' }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(`admin-postcards:${ip}`, 40, 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Terlalu banyak permintaan.' }, { status: 429 });
  }

  const { supabase, user, error } = await requireAdminUser();
  if (error || !supabase || !user) {
    return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get('id')?.trim() || '';
  if (!id || !isValidRecordId(id)) {
    return NextResponse.json({ error: 'ID postcard tidak valid.' }, { status: 400 });
  }

  const { error: delErr } = await supabase
    .from('guestbook_postcards')
    .delete()
    .eq('id', id);

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ deletedId: id });
}