import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  buildStorageOverview,
  encryptSecret,
  ensurePrimaryStorageBootstrapped,
  getPrimaryAdminDb,
  normalizeR2Endpoint,
  pingStorageAccount,
  requireAdminSession,
  scanAccountUsage,
  StorageAccountRow,
  StorageProvider,
} from '@/lib/server/storagePool';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function cleanStr(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

export async function GET() {
  try {
    const auth = await requireAdminSession();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const db = getPrimaryAdminDb();
    const { accounts, settings } = await ensurePrimaryStorageBootstrapped(db);

    // Auto-scan once if primary account has never been scanned yet
    const primary = accounts.find((a) => a.use_env_credentials && !a.last_scanned_at);
    if (primary) {
      try {
        const scanned = await scanAccountUsage(primary);
        const nowIso = new Date().toISOString();
        const { data: updated } = await db
          .from('storage_accounts')
          .update({
            used_bytes: scanned.usedBytes,
            file_count: scanned.fileCount,
            last_scanned_at: nowIso,
            last_ping_at: nowIso,
            last_ping_status: 'Online (Active)',
            updated_at: nowIso,
          })
          .eq('id', primary.id)
          .select('*')
          .single();

        if (updated) {
          const idx = accounts.findIndex((a) => a.id === primary.id);
          if (idx >= 0) accounts[idx] = updated as StorageAccountRow;
        }
      } catch {
        // Non-fatal on initial load
      }
    }

    return NextResponse.json(buildStorageOverview(accounts, settings));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal memuat status penyimpanan.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdminSession();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const name = cleanStr(body.name, 80);
    const provider = (body.provider === 'r2' ? 'r2' : 'supabase') as StorageProvider;
    const bucket = cleanStr(body.bucket, 80) || 'orihour-media';
    const rawEndpoint = cleanStr(body.endpointUrl, 300);
    const endpointUrl =
      provider === 'r2'
        ? normalizeR2Endpoint(rawEndpoint)
        : rawEndpoint.replace(/\/+$/, '');
    const publicBaseUrl =
      provider === 'r2'
        ? cleanStr(body.publicBaseUrl, 300).replace(/\/+$/, '')
        : endpointUrl;
    const accessKeyId = provider === 'r2' ? cleanStr(body.accessKeyId, 160) : '';
    const secret = cleanStr(body.secret, 500);
    const defaultQuotaMb = provider === 'r2' ? 10240 : 1024;
    const quotaMb = Math.max(
      10,
      Math.min(1048576, Math.round(Number(body.quotaMb) || defaultQuotaMb))
    );
    const priority = Math.max(1, Math.min(999, Math.round(Number(body.priority) || 10)));
    const setAsActive = Boolean(body.setAsActive);

    if (!name) {
      return NextResponse.json({ error: 'Nama akun penyimpanan wajib diisi.' }, { status: 400 });
    }
    if (!endpointUrl || !/^https?:\/\//i.test(endpointUrl)) {
      return NextResponse.json(
        {
          error:
            provider === 'r2'
              ? 'Account ID atau Endpoint Cloudflare R2 tidak valid.'
              : 'URL Proyek Supabase wajib diawali https://',
        },
        { status: 400 }
      );
    }
    if (!secret) {
      return NextResponse.json(
        {
          error:
            provider === 'r2'
              ? 'Secret Access Key Cloudflare R2 wajib diisi.'
              : 'Service Role Key Supabase wajib diisi.',
        },
        { status: 400 }
      );
    }
    if (provider === 'r2' && (!accessKeyId || !publicBaseUrl || !/^https?:\/\//i.test(publicBaseUrl))) {
      return NextResponse.json(
        {
          error:
            'Cloudflare R2 membutuhkan Access Key ID dan Public Domain URL (misal: https://pub-xxxx.r2.dev).',
        },
        { status: 400 }
      );
    }

    const db = getPrimaryAdminDb();
    await ensurePrimaryStorageBootstrapped(db);

    const id = `stg-${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
    const nowIso = new Date().toISOString();

    const candidateRow: StorageAccountRow = {
      id,
      name,
      provider,
      is_active: setAsActive,
      is_enabled: true,
      use_env_credentials: false,
      priority,
      bucket,
      endpoint_url: endpointUrl,
      public_base_url: publicBaseUrl,
      access_key_id: accessKeyId,
      encrypted_secret: encryptSecret(secret),
      quota_mb: quotaMb,
      used_bytes: 0,
      file_count: 0,
      last_scanned_at: null,
      last_ping_at: null,
      last_ping_status: 'idle',
      created_at: nowIso,
      updated_at: nowIso,
    };

    // Verify connection immediately before saving
    const ping = await pingStorageAccount(candidateRow);
    if (!ping.ok) {
      return NextResponse.json(
        {
          error: `Koneksi ke "${name}" gagal diverifikasi (${ping.statusText}). Periksa URL, nama bucket, dan kunci akses.`,
        },
        { status: 400 }
      );
    }

    // Try initial usage scan
    let usedBytes = 0;
    let fileCount = 0;
    let lastScannedAt: string | null = null;
    try {
      const scanned = await scanAccountUsage(candidateRow);
      usedBytes = scanned.usedBytes;
      fileCount = scanned.fileCount;
      lastScannedAt = nowIso;
    } catch {
      // Allow creation even if initial scan times out
    }

    if (setAsActive) {
      await db.from('storage_accounts').update({ is_active: false }).neq('id', id);
    }

    const { error: insertErr } = await db.from('storage_accounts').insert({
      ...candidateRow,
      used_bytes: usedBytes,
      file_count: fileCount,
      last_scanned_at: lastScannedAt,
      last_ping_at: nowIso,
      last_ping_status: ping.statusText,
    });

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    const { accounts, settings } = await ensurePrimaryStorageBootstrapped(db);
    return NextResponse.json(buildStorageOverview(accounts, settings), { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal menambah akun penyimpanan.' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAdminSession();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = cleanStr(body.action, 40);
    const db = getPrimaryAdminDb();
    const { accounts, settings } = await ensurePrimaryStorageBootstrapped(db);
    const nowIso = new Date().toISOString();

    // 1. Update global pool settings (Auto-Failover & Warning Thresholds)
    if (action === 'update_settings') {
      const autoFailover =
        typeof body.autoFailover === 'boolean' ? body.autoFailover : settings.auto_failover;
      const warnPct = Math.max(
        30,
        Math.min(95, Math.round(Number(body.warnThresholdPct) || settings.warn_threshold_pct))
      );
      const fullPct = Math.max(
        warnPct + 2,
        Math.min(100, Math.round(Number(body.fullThresholdPct) || settings.full_threshold_pct))
      );

      const { error } = await db
        .from('storage_settings')
        .upsert(
          {
            id: 1,
            auto_failover: autoFailover,
            warn_threshold_pct: warnPct,
            full_threshold_pct: fullPct,
            updated_at: nowIso,
          },
          { onConflict: 'id' }
        );

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      const fresh = await ensurePrimaryStorageBootstrapped(db);
      return NextResponse.json(buildStorageOverview(fresh.accounts, fresh.settings));
    }

    // 2. Switch active storage account manually
    if (action === 'set_active') {
      const id = cleanStr(body.id, 80);
      const target = accounts.find((a) => a.id === id);
      if (!target) {
        return NextResponse.json({ error: 'Akun penyimpanan tidak ditemukan.' }, { status: 404 });
      }

      await db.from('storage_accounts').update({ is_active: false }).neq('id', id);
      const { error } = await db
        .from('storage_accounts')
        .update({ is_active: true, is_enabled: true, updated_at: nowIso })
        .eq('id', id);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      const fresh = await ensurePrimaryStorageBootstrapped(db);
      return NextResponse.json(buildStorageOverview(fresh.accounts, fresh.settings));
    }

    // 3. Scan Real Usage for one account or all accounts
    if (action === 'scan_usage') {
      const id = cleanStr(body.id, 80);
      const targets = id ? accounts.filter((a) => a.id === id) : accounts.filter((a) => a.is_enabled);
      if (targets.length === 0) {
        return NextResponse.json({ error: 'Tidak ada akun untuk dipindai.' }, { status: 404 });
      }

      const errors: string[] = [];
      for (const acc of targets) {
        try {
          const scanned = await scanAccountUsage(acc);
          await db
            .from('storage_accounts')
            .update({
              used_bytes: scanned.usedBytes,
              file_count: scanned.fileCount,
              last_scanned_at: nowIso,
              last_ping_at: nowIso,
              last_ping_status: acc.provider === 'r2' ? 'Online (R2 Ready)' : 'Online (Active)',
              updated_at: nowIso,
            })
            .eq('id', acc.id);
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Scan gagal';
          errors.push(`${acc.name}: ${msg}`);
          await db
            .from('storage_accounts')
            .update({
              last_ping_at: nowIso,
              last_ping_status: `Error: ${msg.slice(0, 70)}`,
              updated_at: nowIso,
            })
            .eq('id', acc.id);
        }
      }

      const fresh = await ensurePrimaryStorageBootstrapped(db);
      return NextResponse.json({
        ...buildStorageOverview(fresh.accounts, fresh.settings),
        scanErrors: errors,
      });
    }

    // 4. Edit existing storage account details
    if (action === 'update_account') {
      const id = cleanStr(body.id, 80);
      const existing = accounts.find((a) => a.id === id);
      if (!existing) {
        return NextResponse.json({ error: 'Akun penyimpanan tidak ditemukan.' }, { status: 404 });
      }

      const patch: Record<string, unknown> = { updated_at: nowIso };
      if ('name' in body) {
        const name = cleanStr(body.name, 80);
        if (name) patch.name = name;
      }
      if ('quotaMb' in body) {
        patch.quota_mb = Math.max(10, Math.min(1048576, Math.round(Number(body.quotaMb) || 1024)));
      }
      if ('priority' in body) {
        patch.priority = Math.max(1, Math.min(999, Math.round(Number(body.priority) || 10)));
      }
      if ('isEnabled' in body && typeof body.isEnabled === 'boolean') {
        patch.is_enabled = body.isEnabled;
      }
      if (!existing.use_env_credentials) {
        if ('bucket' in body) {
          const bucket = cleanStr(body.bucket, 80);
          if (bucket) patch.bucket = bucket;
        }
        if ('endpointUrl' in body) {
          const rawEp = cleanStr(body.endpointUrl, 300);
          if (rawEp) {
            patch.endpoint_url =
              existing.provider === 'r2'
                ? normalizeR2Endpoint(rawEp)
                : rawEp.replace(/\/+$/, '');
            if (existing.provider === 'supabase') {
              patch.public_base_url = patch.endpoint_url;
            }
          }
        }
        if ('publicBaseUrl' in body && existing.provider === 'r2') {
          const pub = cleanStr(body.publicBaseUrl, 300).replace(/\/+$/, '');
          if (pub) patch.public_base_url = pub;
        }
        if ('accessKeyId' in body && existing.provider === 'r2') {
          const ak = cleanStr(body.accessKeyId, 160);
          if (ak) patch.access_key_id = ak;
        }
        if ('secret' in body) {
          const newSecret = cleanStr(body.secret, 500);
          if (newSecret) {
            patch.encrypted_secret = encryptSecret(newSecret);
          }
        }
      }

      const { error } = await db.from('storage_accounts').update(patch).eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const fresh = await ensurePrimaryStorageBootstrapped(db);
      return NextResponse.json(buildStorageOverview(fresh.accounts, fresh.settings));
    }

    return NextResponse.json({ error: 'Aksi tidak dikenali.' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal memperbarui penyimpanan.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdminSession();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const id = cleanStr(req.nextUrl.searchParams.get('id'), 80);
    if (!id) {
      return NextResponse.json({ error: 'ID akun tidak valid.' }, { status: 400 });
    }

    const db = getPrimaryAdminDb();
    const { accounts } = await ensurePrimaryStorageBootstrapped(db);
    const target = accounts.find((a) => a.id === id);

    if (!target) {
      return NextResponse.json({ error: 'Akun penyimpanan tidak ditemukan.' }, { status: 404 });
    }
    if (target.use_env_credentials) {
      return NextResponse.json(
        { error: 'Akun Supabase Utama (.env) tidak dapat dihapus. Kamu bisa menonaktifkannya atau memindahkan akun aktif ke akun lain.' },
        { status: 400 }
      );
    }

    const { error } = await db.from('storage_accounts').delete().eq('id', id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If deleted account was active, promote the highest-priority remaining enabled account
    if (target.is_active) {
      const remaining = accounts.filter((a) => a.id !== id && a.is_enabled);
      if (remaining[0]) {
        await db
          .from('storage_accounts')
          .update({ is_active: true })
          .eq('id', remaining[0].id);
      }
    }

    const fresh = await ensurePrimaryStorageBootstrapped(db);
    return NextResponse.json(buildStorageOverview(fresh.accounts, fresh.settings));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal menghapus akun penyimpanan.' },
      { status: 500 }
    );
  }
}