import { NextRequest, NextResponse } from 'next/server';
import {
  getPrimaryAdminDb,
  requireAdminSession,
} from '@/lib/server/storagePool';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdminSession();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const accountId = typeof body.accountId === 'string' ? body.accountId.trim() : '';
    const sizeBytes = Math.max(0, Math.round(Number(body.sizeBytes) || 0));

    if (!accountId) {
      return NextResponse.json({ error: 'accountId wajib diisi.' }, { status: 400 });
    }

    const db = getPrimaryAdminDb();
    const { data: current } = await db
      .from('storage_accounts')
      .select('used_bytes, file_count')
      .eq('id', accountId)
      .maybeSingle();

    if (!current) {
      return NextResponse.json({ ok: false }, { status: 404 });
    }

    const nextUsed = Math.max(0, Number(current.used_bytes) || 0) + sizeBytes;
    const nextCount = Math.max(0, Number(current.file_count) || 0) + 1;

    await db
      .from('storage_accounts')
      .update({
        used_bytes: nextUsed,
        file_count: nextCount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', accountId);

    return NextResponse.json({ ok: true, usedBytes: nextUsed, fileCount: nextCount });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal mencatat kapasitas terpakai.' },
      { status: 500 }
    );
  }
}