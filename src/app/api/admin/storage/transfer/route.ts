import { NextRequest, NextResponse } from 'next/server';
import {
  getPrimaryAdminDb,
  listAccountFilesWithContext,
  refreshAccountsUsageByIds,
  requireAdminSession,
  transferSingleStorageFile,
} from '@/lib/server/storagePool';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

function cleanStr(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

/**
 * GET /api/admin/storage/transfer?sourceId=<accountId>
 * Mengambil daftar file di bucket asal lengkap dengan label konteks (Vinyl/Track/Poster/Profil).
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdminSession();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const sourceId = cleanStr(req.nextUrl.searchParams.get('sourceId'), 80);
    if (!sourceId) {
      return NextResponse.json({ error: 'Parameter sourceId wajib diisi.' }, { status: 400 });
    }

    const db = getPrimaryAdminDb();
    const listing = await listAccountFilesWithContext(db, sourceId);
    return NextResponse.json(listing);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal memuat daftar file penyimpanan.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/storage/transfer
 * - action: 'transfer_file' -> Transfer 1 file server-to-server (move / copy)
 * - action: 'finalize'      -> Refresh kuota & jumlah file akun asal dan tujuan setelah batch selesai
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdminSession();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = cleanStr(body.action, 32) || 'transfer_file';
    const sourceAccountId = cleanStr(body.sourceAccountId, 80);
    const targetAccountId = cleanStr(body.targetAccountId, 80);

    const db = getPrimaryAdminDb();

    if (action === 'finalize') {
      const overview = await refreshAccountsUsageByIds(db, [sourceAccountId, targetAccountId]);
      return NextResponse.json({ ok: true, overview });
    }

    const objectKey = cleanStr(body.objectKey, 600);
    const mode = body.mode === 'copy' ? 'copy' : 'move';
    const updateReferences = Boolean(body.updateReferences);

    if (!sourceAccountId || !targetAccountId || !objectKey) {
      return NextResponse.json(
        { error: 'sourceAccountId, targetAccountId, dan objectKey wajib diisi.' },
        { status: 400 }
      );
    }

    const result = await transferSingleStorageFile(db, {
      sourceAccountId,
      targetAccountId,
      objectKey,
      mode,
      updateReferences,
      appOrigin: req.nextUrl.origin,
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal memproses transfer file.' },
      { status: 500 }
    );
  }
}