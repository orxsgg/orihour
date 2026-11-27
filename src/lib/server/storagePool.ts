import crypto from 'crypto';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export type StorageProvider = 'supabase' | 'b2';

export interface StorageAccountRow {
  id: string;
  name: string;
  provider: StorageProvider;
  is_active: boolean;
  is_enabled: boolean;
  use_env_credentials: boolean;
  priority: number;
  bucket: string;
  endpoint_url: string;
  public_base_url: string;
  access_key_id: string;
  encrypted_secret: string;
  quota_mb: number;
  used_bytes: number;
  file_count: number;
  last_scanned_at: string | null;
  last_ping_at: string | null;
  last_ping_status: string;
  created_at: string;
  updated_at: string;
}

export interface StorageSettingsRow {
  id: number;
  auto_failover: boolean;
  warn_threshold_pct: number;
  full_threshold_pct: number;
  last_keepalive_at: string | null;
  updated_at: string;
}

export type StorageHealthStatus = 'ok' | 'warning' | 'full' | 'disabled';

export interface PublicStorageAccount {
  id: string;
  name: string;
  provider: StorageProvider;
  isActive: boolean;
  isEnabled: boolean;
  useEnvCredentials: boolean;
  priority: number;
  bucket: string;
  endpointUrl: string;
  publicBaseUrl: string;
  accessKeyId: string;
  hasSecret: boolean;
  secretPreview: string;
  quotaMb: number;
  usedBytes: number;
  fileCount: number;
  usagePct: number;
  remainingBytes: number;
  healthStatus: StorageHealthStatus;
  lastScannedAt: string | null;
  lastPingAt: string | null;
  lastPingStatus: string;
  createdAt: string;
}

export interface PublicStorageSettings {
  autoFailover: boolean;
  warnThresholdPct: number;
  fullThresholdPct: number;
  lastKeepaliveAt: string | null;
}

export interface StoragePoolOverview {
  accounts: PublicStorageAccount[];
  settings: PublicStorageSettings;
  activeAccountId: string | null;
  hasWarning: boolean;
  hasFull: boolean;
  warningMessage: string | null;
  warningSeverity: 'none' | 'warning' | 'full';
}

export interface OrphanAccountSummary {
  accountId: string;
  accountName: string;
  provider: StorageProvider;
  orphanCount: number;
  orphanBytes: number;
  deletedCount: number;
  deletedBytes: number;
  error?: string;
}

export interface OrphanCleanupResult {
  dryRun: boolean;
  totalOrphanCount: number;
  totalOrphanBytes: number;
  totalDeletedCount: number;
  totalDeletedBytes: number;
  byAccount: OrphanAccountSummary[];
}

export function getPrimaryAdminDb(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib tersedia di environment variables.'
    );
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export async function requireAdminSession() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();

  if (!url || !anonKey) {
    return {
      ok: false as const,
      status: 500 as const,
      error: 'Supabase belum dikonfigurasi.',
    };
  }

  const cookieStore = await cookies();
  const sessionClient = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Ignore write in read-only contexts
        }
      },
    },
  });

  const {
    data: { user },
  } = await sessionClient.auth.getUser();

  if (!user) {
    return {
      ok: false as const,
      status: 401 as const,
      error: 'Unauthorized. Silakan login sebagai admin.',
    };
  }

  if (adminEmail && (user.email || '').toLowerCase() !== adminEmail) {
    return {
      ok: false as const,
      status: 403 as const,
      error: 'Forbidden. Akun tidak memiliki akses admin.',
    };
  }

  return { ok: true as const, status: 200 as const, user };
}

/* ============================================================
   AES-256-GCM Secret Encryption for Secondary Account Keys
   ============================================================ */

function getEncryptionKey(): Buffer {
  const seed =
    process.env.STORAGE_ENCRYPTION_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'orihour-local-dev-storage-key';
  return crypto.createHash('sha256').update(seed).digest();
}

