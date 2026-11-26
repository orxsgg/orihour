import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import {
  AnalyticsBucket,
  AnalyticsDailyPoint,
  AnalyticsDashboardData,
  VisitorLogItem,
} from '@/types/orihour';

export const dynamic = 'force-dynamic';

async function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) return null;

  if (serviceKey) {
    return createClient(url, serviceKey, { auth: { persistSession: false } });
  }

  if (!anonKey) return null;

  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
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
          // Ignore cookie write in read-only contexts
        }
      },
    },
  });
}

interface RawLogRow {
  id: string;
  session_id: string;
  visitor_hash: string;
  path: string;
  country: string;
  country_code: string;
  region: string;
  city: string;
  timezone: string;
  device_type: string;
  browser: string;
  os: string;
  referrer: string;
  view_mode: string;
  weather: string;
  screen_size: string;
  created_at: string;
}

function buildBuckets(
  counts: Map<string, { name: string; sublabel?: string; code?: string; count: number }>,
  total: number,
  limit = 10
): AnalyticsBucket[] {
  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((item) => ({
      ...item,
      pct: total > 0 ? Math.round((item.count / total) * 100) : 0,
    }));
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase belum dikonfigurasi.' },
        { status: 500 }
      );
    }

    const daysParam = req.nextUrl.searchParams.get('days') || '30';
    const rangeDays =
      daysParam === 'all' ? 3650 : Math.max(1, Math.min(365, parseInt(daysParam, 10) || 30));

    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - rangeDays);

    let query = supabase
      .from('visitor_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(2500);

    if (daysParam !== 'all') {
      query = query.gte('created_at', sinceDate.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      const msg = error.message?.toLowerCase() || '';
      if (
        msg.includes('visitor_logs') &&
        (msg.includes('does not exist') || msg.includes('schema cache'))
      ) {
        const empty: AnalyticsDashboardData = {
          tableMissing: true,
          rangeDays,
          summary: {
            totalVisits: 0,
            uniqueVisitors: 0,
            todayVisits: 0,
            last7DaysVisits: 0,
            topLocation: '-',
            mobileSharePct: 0,
          },
          dailySeries: [],
          byCity: [],
          byCountry: [],
          byDevice: [],
          byBrowser: [],
          byOs: [],
          byReferrer: [],
          byViewMode: [],
          recentLogs: [],
        };
        return NextResponse.json(empty);
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data || []) as RawLogRow[];
    const total = rows.length;
    const now = Date.now();
    const todayIso = new Date().toISOString().slice(0, 10);
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    const uniqueSet = new Set<string>();
    let todayVisits = 0;
    let last7DaysVisits = 0;
    let mobileCount = 0;

    const cityMap = new Map<
      string,
      { name: string; sublabel?: string; code?: string; count: number }
    >();
    const countryMap = new Map<string, { name: string; code?: string; count: number }>();
    const deviceMap = new Map<string, { name: string; count: number }>();
    const browserMap = new Map<string, { name: string; count: number }>();
    const osMap = new Map<string, { name: string; count: number }>();
    const referrerMap = new Map<string, { name: string; count: number }>();
    const modeMap = new Map<string, { name: string; count: number }>();

    const chartDays = Math.min(14, rangeDays);
    const dailyMap = new Map<string, { visits: number; uniques: Set<string>; label: string }>();
    for (let i = chartDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
      dailyMap.set(iso, { visits: 0, uniques: new Set(), label });
    }

    const bump = (map: Map<string, { name: string; count: number }>, key: string) => {
      const clean = key || 'Unknown';
      const cur = map.get(clean);
      if (cur) cur.count += 1;
      else map.set(clean, { name: clean, count: 1 });
    };

    for (const r of rows) {
      const hashKey = r.visitor_hash || r.session_id;
      uniqueSet.add(hashKey);

      const dateIso = (r.created_at || '').slice(0, 10);
      if (dateIso === todayIso) todayVisits += 1;
      if (new Date(r.created_at).getTime() >= sevenDaysAgo) last7DaysVisits += 1;
      if (r.device_type === 'Mobile' || r.device_type === 'Tablet') mobileCount += 1;

      const dayEntry = dailyMap.get(dateIso);
      if (dayEntry) {
        dayEntry.visits += 1;
        dayEntry.uniques.add(hashKey);
      }

      const cityKey = `${r.city}|${r.region}|${r.country}`;
      const curCity = cityMap.get(cityKey);
      if (curCity) {
        curCity.count += 1;
      } else {
        const sub =
          r.region && r.region !== r.city && r.region !== r.country
            ? `${r.region}, ${r.country}`
            : r.country;
        cityMap.set(cityKey, {
          name: r.city || 'Unknown',
          sublabel: sub,
          code: r.country_code || '',
          count: 1,
        });
      }

      const cName = r.country || 'Unknown';
      const curCountry = countryMap.get(cName);
      if (curCountry) curCountry.count += 1;
      else countryMap.set(cName, { name: cName, code: r.country_code || '', count: 1 });

      bump(deviceMap, r.device_type || 'Desktop');
      bump(browserMap, r.browser || 'Other');
      bump(osMap, r.os || 'Other');
      bump(referrerMap, r.referrer || 'Direct');
      bump(modeMap, r.view_mode || '3D');
    }

    const byCity = buildBuckets(cityMap, total, 12);
    const byCountry = buildBuckets(countryMap, total, 10);
    const dailySeries: AnalyticsDailyPoint[] = Array.from(dailyMap.entries()).map(
      ([date, v]) => ({
        date,
        label: v.label,
        visits: v.visits,
        uniqueVisitors: v.uniques.size,
      })
    );

    const recentLogs: VisitorLogItem[] = rows.slice(0, 100).map((r) => ({
      id: r.id,
      sessionId: r.session_id,
      path: r.path,
      country: r.country,
      countryCode: r.country_code,
      region: r.region,
      city: r.city,
      timezone: r.timezone,
      deviceType: r.device_type,
      browser: r.browser,
      os: r.os,
      referrer: r.referrer,
      viewMode: r.view_mode,
      weather: r.weather,
      screenSize: r.screen_size,
      createdAt: r.created_at,
    }));

    const payload: AnalyticsDashboardData = {
      rangeDays,
      summary: {
        totalVisits: total,
        uniqueVisitors: uniqueSet.size,
        todayVisits,
        last7DaysVisits,
        topLocation: byCity[0]
          ? `${byCity[0].name}${byCity[0].sublabel ? `, ${byCity[0].sublabel}` : ''}`
          : '-',
        mobileSharePct: total > 0 ? Math.round((mobileCount / total) * 100) : 0,
      },
      dailySeries,
      byCity,
      byCountry,
      byDevice: buildBuckets(deviceMap, total, 6),
      byBrowser: buildBuckets(browserMap, total, 6),
      byOs: buildBuckets(osMap, total, 6),
      byReferrer: buildBuckets(referrerMap, total, 8),
      byViewMode: buildBuckets(modeMap, total, 4),
      recentLogs,
    };

    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal memuat analitik.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase belum dikonfigurasi.' },
        { status: 500 }
      );
    }

    const singleId = req.nextUrl.searchParams.get('id');
    if (singleId) {
      const { error } = await supabase.from('visitor_logs').delete().eq('id', singleId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, deleted: 1 });
    }

    const body = await req.json().catch(() => ({}));
    if (body.clearAll === true) {
      const { error } = await supabase
        .from('visitor_logs')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, cleared: true });
    }

    const ids = Array.isArray(body.ids)
      ? body.ids.filter((x: unknown): x is string => typeof x === 'string' && x.length > 0)
      : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: 'Tidak ada ID log yang dipilih.' }, { status: 400 });
    }

    const { error } = await supabase.from('visitor_logs').delete().in('id', ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, deleted: ids.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal menghapus log analitik.' },
      { status: 500 }
    );
  }
}