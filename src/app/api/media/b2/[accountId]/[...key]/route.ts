import { NextRequest, NextResponse } from 'next/server';
import {
  createB2PresignedReadUrl,
  getPrimaryAdminDb,
  resolveAccountCredentials,
  StorageAccountRow,
} from '@/lib/server/storagePool';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ACCOUNT_CACHE_TTL_MS = 60_000;
const accountCache = new Map<string, { row: StorageAccountRow; expiresAt: number }>();

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Range, Content-Type',
};

async function getB2AccountById(accountId: string): Promise<StorageAccountRow | null> {
  const now = Date.now();
  const cached = accountCache.get(accountId);
  if (cached && cached.expiresAt > now) {
    return cached.row;
  }

  const db = getPrimaryAdminDb();
  const { data, error } = await db
    .from('storage_accounts')
    .select('*')
    .eq('id', accountId)
    .eq('provider', 'b2')
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as StorageAccountRow;
  accountCache.set(accountId, { row, expiresAt: now + ACCOUNT_CACHE_TTL_MS });
  return row;
}

async function handleB2MediaRequest(
  method: 'GET' | 'HEAD',
  context: { params: Promise<{ accountId: string; key: string[] }> }
) {
  try {
    const { accountId, key } = await context.params;
    const cleanAccountId = (accountId || '').trim();
    const segments = Array.isArray(key) ? key : [];

    if (!cleanAccountId || segments.length === 0) {
      return NextResponse.json(
        { error: 'Parameter media tidak valid.' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const hasUnsafeSegment = segments.some(
      (seg) => !seg || seg === '.' || seg === '..' || seg.includes('\\')
    );
    if (hasUnsafeSegment) {
      return NextResponse.json(
        { error: 'Path media tidak diizinkan.' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const account = await getB2AccountById(cleanAccountId);
    if (!account) {
      return NextResponse.json(
        { error: 'Akun Backblaze B2 tidak ditemukan.' },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const creds = resolveAccountCredentials(account);
    if (!creds.endpointUrl || !creds.accessKeyId || !creds.secret || !creds.bucket) {
      return NextResponse.json(
        { error: 'Konfigurasi Backblaze B2 belum lengkap.' },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const objectKey = segments.join('/');
    const signedUrl = createB2PresignedReadUrl({
      endpointUrl: creds.endpointUrl,
      bucket: creds.bucket,
      objectKey,
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secret,
      method,
      expiresSec: 3600,
    });

    return new NextResponse(null, {
      status: 302,
      headers: {
        ...CORS_HEADERS,
        Location: signedUrl,
        'Cache-Control': 'public, max-age=1800, s-maxage=1800',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal mengakses media Backblaze B2.' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ accountId: string; key: string[] }> }
) {
  return handleB2MediaRequest('GET', context);
}

export async function HEAD(
  _req: NextRequest,
  context: { params: Promise<{ accountId: string; key: string[] }> }
) {
  return handleB2MediaRequest('HEAD', context);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}