export function encryptSecret(plain: string): string {
  const clean = plain.trim();
  if (!clean) return '';
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(clean, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(stored: string): string {
  if (!stored) return '';
  if (!stored.startsWith('enc:v1:')) return stored;
  const parts = stored.split(':');
  if (parts.length !== 5) return '';
  try {
    const iv = Buffer.from(parts[2], 'hex');
    const tag = Buffer.from(parts[3], 'hex');
    const data = Buffer.from(parts[4], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

export function maskSecret(plain: string): string {
  if (!plain) return '';
  if (plain.length <= 6) return '••••••';
  return `••••••••${plain.slice(-4)}`;
}

/* ============================================================
   Backblaze B2 Endpoint & Region Normalization
   ============================================================ */

export function normalizeB2Endpoint(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProto);
    const host = parsed.hostname.toLowerCase();
    const b2Match = host.match(/(?:^|\.)s3\.([a-z0-9-]+)\.backblazeb2\.com$/i);
    if (b2Match?.[1]) {
      return `https://s3.${b2Match[1]}.backblazeb2.com`;
    }
    return parsed.origin;
  } catch {
    return withProto;
  }
}

export function extractB2Region(endpointUrl: string): string {
  try {
    const host = new URL(endpointUrl).hostname.toLowerCase();
    const match = host.match(/(?:^|\.)s3\.([a-z0-9-]+)\.backblazeb2\.com$/i);
    if (match?.[1]) return match[1];
  } catch {
    // Fallback below
  }
  return 'us-west-004';
}

export function resolveAccountCredentials(row: StorageAccountRow) {
  if (row.use_env_credentials && row.provider === 'supabase') {
    const envUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
    const envSecret = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    return {
      endpointUrl: envUrl,
      publicBaseUrl: envUrl,
      accessKeyId: '',
      secret: envSecret,
      bucket: row.bucket || 'orihour-media',
    };
  }

  const endpointUrl = (row.endpoint_url || '').replace(/\/+$/, '');
  const bucket = (row.bucket || 'orihour-media').trim();
  const explicitPublic = (row.public_base_url || '').replace(/\/+$/, '');
  const publicBaseUrl = row.provider === 'b2' ? explicitPublic : endpointUrl;

  return {
    endpointUrl,
    publicBaseUrl,
    accessKeyId: (row.access_key_id || '').trim(),
    secret: decryptSecret(row.encrypted_secret || ''),
    bucket,
  };
}

/* ============================================================
   Bootstrap Primary Env Supabase Account & Read Pool State
   ============================================================ */

export async function ensurePrimaryStorageBootstrapped(db: SupabaseClient) {
  const { data: settingsData, error: settingsErr } = await db
    .from('storage_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (settingsErr) {
    throw new Error(
      `Tabel storage_settings/storage_accounts belum siap. Jalankan migrasi SQL dulu. (${settingsErr.message})`
    );
  }

  let settings: StorageSettingsRow = settingsData || {
    id: 1,
    auto_failover: true,
    warn_threshold_pct: 80,
    full_threshold_pct: 95,
    last_keepalive_at: null,
    updated_at: new Date().toISOString(),
  };

  if (!settingsData) {
    const { data: inserted } = await db
      .from('storage_settings')
      .upsert(
        { id: 1, auto_failover: true, warn_threshold_pct: 80, full_threshold_pct: 95 },
        { onConflict: 'id' }
      )
      .select('*')
      .single();
    if (inserted) settings = inserted;
  }

  const { data: existingRows, error: accErr } = await db
    .from('storage_accounts')
    .select('*')
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true });

  if (accErr) {
    throw new Error(accErr.message);
  }

  let accounts: StorageAccountRow[] = (existingRows || []) as StorageAccountRow[];

  if (accounts.length === 0) {
    const primaryUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
    const primaryRow = {
      id: 'primary-supabase',
      name: 'Supabase Utama (Env)',
      provider: 'supabase' as StorageProvider,
      is_active: true,
      is_enabled: true,
      use_env_credentials: true,
      priority: 1,
      bucket: 'orihour-media',
      endpoint_url: primaryUrl,
      public_base_url: primaryUrl,
      access_key_id: '',
      encrypted_secret: '',
      quota_mb: 1024,
      used_bytes: 0,
      file_count: 0,
      last_ping_status: 'ok',
    };

    const { data: seeded, error: seedErr } = await db
      .from('storage_accounts')
      .upsert(primaryRow, { onConflict: 'id' })
      .select('*')
      .single();

    if (seedErr) {
      throw new Error(seedErr.message);
    }
    if (seeded) {
      accounts = [seeded as StorageAccountRow];
    }
  }

  return { accounts, settings };
}

export function mapAccountToPublic(
  row: StorageAccountRow,
  settings: StorageSettingsRow
): PublicStorageAccount {
  const quotaMb = Math.max(1, Number(row.quota_mb) || 1024);
  const quotaBytes = quotaMb * 1024 * 1024;
  const usedBytes = Math.max(0, Number(row.used_bytes) || 0);
  const usagePct = Number(((usedBytes / quotaBytes) * 100).toFixed(1));
  const remainingBytes = Math.max(0, quotaBytes - usedBytes);
  const creds = resolveAccountCredentials(row);

  let healthStatus: StorageHealthStatus = 'ok';
  if (!row.is_enabled) {
    healthStatus = 'disabled';
  } else if (usagePct >= settings.full_threshold_pct) {
    healthStatus = 'full';
  } else if (usagePct >= settings.warn_threshold_pct) {
    healthStatus = 'warning';
  }

  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    isActive: Boolean(row.is_active),
    isEnabled: Boolean(row.is_enabled),
    useEnvCredentials: Boolean(row.use_env_credentials),
    priority: Number(row.priority) || 10,
    bucket: creds.bucket,
    endpointUrl: creds.endpointUrl,
    publicBaseUrl: creds.publicBaseUrl,
    accessKeyId: creds.accessKeyId,
    hasSecret: Boolean(creds.secret),
    secretPreview: row.use_env_credentials
      ? 'Env Server (.env)'
      : maskSecret(creds.secret),
    quotaMb,
    usedBytes,
    fileCount: Math.max(0, Number(row.file_count) || 0),
    usagePct,
    remainingBytes,
    healthStatus,
    lastScannedAt: row.last_scanned_at,
    lastPingAt: row.last_ping_at,
    lastPingStatus: row.last_ping_status || 'idle',
    createdAt: row.created_at,
  };
}

