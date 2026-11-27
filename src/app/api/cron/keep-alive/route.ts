import { NextRequest, NextResponse } from 'next/server';
import {
  ensurePrimaryStorageBootstrapped,
  getPrimaryAdminDb,
  pingStorageAccount,
  requireAdminSession,
} from '@/lib/server/storagePool';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function isAuthorizedKeepAlive(req: NextRequest): Promise<boolean> {
  const cronSecret = (process.env.CRON_SECRET || '').trim();
  const authHeader = (req.headers.get('authorization') || '').trim();
  const querySecret = (req.nextUrl.searchParams.get('secret') || '').trim();

  if (cronSecret) {
    if (authHeader === `Bearer ${cronSecret}` || querySecret === cronSecret) {
      return true;
    }
  }

  // Also allow logged-in admin to trigger Keep-Alive manually from Panel Admin
  const adminCheck = await requireAdminSession();
  return adminCheck.ok;
}

async function runKeepAlive(req: NextRequest) {
  try {
    const allowed = await isAuthorizedKeepAlive(req);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Unauthorized. Gunakan Bearer CRON_SECRET atau login sebagai admin.' },
        { status: 401 }
      );
    }

    const db = getPrimaryAdminDb();
    const { accounts } = await ensurePrimaryStorageBootstrapped(db);
    const nowIso = new Date().toISOString();

    // 1. Ping primary database explicitly so primary Supabase project stays awake
    const { error: dbPingErr } = await db
      .from('vinyl_records')
      .select('id')
      .limit(1);

    // 2. Ping every enabled storage account (Supabase Storage & Backblaze B2)
    const results: Array<{
      id: string;
      name: string;
      provider: string;
      ok: boolean;
      status: string;
    }> = [];

    for (const acc of accounts) {
      if (!acc.is_enabled) continue;
      const ping = await pingStorageAccount(acc);

      await db
        .from('storage_accounts')
        .update({
          last_ping_at: nowIso,
          last_ping_status: ping.statusText,
          updated_at: nowIso,
        })
        .eq('id', acc.id);

      results.push({
        id: acc.id,
        name: acc.name,
        provider: acc.provider,
        ok: ping.ok,
        status: ping.statusText,
      });
    }

    await db
      .from('storage_settings')
      .upsert({ id: 1, last_keepalive_at: nowIso, updated_at: nowIso }, { onConflict: 'id' });

    const okCount = results.filter((r) => r.ok).length;

    return NextResponse.json({
      ok: !dbPingErr && okCount === results.length,
      timestamp: nowIso,
      primaryDatabase: dbPingErr ? `Error: ${dbPingErr.message}` : 'Online',
      pingedCount: results.length,
      healthyCount: okCount,
      accounts: results,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Keep-alive gagal dijalankan.' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return runKeepAlive(req);
}

export async function POST(req: NextRequest) {
  return runKeepAlive(req);
}