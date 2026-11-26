import { NextRequest, NextResponse } from 'next/server';
import { normalizeGenre } from '@/lib/genreUtils';
import {
  checkRateLimit,
  getClientIp,
  isValidRecordId,
  sanitizePlainText,
} from '@/lib/security';
import { requireAdminUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { supabase, user, error } = await requireAdminUser();
  if (error || !supabase || !user) {
    return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
  }

  const { data, error: dbErr } = await supabase
    .from('genres')
    .select('id, name')
    .order('name', { ascending: true });

  if (dbErr) {
    return NextResponse.json({ error: dbErr.message }, { status: 500 });
  }

  return NextResponse.json({ genres: data || [] });
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(`admin-genres:${ip}`, 40, 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Terlalu banyak permintaan.' }, { status: 429 });
  }

  const { supabase, user, error } = await requireAdminUser();
  if (error || !supabase || !user) {
    return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const rawName = sanitizePlainText(body?.name, 40);
    if (!rawName) {
      return NextResponse.json({ error: 'Nama genre tidak boleh kosong.' }, { status: 400 });
    }

    const { data: existingRows } = await supabase.from('genres').select('name');
    const existingNames = (existingRows || []).map((r) => String(r.name || ''));
    const canonical = normalizeGenre(rawName, existingNames);

    const { error: upsertErr } = await supabase
      .from('genres')
      .upsert({ name: canonical }, { onConflict: 'name' });

    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }

    const { data: updated } = await supabase
      .from('genres')
      .select('id, name')
      .order('name', { ascending: true });

    return NextResponse.json({ genre: canonical, genres: updated || [] });
  } catch {
    return NextResponse.json({ error: 'Payload tidak valid.' }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(`admin-genres:${ip}`, 40, 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Terlalu banyak permintaan.' }, { status: 429 });
  }

  const { supabase, user, error } = await requireAdminUser();
  if (error || !supabase || !user) {
    return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get('id')?.trim() || '';
  if (!id || !isValidRecordId(id)) {
    return NextResponse.json({ error: 'ID genre tidak valid.' }, { status: 400 });
  }

  const { error: delErr } = await supabase.from('genres').delete().eq('id', id);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  const { data: updated } = await supabase
    .from('genres')
    .select('id, name')
    .order('name', { ascending: true });

  return NextResponse.json({ deletedId: id, genres: updated || [] });
}