export function buildStorageOverview(
  rows: StorageAccountRow[],
  settings: StorageSettingsRow
): StoragePoolOverview {
  const accounts = rows.map((r) => mapAccountToPublic(r, settings));
  const activeAcc = accounts.find((a) => a.isActive) || null;
  const enabledAccounts = accounts.filter((a) => a.isEnabled);
  const allEnabledFull =
    enabledAccounts.length > 0 && enabledAccounts.every((a) => a.healthStatus === 'full');
  const anyFull = accounts.some((a) => a.isEnabled && a.healthStatus === 'full');
  const anyWarning = accounts.some((a) => a.isEnabled && a.healthStatus === 'warning');

  let warningSeverity: 'none' | 'warning' | 'full' = 'none';
  let warningMessage: string | null = null;

  if (enabledAccounts.length === 0) {
    warningSeverity = 'full';
    warningMessage =
      'Tidak ada akun penyimpanan yang aktif. Aktifkan atau tambahkan akun Supabase / Backblaze B2 di tab Penyimpanan.';
  } else if (allEnabledFull) {
    warningSeverity = 'full';
    warningMessage =
      'Semua akun penyimpanan sudah mencapai batas penuh! Tambahkan akun Supabase baru atau Backblaze B2 (10 GB gratis tanpa kartu kredit) agar upload tidak terhambat.';
  } else if (activeAcc && activeAcc.healthStatus === 'full') {
    warningSeverity = 'full';
    warningMessage = settings.auto_failover
      ? `Penyimpanan aktif "${activeAcc.name}" sudah penuh (${activeAcc.usagePct}%). Upload berikutnya otomatis dialihkan (Auto-Failover) ke akun cadangan.`
      : `Penyimpanan aktif "${activeAcc.name}" sudah penuh (${activeAcc.usagePct}%). Pindahkan akun aktif atau aktifkan Auto-Failover di tab Penyimpanan.`;
  } else if (activeAcc && activeAcc.healthStatus === 'warning') {
    warningSeverity = 'warning';
    warningMessage = `Penyimpanan aktif "${activeAcc.name}" hampir penuh (${activeAcc.usagePct}% terpakai). Siapkan akun cadangan Supabase atau Backblaze B2.`;
  } else if (anyFull || anyWarning) {
    const flagged = accounts.find(
      (a) => a.isEnabled && (a.healthStatus === 'full' || a.healthStatus === 'warning')
    );
    if (flagged) {
      warningSeverity = 'warning';
      warningMessage = `Akun penyimpanan "${flagged.name}" sudah mencapai ${flagged.usagePct}% kuota.`;
    }
  }

  return {
    accounts,
    settings: {
      autoFailover: Boolean(settings.auto_failover),
      warnThresholdPct: Number(settings.warn_threshold_pct) || 80,
      fullThresholdPct: Number(settings.full_threshold_pct) || 95,
      lastKeepaliveAt: settings.last_keepalive_at,
    },
    activeAccountId: activeAcc?.id ?? null,
    hasWarning: anyWarning || anyFull,
    hasFull: anyFull || allEnabledFull,
    warningMessage,
    warningSeverity,
  };
}

/* ============================================================
   Native AWS Signature V4 (Backblaze B2 S3-Compatible API)
   Zero External Dependencies!
   ============================================================ */

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

