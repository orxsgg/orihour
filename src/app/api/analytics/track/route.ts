import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function safeDecodeHeader(val: string | null): string {
  if (!val) return '';
  try {
    return decodeURIComponent(val).trim();
  } catch {
    return val.trim();
  }
}

function resolveCountryName(code: string): string {
  if (!code || code.length !== 2) return 'Unknown';
  try {
    const dn = new Intl.DisplayNames(['en'], { type: 'region' });
    return dn.of(code.toUpperCase()) || code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

function parseUserAgent(ua: string): {
  deviceType: string;
  browser: string;
  os: string;
} {
  const s = ua || '';

  let deviceType = 'Desktop';
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(s)) {
    deviceType = 'Tablet';
  } else if (/Mobile|iPhone|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(s)) {
    deviceType = 'Mobile';
  }

  let browser = 'Other';
  if (/Edg\//i.test(s)) browser = 'Edge';
  else if (/OPR\/|Opera/i.test(s)) browser = 'Opera';
  else if (/Firefox\//i.test(s)) browser = 'Firefox';
  else if (/Chrome\//i.test(s) && !/Chromium/i.test(s)) browser = 'Chrome';
  else if (/Safari\//i.test(s) && !/Chrome|Chromium/i.test(s)) browser = 'Safari';

  let os = 'Other';
  if (/Windows/i.test(s)) os = 'Windows';
  else if (/Android/i.test(s)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(s)) os = 'iOS';
  else if (/Mac OS X|Macintosh/i.test(s)) os = 'macOS';
  else if (/Linux/i.test(s)) os = 'Linux';

  return { deviceType, browser, os };
}

function cleanReferrer(rawRef: string, hostHeader: string): string {
  if (!rawRef?.trim()) return 'Direct';
  try {
    const parsed = new URL(rawRef.trim());
    const refHost = parsed.hostname.replace(/^www\./, '').toLowerCase();
    const ownHost = hostHeader.split(':')[0].replace(/^www\./, '').toLowerCase();
    if (!refHost || refHost === ownHost || refHost === 'localhost') {
      return 'Direct';
    }
    return refHost.slice(0, 80);
  } catch {
    return 'Direct';
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ ok: false, skipped: true });
    }

    const ua = req.headers.get('user-agent') || '';
    if (/bot|crawler|spider|slurp|headless|lighthouse/i.test(ua)) {
      return NextResponse.json({ ok: true, bot: true });
    }

    const body = await req.json().catch(() => ({}));
    const sessionId =
      typeof body.sessionId === 'string' && body.sessionId.trim()
        ? body.sessionId.trim().slice(0, 64)
        : crypto.randomUUID();

    const path =
      typeof body.path === 'string' && body.path.startsWith('/')
        ? body.path.slice(0, 120)
        : '/';
    const viewMode = body.viewMode === 'LO-FI' ? 'LO-FI' : '3D';
    const weather =
      typeof body.weather === 'string' ? body.weather.slice(0, 16) : 'CLEAR';
    const timezone =
      typeof body.timezone === 'string' ? body.timezone.slice(0, 64) : '';
    const screenSize =
      typeof body.screenSize === 'string' ? body.screenSize.slice(0, 24) : '';

    const countryCode = (
      safeDecodeHeader(req.headers.get('x-vercel-ip-country')) ||
      safeDecodeHeader(req.headers.get('cf-ipcountry')) ||
      ''
    ).toUpperCase();

    let city =
      safeDecodeHeader(req.headers.get('x-vercel-ip-city')) ||
      safeDecodeHeader(req.headers.get('cf-ipcity')) ||
      '';
    let region =
      safeDecodeHeader(req.headers.get('x-vercel-ip-country-region')) ||
      safeDecodeHeader(req.headers.get('cf-region')) ||
      '';
    let country = countryCode ? resolveCountryName(countryCode) : '';

    if (!city && !countryCode) {
      const tzCity = timezone.includes('/')
        ? timezone.split('/').pop()?.replace(/_/g, ' ') || 'Localhost'
        : 'Localhost';
      city = `${tzCity} (Local)`;
      region = 'Development';
      country =
        timezone.startsWith('Asia/Jakarta') ||
        timezone.startsWith('Asia/Makassar') ||
        timezone.startsWith('Asia/Jayapura')
          ? 'Indonesia'
          : 'Local';
    } else {
      city = city || 'Unknown City';
      region = region || country || 'Unknown';
      country = country || 'Unknown';
    }

    const { deviceType, browser, os } = parseUserAgent(ua);
    const referrer = cleanReferrer(
      typeof body.referrer === 'string' ? body.referrer : '',
      req.headers.get('host') || ''
    );

    const rawIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'local';
    const dayBucket = new Date().toISOString().slice(0, 10);
    const visitorHash = crypto
      .createHash('sha256')
      .update(`${rawIp}|${ua}|${dayBucket}`)
      .digest('hex')
      .slice(0, 24);

    const { error } = await supabase.from('visitor_logs').insert({
      session_id: sessionId,
      visitor_hash: visitorHash,
      path,
      country,
      country_code: countryCode,
      region,
      city,
      timezone,
      device_type: deviceType,
      browser,
      os,
      referrer,
      view_mode: viewMode,
      weather,
      screen_size: screenSize,
    });

    if (error) {
      return NextResponse.json({ ok: false, skipped: true });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, skipped: true });
  }
}