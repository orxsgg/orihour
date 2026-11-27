import { NextRequest, NextResponse } from 'next/server';
import {
  ensurePrimaryStorageBootstrapped,
  generatePresignedUploadForAccount,
  getPrimaryAdminDb,
  requireAdminSession,
  selectUploadTargetAccount,
} from '@/lib/server/storagePool';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function sanitizeSegment(raw: string, fallback: string, maxLen: number): string {
  const cleaned = (raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLen);
  return cleaned || fallback;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdminSession();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const folder = sanitizeSegment(String(body.folder || 'misc'), 'misc', 32);
    const baseName = sanitizeSegment(String(body.baseName || 'media'), 'media', 56);
    const extension = sanitizeSegment(String(body.extension || 'bin'), 'bin', 12);
    const sizeBytes = Math.max(0, Math.round(Number(body.sizeBytes) || 0));

    const db = getPrimaryAdminDb();
    const { accounts, settings } = await ensurePrimaryStorageBootstrapped(db);

    const selection = selectUploadTargetAccount(accounts, settings, sizeBytes);
    if (!selection.target) {
      return NextResponse.json(
        { error: selection.error || 'Penyimpanan penuh.' },
        { status: 507 }
      );
    }

    const target = selection.target;

    // If Auto-Failover switched to a backup account, automatically promote it to Active
    if (selection.didFailover) {
      await db.from('storage_accounts').update({ is_active: false }).neq('id', target.id);
      await db
        .from('storage_accounts')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('id', target.id);
    }

    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const objectKey = `${folder}/${baseName}-${uniqueSuffix}.${extension}`;

    const presigned = await generatePresignedUploadForAccount({
      account: target,
      objectKey,
    });

    const quotaBytes = Math.max(1, Number(target.quota_mb) || 1024) * 1024 * 1024;
    const projectedPct = Number(
      (((Math.max(0, Number(target.used_bytes) || 0) + sizeBytes) / quotaBytes) * 100).toFixed(1)
    );

    return NextResponse.json({
      accountId: target.id,
      accountName: target.name,
      provider: presigned.provider,
      uploadUrl: presigned.uploadUrl,
      publicUrl: presigned.publicUrl,
      objectKey: presigned.objectKey,
      didFailover: selection.didFailover,
      failoverFromName: selection.failoverFromName,
      projectedUsagePct: projectedPct,
      nearLimitWarning: projectedPct >= settings.warn_threshold_pct,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal menyiapkan URL unggahan media.' },
      { status: 500 }
    );
  }
}