function sha256Hex(data: string): string {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

function encodeRfc3986(str: string): string {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function encodeS3Path(pathStr: string): string {
  return pathStr
    .split('/')
    .map((seg) => encodeRfc3986(seg))
    .join('/');
}

function asciiCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function getSigV4Timestamps(now = new Date()) {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return {
    amzDate: iso,
    dateStamp: iso.slice(0, 8),
  };
}

function getSigningKey(
  secretAccessKey: string,
  dateStamp: string,
  region: string,
  service = 's3'
) {
  const kDate = hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  return hmacSha256(kService, 'aws4_request');
}

function createB2PresignedUrl(params: {
  method: 'PUT' | 'GET' | 'HEAD';
  endpointUrl: string;
  bucket: string;
  objectKey: string;
  accessKeyId: string;
  secretAccessKey: string;
  expiresSec: number;
}): string {
  const parsed = new URL(params.endpointUrl);
  const host = parsed.host;
  const region = extractB2Region(params.endpointUrl);
  const service = 's3';
  const { amzDate, dateStamp } = getSigV4Timestamps();

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalUri = `/${encodeRfc3986(params.bucket)}/${encodeS3Path(params.objectKey)}`;

  const queryPairs: [string, string][] = [
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', `${params.accessKeyId}/${credentialScope}`],
    ['X-Amz-Date', amzDate],
    ['X-Amz-Expires', String(params.expiresSec)],
    ['X-Amz-SignedHeaders', 'host'],
  ];

  const canonicalQuery = queryPairs
    .map(([k, v]): [string, string] => [encodeRfc3986(k), encodeRfc3986(v)])
    .sort((a, b) => asciiCompare(a[0], b[0]) || asciiCompare(a[1], b[1]))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  const canonicalHeaders = `host:${host}\n`;
  const canonicalRequest = [
    params.method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const signingKey = getSigningKey(params.secretAccessKey, dateStamp, region, service);
  const signature = crypto
    .createHmac('sha256', signingKey)
    .update(stringToSign, 'utf8')
    .digest('hex');

  return `${parsed.origin}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

export function createB2PresignedPutUrl(params: {
  endpointUrl: string;
  bucket: string;
  objectKey: string;
  accessKeyId: string;
  secretAccessKey: string;
  expiresSec?: number;
}): string {
  return createB2PresignedUrl({
    ...params,
    method: 'PUT',
    expiresSec: params.expiresSec ?? 900,
  });
}

export function createB2PresignedReadUrl(params: {
  endpointUrl: string;
  bucket: string;
  objectKey: string;
  accessKeyId: string;
  secretAccessKey: string;
  method?: 'GET' | 'HEAD';
  expiresSec?: number;
}): string {
  return createB2PresignedUrl({
    ...params,
    method: params.method === 'HEAD' ? 'HEAD' : 'GET',
    expiresSec: params.expiresSec ?? 3600,
  });
}

async function signedB2Request(params: {
  method: 'GET' | 'DELETE';
  endpointUrl: string;
  bucket: string;
  objectKey?: string;
  query?: Record<string, string | undefined>;
  accessKeyId: string;
  secretAccessKey: string;
}): Promise<Response> {
  const parsed = new URL(params.endpointUrl);
  const host = parsed.host;
  const region = extractB2Region(params.endpointUrl);
  const service = 's3';
  const { amzDate, dateStamp } = getSigV4Timestamps();
  const payloadHash = sha256Hex('');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalUri = params.objectKey
    ? `/${encodeRfc3986(params.bucket)}/${encodeS3Path(params.objectKey)}`
    : `/${encodeRfc3986(params.bucket)}`;

  const canonicalQuery = Object.entries(params.query || {})
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .map(([k, v]): [string, string] => [encodeRfc3986(k), encodeRfc3986(v)])
    .sort((a, b) => asciiCompare(a[0], b[0]) || asciiCompare(a[1], b[1]))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  const canonicalHeaders =
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

  const canonicalRequest = [
    params.method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const signingKey = getSigningKey(params.secretAccessKey, dateStamp, region, service);
  const signature = crypto
    .createHmac('sha256', signingKey)
    .update(stringToSign, 'utf8')
    .digest('hex');

  const authorization = `AWS4-HMAC-SHA256 Credential=${params.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const fullUrl = `${parsed.origin}${canonicalUri}${canonicalQuery ? `?${canonicalQuery}` : ''}`;

  return fetch(fullUrl, {
    method: params.method,
    headers: {
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      Authorization: authorization,
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

interface B2ObjectVersion {
  key: string;
  versionId: string;
  size: number;
  isDeleteMarker: boolean;
}

async function listB2ObjectVersions(
  creds: {
    endpointUrl: string;
    bucket: string;
    accessKeyId: string;
    secret: string;
  },
  prefix?: string
): Promise<B2ObjectVersion[]> {
  const results: B2ObjectVersion[] = [];
  let keyMarker = '';
  let versionIdMarker = '';
  let pages = 0;

  while (pages < 30) {
    pages += 1;
    const query: Record<string, string | undefined> = {
      versions: '',
      'max-keys': '1000',
    };
    if (prefix) query.prefix = prefix;
    if (keyMarker) query['key-marker'] = keyMarker;
    if (versionIdMarker) query['version-id-marker'] = versionIdMarker;

    const res = await signedB2Request({
      method: 'GET',
      endpointUrl: creds.endpointUrl,
      bucket: creds.bucket,
      query,
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secret,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Backblaze B2 ListVersions error (${res.status}): ${text.slice(0, 180)}`);
    }

    const xml = await res.text();

    const versionBlocks = xml.matchAll(/<Version>([\s\S]*?)<\/Version>/g);
    for (const m of versionBlocks) {
      const block = m[1];
      const keyM = block.match(/<Key>([\s\S]*?)<\/Key>/);
      const vidM = block.match(/<VersionId>([\s\S]*?)<\/VersionId>/);
      const sizeM = block.match(/<Size>(\d+)<\/Size>/);
      if (keyM?.[1]) {
        results.push({
          key: decodeXmlEntities(keyM[1]),
          versionId: vidM?.[1] ? decodeXmlEntities(vidM[1]) : '',
          size: Number(sizeM?.[1] || 0) || 0,
          isDeleteMarker: false,
        });
      }
    }

    const markerBlocks = xml.matchAll(/<DeleteMarker>([\s\S]*?)<\/DeleteMarker>/g);
    for (const m of markerBlocks) {
      const block = m[1];
      const keyM = block.match(/<Key>([\s\S]*?)<\/Key>/);
      const vidM = block.match(/<VersionId>([\s\S]*?)<\/VersionId>/);
      if (keyM?.[1]) {
        results.push({
          key: decodeXmlEntities(keyM[1]),
          versionId: vidM?.[1] ? decodeXmlEntities(vidM[1]) : '',
          size: 0,
          isDeleteMarker: true,
        });
      }
    }

    const isTruncated = /<IsTruncated>true<\/IsTruncated>/i.test(xml);
    const nextKeyM = xml.match(/<NextKeyMarker>([\s\S]*?)<\/NextKeyMarker>/);
    const nextVidM = xml.match(/<NextVersionIdMarker>([\s\S]*?)<\/NextVersionIdMarker>/);
    if (isTruncated && nextKeyM?.[1]) {
      keyMarker = decodeXmlEntities(nextKeyM[1]);
      versionIdMarker = nextVidM?.[1] ? decodeXmlEntities(nextVidM[1]) : '';
    } else {
      break;
    }
  }

  return results;
}

async function deleteB2ObjectVersion(
  creds: {
    endpointUrl: string;
    bucket: string;
    accessKeyId: string;
    secret: string;
  },
  key: string,
  versionId?: string
): Promise<boolean> {
  const query: Record<string, string | undefined> = {};
  if (versionId && versionId !== 'null') {
    query.versionId = versionId;
  }

  const res = await signedB2Request({
    method: 'DELETE',
    endpointUrl: creds.endpointUrl,
    bucket: creds.bucket,
    objectKey: key,
    query,
    accessKeyId: creds.accessKeyId,
    secretAccessKey: creds.secret,
  });

  return res.ok || res.status === 404;
}

/* ============================================================
   Scan Real Storage Usage & Keep-Alive Ping (Supabase & B2)
   ============================================================ */

interface StoredObjectEntry {
  key: string;
  size: number;
}

async function listSupabaseObjectsRecursive(
  client: SupabaseClient,
  bucket: string,
  prefix = '',
  depth = 0
): Promise<StoredObjectEntry[]> {
  if (depth > 4) return [];

  const out: StoredObjectEntry[] = [];
  let offset = 0;
  const limit = 500;

  while (true) {
    const { data, error } = await client.storage.from(bucket).list(prefix, {
      limit,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });

    if (error) {
      throw new Error(`Supabase list error (${bucket}/${prefix}): ${error.message}`);
    }

    const items = data || [];
    for (const item of items) {
      if (!item.name || item.name === '.emptyFolderPlaceholder') continue;
      const fullKey = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) {
        const sub = await listSupabaseObjectsRecursive(client, bucket, fullKey, depth + 1);
        out.push(...sub);
      } else {
        const size = Number((item.metadata as { size?: number } | null)?.size || 0);
        out.push({ key: fullKey, size: Number.isFinite(size) ? size : 0 });
      }
    }

    if (items.length < limit) break;
    offset += limit;
    if (offset > 5000) break;
  }

  return out;
}

export async function scanAccountUsage(
  row: StorageAccountRow
): Promise<{ usedBytes: number; fileCount: number }> {
  const creds = resolveAccountCredentials(row);

  if (row.provider === 'supabase') {
    if (!creds.endpointUrl || !creds.secret) {
      throw new Error(`Kredensial Supabase untuk "${row.name}" belum lengkap.`);
    }
    const sb = createClient(creds.endpointUrl, creds.secret, {
      auth: { persistSession: false },
    });
    const objects = await listSupabaseObjectsRecursive(sb, creds.bucket);
    const usedBytes = objects.reduce((sum, obj) => sum + obj.size, 0);
    return { usedBytes, fileCount: objects.length };
  }

  // Backblaze B2: hitung seluruh versi fisik tersimpan agar akurat dengan kuota B2
  if (!creds.endpointUrl || !creds.accessKeyId || !creds.secret) {
    throw new Error(`Kredensial Backblaze B2 untuk "${row.name}" belum lengkap.`);
  }

  const versions = await listB2ObjectVersions(creds);
  let totalBytes = 0;
  let fileCount = 0;
  for (const v of versions) {
    if (!v.isDeleteMarker) {
      totalBytes += v.size;
      fileCount += 1;
    }
  }

  return { usedBytes: totalBytes, fileCount };
}

export async function pingStorageAccount(
  row: StorageAccountRow
): Promise<{ ok: boolean; statusText: string }> {
  const creds = resolveAccountCredentials(row);

  try {
    if (row.provider === 'supabase') {
      if (!creds.endpointUrl || !creds.secret) {
        return { ok: false, statusText: 'Kredensial kosong' };
      }
      const sb = createClient(creds.endpointUrl, creds.secret, {
        auth: { persistSession: false },
      });
      const { error } = await sb.storage.from(creds.bucket).list('', { limit: 1 });
      if (error) {
        return { ok: false, statusText: `Error: ${error.message.slice(0, 80)}` };
      }
      return { ok: true, statusText: 'Online (Active)' };
    }

    if (!creds.endpointUrl || !creds.accessKeyId || !creds.secret) {
      return { ok: false, statusText: 'Kredensial B2 kosong' };
    }
    const res = await signedB2Request({
      method: 'GET',
      endpointUrl: creds.endpointUrl,
      bucket: creds.bucket,
      query: { 'list-type': '2', 'max-keys': '1' },
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secret,
    });
    if (!res.ok) {
      return { ok: false, statusText: `HTTP ${res.status}` };
    }
    return { ok: true, statusText: 'Online (B2 Private Ready)' };
  } catch (err) {
    return {
      ok: false,
      statusText: err instanceof Error ? err.message.slice(0, 80) : 'Timeout/Error',
    };
  }
}

/* ============================================================
   URL -> Storage Account Resolver, Auto-Delete & Orphan Cleaner
   ============================================================ */

function safeDecodeSegment(seg: string): string {
  try {
    return decodeURIComponent(seg);
  } catch {
    return seg;
  }
}

function decodePathSegments(rawPath: string): string {
  return rawPath
    .replace(/^\/+/, '')
    .split('/')
    .map(safeDecodeSegment)
    .join('/')
    .replace(/^\/+/, '');
}

export function extractStorageRefFromUrl(
  rawUrl: string,
  accounts: StorageAccountRow[]
): { accountId: string; objectKey: string } | null {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed, 'https://orihour.vercel.app');
  } catch {
    return null;
  }

  // 1. Backblaze B2 Private Signed Proxy: /api/media/b2/<accountId>/<objectKey>
  const b2ProxyMatch = parsed.pathname.match(/^\/api\/media\/b2\/([^/]+)\/(.+)$/);
  if (b2ProxyMatch?.[1] && b2ProxyMatch?.[2]) {
    const accountId = safeDecodeSegment(b2ProxyMatch[1]);
    const matchedAcc = accounts.find((a) => a.id === accountId && a.provider === 'b2');
    if (matchedAcc) {
      const objectKey = decodePathSegments(b2ProxyMatch[2]);
      if (objectKey) return { accountId: matchedAcc.id, objectKey };
    }
  }

  const parsedOrigin = parsed.origin.toLowerCase();

  // 2. Supabase Public/Signed URL atau Backblaze B2 Public URL
  for (const acc of accounts) {
    const creds = resolveAccountCredentials(acc);
    if (!creds.bucket) continue;

    if (acc.provider === 'supabase' && creds.endpointUrl) {
      try {
        const epOrigin = new URL(creds.endpointUrl).origin.toLowerCase();
        if (parsedOrigin !== epOrigin) continue;

        const prefixes = [
          `/storage/v1/object/public/${creds.bucket}/`,
          `/storage/v1/object/sign/${creds.bucket}/`,
        ];
        for (const prefix of prefixes) {
          if (parsed.pathname.startsWith(prefix)) {
            const objectKey = decodePathSegments(parsed.pathname.slice(prefix.length));
            if (objectKey) return { accountId: acc.id, objectKey };
          }
        }
      } catch {
        continue;
      }
    }

    if (acc.provider === 'b2') {
      const baseCandidates: string[] = [];
      if (creds.publicBaseUrl) baseCandidates.push(creds.publicBaseUrl);
      if (creds.endpointUrl && creds.bucket) {
        baseCandidates.push(`${creds.endpointUrl}/${creds.bucket}`);
      }

      for (const base of baseCandidates) {
        try {
          const baseUrl = new URL(base);
          const basePrefix = `${baseUrl.pathname.replace(/\/+$/, '')}/`;
          if (
            parsedOrigin === baseUrl.origin.toLowerCase() &&
            parsed.pathname.startsWith(basePrefix)
          ) {
            const objectKey = decodePathSegments(parsed.pathname.slice(basePrefix.length));
            if (objectKey) return { accountId: acc.id, objectKey };
          }
        } catch {
          continue;
        }
      }
    }
  }

  return null;
}

export async function collectReferencedMediaUrls(db: SupabaseClient): Promise<Set<string>> {
  const [vinylsRes, postersRes, settingsRes] = await Promise.all([
    db.from('vinyl_records').select('cover_url, audio_url, tracks'),
    db.from('wall_posters').select('image_url'),
    db.from('room_settings').select('owner_profile').eq('id', 1).maybeSingle(),
  ]);

  if (vinylsRes.error) {
    throw new Error(`Gagal membaca referensi vinyl_records: ${vinylsRes.error.message}`);
  }
  if (postersRes.error) {
    throw new Error(`Gagal membaca referensi wall_posters: ${postersRes.error.message}`);
  }
  if (settingsRes.error) {
    throw new Error(`Gagal membaca referensi room_settings: ${settingsRes.error.message}`);
  }

  const urls = new Set<string>();
  const addUrl = (val: unknown) => {
    if (typeof val === 'string' && val.trim()) {
      urls.add(val.trim());
    }
  };

  for (const row of (vinylsRes.data || []) as Array<{
    cover_url?: string | null;
    audio_url?: string | null;
    tracks?: unknown;
  }>) {
    addUrl(row.cover_url);
    addUrl(row.audio_url);
    if (Array.isArray(row.tracks)) {
      for (const trk of row.tracks as Array<Record<string, unknown>>) {
        if (trk && typeof trk === 'object') {
          addUrl(trk.audioUrl);
          addUrl(trk.audio_url);
        }
      }
    }
  }

  for (const row of (postersRes.data || []) as Array<{ image_url?: string | null }>) {
    addUrl(row.image_url);
  }

  const ownerProfile = (
    settingsRes.data as { owner_profile?: Record<string, unknown> | null } | null
  )?.owner_profile;
  if (ownerProfile && typeof ownerProfile === 'object') {
    addUrl(ownerProfile.avatarUrl);
    addUrl(ownerProfile.avatar_url);
  }

  return urls;
}

function buildReferencedKeyMap(
  urls: Set<string>,
  accounts: StorageAccountRow[]
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const url of urls) {
    const ref = extractStorageRefFromUrl(url, accounts);
    if (!ref) continue;
    let set = map.get(ref.accountId);
    if (!set) {
      set = new Set<string>();
      map.set(ref.accountId, set);
    }
    set.add(ref.objectKey);
  }
  return map;
}

async function refreshAccountUsageInDb(db: SupabaseClient, acc: StorageAccountRow) {
  try {
    const scanned = await scanAccountUsage(acc);
    const nowIso = new Date().toISOString();
    await db
      .from('storage_accounts')
      .update({
        used_bytes: scanned.usedBytes,
        file_count: scanned.fileCount,
        last_scanned_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', acc.id);
  } catch {
    // Non-fatal; admin can re-scan manually anytime
  }
}

export async function deleteMediaUrlsFromStoragePool(
  db: SupabaseClient,
  candidateUrls: string[]
): Promise<{ deletedCount: number; errors: string[] }> {
  const uniqueUrls = Array.from(
    new Set(candidateUrls.map((u) => (u || '').trim()).filter(Boolean))
  );
  if (uniqueUrls.length === 0) {
    return { deletedCount: 0, errors: [] };
  }

  const { accounts } = await ensurePrimaryStorageBootstrapped(db);
  const activeUrls = await collectReferencedMediaUrls(db);
  const activeKeysByAccount = buildReferencedKeyMap(activeUrls, accounts);

  const keysToDeleteByAccount = new Map<string, Set<string>>();
  for (const url of uniqueUrls) {
    const ref = extractStorageRefFromUrl(url, accounts);
    if (!ref) continue;
    // Jangan pernah hapus file yang masih dipakai koleksi/poster/profil lain
    if (activeKeysByAccount.get(ref.accountId)?.has(ref.objectKey)) {
      continue;
    }
    let set = keysToDeleteByAccount.get(ref.accountId);
    if (!set) {
      set = new Set<string>();
      keysToDeleteByAccount.set(ref.accountId, set);
    }
    set.add(ref.objectKey);
  }

  let deletedCount = 0;
  const errors: string[] = [];

  for (const [accountId, keySet] of keysToDeleteByAccount.entries()) {
    const acc = accounts.find((a) => a.id === accountId);
    if (!acc) continue;
    const creds = resolveAccountCredentials(acc);
    const keys = Array.from(keySet);
    if (keys.length === 0) continue;

    try {
      if (acc.provider === 'supabase') {
        if (!creds.endpointUrl || !creds.secret) continue;
        const sb = createClient(creds.endpointUrl, creds.secret, {
          auth: { persistSession: false },
        });
        for (let i = 0; i < keys.length; i += 100) {
          const chunk = keys.slice(i, i + 100);
          const { error } = await sb.storage.from(creds.bucket).remove(chunk);
          if (error) {
            errors.push(`${acc.name}: ${error.message}`);
          } else {
            deletedCount += chunk.length;
          }
        }
      } else {
        // Backblaze B2: hapus seluruh versionId & delete marker agar kuota langsung kembali
        if (!creds.endpointUrl || !creds.accessKeyId || !creds.secret) continue;
        for (const key of keys) {
          const versions = await listB2ObjectVersions(creds, key);
          const exactMatches = versions.filter((v) => v.key === key);
          if (exactMatches.length === 0) {
            await deleteB2ObjectVersion(creds, key);
          } else {
            for (const v of exactMatches) {
              const ok = await deleteB2ObjectVersion(creds, v.key, v.versionId);
              if (ok && !v.isDeleteMarker) deletedCount += 1;
            }
          }
        }
      }

      await refreshAccountUsageInDb(db, acc);
    } catch (err) {
      errors.push(`${acc.name}: ${err instanceof Error ? err.message : 'Gagal hapus file'}`);
    }
  }

  return { deletedCount, errors };
}

export async function cleanupOrphanedStorageFiles(
  db: SupabaseClient,
  options?: { accountId?: string; dryRun?: boolean }
): Promise<OrphanCleanupResult> {
  const dryRun = Boolean(options?.dryRun);
  const { accounts } = await ensurePrimaryStorageBootstrapped(db);
  const activeUrls = await collectReferencedMediaUrls(db);
  const activeKeysByAccount = buildReferencedKeyMap(activeUrls, accounts);

  const targets = options?.accountId
    ? accounts.filter((a) => a.id === options.accountId)
    : accounts.filter((a) => a.is_enabled);

  const byAccount: OrphanAccountSummary[] = [];
  let totalOrphanCount = 0;
  let totalOrphanBytes = 0;
  let totalDeletedCount = 0;
  let totalDeletedBytes = 0;

  for (const acc of targets) {
    const creds = resolveAccountCredentials(acc);
    const activeKeys = activeKeysByAccount.get(acc.id) || new Set<string>();
    const summary: OrphanAccountSummary = {
      accountId: acc.id,
      accountName: acc.name,
      provider: acc.provider,
      orphanCount: 0,
      orphanBytes: 0,
      deletedCount: 0,
      deletedBytes: 0,
    };

    try {
      if (acc.provider === 'supabase') {
        if (!creds.endpointUrl || !creds.secret) {
          throw new Error('Kredensial Supabase belum lengkap.');
        }
        const sb = createClient(creds.endpointUrl, creds.secret, {
          auth: { persistSession: false },
        });
        const objects = await listSupabaseObjectsRecursive(sb, creds.bucket);
        const orphans = objects.filter((obj) => !activeKeys.has(obj.key));

        summary.orphanCount = orphans.length;
        summary.orphanBytes = orphans.reduce((sum, o) => sum + o.size, 0);

        if (!dryRun && orphans.length > 0) {
          for (let i = 0; i < orphans.length; i += 100) {
            const chunk = orphans.slice(i, i + 100);
            const { error } = await sb.storage
              .from(creds.bucket)
              .remove(chunk.map((o) => o.key));
            if (error) {
              throw new Error(error.message);
            }
            summary.deletedCount += chunk.length;
            summary.deletedBytes += chunk.reduce((sum, o) => sum + o.size, 0);
          }
          await refreshAccountUsageInDb(db, acc);
        }
      } else {
        if (!creds.endpointUrl || !creds.accessKeyId || !creds.secret) {
          throw new Error('Kredensial Backblaze B2 belum lengkap.');
        }
        const versions = await listB2ObjectVersions(creds);
        const orphanVersions = versions.filter((v) => !activeKeys.has(v.key));

        const realOrphanFiles = orphanVersions.filter((v) => !v.isDeleteMarker);
        summary.orphanCount = realOrphanFiles.length;
        summary.orphanBytes = realOrphanFiles.reduce((sum, v) => sum + v.size, 0);

        if (!dryRun && orphanVersions.length > 0) {
          for (const v of orphanVersions) {
            const ok = await deleteB2ObjectVersion(creds, v.key, v.versionId);
            if (ok && !v.isDeleteMarker) {
              summary.deletedCount += 1;
              summary.deletedBytes += v.size;
            }
          }
          await refreshAccountUsageInDb(db, acc);
        }
      }
    } catch (err) {
      summary.error = err instanceof Error ? err.message : 'Gagal memindai/membersihkan akun.';
    }

    totalOrphanCount += summary.orphanCount;
    totalOrphanBytes += summary.orphanBytes;
    totalDeletedCount += summary.deletedCount;
    totalDeletedBytes += summary.deletedBytes;
    byAccount.push(summary);
  }

  return {
    dryRun,
    totalOrphanCount,
    totalOrphanBytes,
    totalDeletedCount,
    totalDeletedBytes,
    byAccount,
  };
}

/* ============================================================
   Smart Target Account Picker (Manual + Auto-Failover)
   ============================================================ */

export function selectUploadTargetAccount(
  rows: StorageAccountRow[],
  settings: StorageSettingsRow,
  incomingSizeBytes: number
): {
  target: StorageAccountRow | null;
  didFailover: boolean;
  failoverFromName: string | null;
  error: string | null;
} {
  const enabled = rows.filter((r) => r.is_enabled);
  if (enabled.length === 0) {
    return {
      target: null,
      didFailover: false,
      failoverFromName: null,
      error:
        'Tidak ada akun penyimpanan yang aktif. Buka tab Penyimpanan di Panel Admin untuk mengaktifkan atau menambah akun.',
    };
  }

  const fitsAccount = (acc: StorageAccountRow) => {
    const quotaBytes = Math.max(1, Number(acc.quota_mb) || 1024) * 1024 * 1024;
    const projectedBytes = Math.max(0, Number(acc.used_bytes) || 0) + incomingSizeBytes;
    const projectedPct = (projectedBytes / quotaBytes) * 100;
    return projectedBytes <= quotaBytes && projectedPct < settings.full_threshold_pct;
  };

  const active = enabled.find((r) => r.is_active) || enabled[0];
  if (fitsAccount(active)) {
    return {
      target: active,
      didFailover: false,
      failoverFromName: null,
      error: null,
    };
  }

  if (!settings.auto_failover) {
    return {
      target: null,
      didFailover: false,
      failoverFromName: active.name,
      error: `Penyimpanan aktif "${active.name}" sudah penuh atau tidak cukup menampung file ini. Pindahkan akun aktif atau aktifkan Auto-Failover di tab Penyimpanan.`,
    };
  }

  const candidates = enabled
    .filter((r) => r.id !== active.id)
    .sort((a, b) => a.priority - b.priority || a.created_at.localeCompare(b.created_at));

  const fallback = candidates.find(fitsAccount);
  if (!fallback) {
    return {
      target: null,
      didFailover: false,
      failoverFromName: active.name,
      error:
        'Semua akun penyimpanan yang aktif sudah penuh! Tambahkan akun Supabase baru atau Backblaze B2 (10 GB gratis tanpa kartu kredit) di tab Penyimpanan.',
    };
  }

  return {
    target: fallback,
    didFailover: true,
    failoverFromName: active.name,
    error: null,
  };
}

export async function generatePresignedUploadForAccount(params: {
  account: StorageAccountRow;
  objectKey: string;
  appOrigin?: string;
}) {
  const creds = resolveAccountCredentials(params.account);

  if (params.account.provider === 'supabase') {
    if (!creds.endpointUrl || !creds.secret) {
      throw new Error(`Kredensial Supabase untuk "${params.account.name}" tidak valid.`);
    }

    const sb = createClient(creds.endpointUrl, creds.secret, {
      auth: { persistSession: false },
    });

    const { data, error } = await sb.storage
      .from(creds.bucket)
      .createSignedUploadUrl(params.objectKey);

    if (error || !data?.signedUrl) {
      throw new Error(
        `Gagal membuat URL upload Supabase (${params.account.name}): ${
          error?.message || 'Unknown error'
        }`
      );
    }

    const uploadUrl = data.signedUrl.startsWith('http')
      ? data.signedUrl
      : `${creds.endpointUrl}/storage/v1${
          data.signedUrl.startsWith('/') ? '' : '/'
        }${data.signedUrl}`;

    const { data: pub } = sb.storage.from(creds.bucket).getPublicUrl(params.objectKey);

    return {
      provider: 'supabase' as const,
      uploadUrl,
      publicUrl: pub.publicUrl,
      objectKey: params.objectKey,
    };
  }

  if (!creds.endpointUrl || !creds.accessKeyId || !creds.secret) {
    throw new Error(
      `Konfigurasi Backblaze B2 untuk "${params.account.name}" belum lengkap (butuh S3 Endpoint, keyID, dan applicationKey).`
    );
  }

  const uploadUrl = createB2PresignedPutUrl({
    endpointUrl: creds.endpointUrl,
    bucket: creds.bucket,
    objectKey: params.objectKey,
    accessKeyId: creds.accessKeyId,
    secretAccessKey: creds.secret,
    expiresSec: 900,
  });

  const encodedKey = params.objectKey
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');

  const safeOrigin = (params.appOrigin || 'https://orihour.vercel.app').replace(/\/+$/, '');
  const publicUrl = creds.publicBaseUrl
    ? `${creds.publicBaseUrl}/${encodedKey}`
    : `${safeOrigin}/api/media/b2/${encodeURIComponent(params.account.id)}/${encodedKey}`;

  return {
    provider: 'b2' as const,
    uploadUrl,
    publicUrl,
    objectKey: params.objectKey,
  };
}