import { NextRequest, NextResponse } from 'next/server';
import { WeatherType } from '@/types/orihour';

export const dynamic = 'force-dynamic';

const FALLBACK_LAT = -2.2083;
const FALLBACK_LON = 113.9167;

interface WilayahItem {
  code: string;
  name: string;
}

interface BmkgSlot {
  utc_datetime?: string;
  local_datetime?: string;
  weather?: number;
  weather_desc?: string;
  weather_desc_en?: string;
  ws?: number;
  t?: number;
}

interface ReverseGeoResult {
  countryCode: string;
  province: string;
  regency: string;
  district: string;
  village: string;
  displayName: string;
}

// Lightweight in-memory caches for Wilayah.id lists (static Kemendagri region tables)
const wilayahCache = new Map<string, WilayahItem[]>();
const adm4Cache = new Map<string, { adm4: string; label: string }>();

function parseCoord(
  raw: string | null | undefined,
  min: number,
  max: number
): number | null {
  if (!raw) return null;
  const num = Number(raw);
  return Number.isFinite(num) && num >= min && num <= max ? num : null;
}

function isInIndonesiaBounds(lat: number, lon: number): boolean {
  return lat >= -11.3 && lat <= 6.3 && lon >= 94.8 && lon <= 141.2;
}

function normalizePlaceName(name: string): string {
  return (name || '')
    .toLowerCase()
    .replace(
      /\b(provinsi|province|kabupaten|kab\.?|kota|administrasi|kecamatan|kec\.?|kelurahan|kel\.?|desa|regency|district|subdistrict|city|of)\b/g,
      ' '
    )
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findBestWilayahMatch(
  items: WilayahItem[],
  candidates: string[]
): WilayahItem | null {
  const cleanedCandidates = candidates
    .map((c) => normalizePlaceName(c))
    .filter(Boolean);
  if (cleanedCandidates.length === 0 || items.length === 0) return null;

  let bestItem: WilayahItem | null = null;
  let bestScore = 0;

  for (const item of items) {
    const normItem = normalizePlaceName(item.name);
    if (!normItem) continue;

    for (const cand of cleanedCandidates) {
      if (normItem === cand) {
        return item;
      }

      let score = 0;
      if (normItem.includes(cand) || cand.includes(normItem)) {
        const ratio =
          Math.min(normItem.length, cand.length) /
          Math.max(normItem.length, cand.length);
        score = 0.72 + ratio * 0.25;
      } else {
        const itemWords = new Set(normItem.split(' '));
        const candWords = cand.split(' ');
        const overlap = candWords.filter((w) => w.length > 2 && itemWords.has(w)).length;
        if (overlap > 0) {
          score = overlap / Math.max(itemWords.size, candWords.length);
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestItem = item;
      }
    }
  }

  return bestScore >= 0.45 ? bestItem : null;
}

async function fetchWilayahList(path: string): Promise<WilayahItem[]> {
  const cached = wilayahCache.get(path);
  if (cached) return cached;

  try {
    const res = await fetch(`https://wilayah.id/api/${path}`, {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(4500),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: WilayahItem[] };
    const list = Array.isArray(json.data) ? json.data : [];
    if (list.length > 0) {
      wilayahCache.set(path, list);
    }
    return list;
  } catch {
    return [];
  }
}

async function reverseGeocode(lat: number, lon: number): Promise<ReverseGeoResult | null> {
  // Primary: OpenStreetMap Nominatim (has exact Indonesian desa/kelurahan + kecamatan + kabupaten)
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat.toFixed(
      5
    )}&lon=${lon.toFixed(5)}&zoom=14&addressdetails=1&accept-language=id`;
    const res = await fetch(nomUrl, {
      headers: {
        'User-Agent': 'OrihourListeningRoom/1.0 (https://orihour.vercel.app)',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(4500),
    });

    if (res.ok) {
      const data = (await res.json()) as {
        address?: Record<string, string | undefined>;
      };
      const addr = data.address || {};
      const countryCode = (addr.country_code || '').toUpperCase();
      const province = addr.state || addr.region || '';
      const regency =
        addr.county || addr.city || addr.state_district || addr.municipality || '';
      const district =
        addr.municipality ||
        addr.city_district ||
        addr.suburb ||
        addr.town ||
        addr.county ||
        '';
      const village =
        addr.village ||
        addr.suburb ||
        addr.neighbourhood ||
        addr.quarter ||
        addr.hamlet ||
        addr.town ||
        '';
      const displayName = village || district || regency || province || '';
      return { countryCode, province, regency, district, village, displayName };
    }
  } catch {
    // Fallback below
  }

  // Fallback: BigDataCloud free reverse geocode
  try {
    const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat.toFixed(
      4
    )}&longitude=${lon.toFixed(4)}&localityLanguage=id`;
    const res = await fetch(bdcUrl, {
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        countryCode?: string;
        principalSubdivision?: string;
        city?: string;
        locality?: string;
        localityInfo?: { administrative?: { name?: string; adminLevel?: number }[] };
      };
      const admins = data.localityInfo?.administrative || [];
      const findLevel = (lvl: number) =>
        admins.find((a) => a.adminLevel === lvl)?.name || '';
      const province = data.principalSubdivision || findLevel(4);
      const regency = findLevel(5) || findLevel(6) || data.city || '';
      const district = findLevel(6) || findLevel(7) || '';
      const village = findLevel(7) || findLevel(8) || data.locality || '';
      return {
        countryCode: (data.countryCode || '').toUpperCase(),
        province,
        regency,
        district,
        village,
        displayName: village || district || regency || province || '',
      };
    }
  } catch {
    // Ignore
  }

  return null;
}

async function resolveIndonesiaAdm4(
  lat: number,
  lon: number,
  geo: ReverseGeoResult | null
): Promise<{ adm4: string; label: string } | null> {
  const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = adm4Cache.get(cacheKey);
  if (cached) return cached;

  if (!geo) return null;

  const provinces = await fetchWilayahList('provinces.json');
  const prov = findBestWilayahMatch(provinces, [geo.province]);
  if (!prov) return null;

  const regencies = await fetchWilayahList(`regencies/${prov.code}.json`);
  const reg =
    findBestWilayahMatch(regencies, [geo.regency, geo.district, geo.village]) ||
    regencies[0];
  if (!reg) return null;

  const districts = await fetchWilayahList(`districts/${reg.code}.json`);
  const dist =
    findBestWilayahMatch(districts, [geo.district, geo.village, geo.regency]) ||
    districts[0];
  if (!dist) return null;

  const villages = await fetchWilayahList(`villages/${dist.code}.json`);
  const vill =
    findBestWilayahMatch(villages, [geo.village, geo.district]) || villages[0];
  if (!vill) return null;

  const resolved = {
    adm4: vill.code,
    label: `${vill.name}, ${reg.name}`,
  };
  adm4Cache.set(cacheKey, resolved);
  return resolved;
}

function mapBmkgSlotToWeather(slot: BmkgSlot): WeatherType {
  const desc = `${slot.weather_desc || ''} ${slot.weather_desc_en || ''}`.toLowerCase();
  const code = typeof slot.weather === 'number' ? slot.weather : -1;
  const windKmh = typeof slot.ws === 'number' ? slot.ws : 0;

  if (
    desc.includes('hujan') ||
    desc.includes('petir') ||
    desc.includes('badai') ||
    desc.includes('rain') ||
    desc.includes('shower') ||
    desc.includes('thunder') ||
    desc.includes('drizzle') ||
    (code >= 60 && code <= 99)
  ) {
    return 'RAIN';
  }

  if (windKmh >= 22 || desc.includes('berangin') || desc.includes('angin kencang')) {
    return 'BREEZY';
  }

  // "Cerah" or "Cerah Berawan" (partly sunny) feels clear unless heavily overcast
  if (desc.includes('cerah') || desc.includes('clear') || desc.includes('sunny')) {
    return 'CLEAR';
  }

  if (
    desc.includes('berawan') ||
    desc.includes('mendung') ||
    desc.includes('kabut') ||
    desc.includes('asap') ||
    desc.includes('kabur') ||
    desc.includes('cloud') ||
    desc.includes('overcast') ||
    desc.includes('fog') ||
    desc.includes('haze') ||
    (code >= 3 && code <= 45)
  ) {
    return 'CLOUDY';
  }

  return 'CLEAR';
}

async function fetchBmkgWeather(adm4: string, fallbackLabel: string) {
  const url = `https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${encodeURIComponent(
    adm4
  )}`;
  const res = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(5500),
  });
  if (!res.ok) return null;

  const json = (await res.json()) as {
    lokasi?: { desa?: string; kecamatan?: string; kotkab?: string; provinsi?: string };
    data?: Array<{
      lokasi?: { desa?: string; kecamatan?: string; kotkab?: string };
      cuaca?: BmkgSlot[][];
    }>;
  };

  const entry = json.data?.[0];
  const nestedDays = entry?.cuaca;
  if (!Array.isArray(nestedDays)) return null;

  const slots: BmkgSlot[] = nestedDays.flat().filter(Boolean);
  if (slots.length === 0) return null;

  const nowMs = Date.now();
  let bestSlot = slots[0];
  let bestDiff = Number.POSITIVE_INFINITY;

  for (const s of slots) {
    if (!s.utc_datetime) continue;
    const isoUtc = s.utc_datetime.includes('T')
      ? s.utc_datetime
      : s.utc_datetime.replace(' ', 'T') + 'Z';
    const slotMs = Date.parse(isoUtc);
    if (Number.isNaN(slotMs)) continue;
    const diff = Math.abs(slotMs - nowMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestSlot = s;
    }
  }

  const lok = entry?.lokasi || json.lokasi;
  const locationName =
    lok?.desa && lok?.kotkab
      ? `${lok.desa}, ${lok.kotkab}`
      : lok?.desa || fallbackLabel;

  return {
    weather: mapBmkgSlotToWeather(bestSlot),
    source: 'BMKG' as const,
    adm4,
    locationName,
    description: bestSlot.weather_desc || bestSlot.weather_desc_en || '',
    tempC: typeof bestSlot.t === 'number' ? bestSlot.t : null,
  };
}

function mapOpenMeteoToWeather(current: {
  weather_code?: number;
  rain?: number;
  showers?: number;
  precipitation?: number;
  cloud_cover?: number;
  wind_speed_10m?: number;
}): { weather: WeatherType; description: string } {
  const code = Number(current.weather_code ?? 0);
  const rain = Number(current.rain ?? 0);
  const showers = Number(current.showers ?? 0);
  const precip = Number(current.precipitation ?? 0);
  const clouds = Number(current.cloud_cover ?? 0);
  const wind = Number(current.wind_speed_10m ?? 0);

  if (rain > 0.1 || showers > 0.1 || precip > 0.25 || code >= 51) {
    return { weather: 'RAIN', description: 'Rain' };
  }
  if (wind >= 22) {
    return { weather: 'BREEZY', description: 'Breezy' };
  }
  if (code === 3 || code === 45 || code === 48 || clouds >= 70) {
    return { weather: 'CLOUDY', description: 'Cloudy' };
  }
  return { weather: 'CLEAR', description: 'Clear' };
}

async function fetchOpenMeteoWeather(lat: number, lon: number, locationName: string) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(
    4
  )}&longitude=${lon.toFixed(
    4
  )}&current=weather_code,temperature_2m,rain,showers,precipitation,cloud_cover,wind_speed_10m&timezone=auto`;

  const res = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    current?: {
      weather_code?: number;
      temperature_2m?: number;
      rain?: number;
      showers?: number;
      precipitation?: number;
      cloud_cover?: number;
      wind_speed_10m?: number;
    };
  };

  const current = data.current || {};
  const mapped = mapOpenMeteoToWeather(current);

  return {
    weather: mapped.weather,
    source: 'Open-Meteo' as const,
    locationName,
    description: mapped.description,
    tempC: typeof current.temperature_2m === 'number' ? current.temperature_2m : null,
  };
}

export async function GET(req: NextRequest) {
  const queryLat = parseCoord(req.nextUrl.searchParams.get('lat'), -90, 90);
  const queryLon = parseCoord(req.nextUrl.searchParams.get('lon'), -180, 180);

  const headerLat = parseCoord(req.headers.get('x-vercel-ip-latitude'), -90, 90);
  const headerLon = parseCoord(req.headers.get('x-vercel-ip-longitude'), -180, 180);
  const headerCountry = (req.headers.get('x-vercel-ip-country') || '').toUpperCase();
  const headerCity = decodeURIComponent(req.headers.get('x-vercel-ip-city') || '');

  const hasExactCoords = queryLat !== null && queryLon !== null;
  const lat = queryLat ?? headerLat ?? FALLBACK_LAT;
  const lon = queryLon ?? headerLon ?? FALLBACK_LON;

  const likelyIndonesia = hasExactCoords
    ? isInIndonesiaBounds(lat, lon)
    : headerCountry === 'ID' || (!headerCountry && isInIndonesiaBounds(lat, lon));

  let geo: ReverseGeoResult | null = null;
  let isIndonesia = likelyIndonesia;

  if (likelyIndonesia) {
    geo = await reverseGeocode(lat, lon);
    if (geo?.countryCode) {
      isIndonesia = geo.countryCode === 'ID';
    }
  }

  // 1. Official BMKG for devices located in Indonesia
  if (isIndonesia) {
    try {
      const resolved = await resolveIndonesiaAdm4(lat, lon, geo);
      if (resolved) {
        const bmkg = await fetchBmkgWeather(resolved.adm4, resolved.label);
        if (bmkg) {
          return NextResponse.json(bmkg);
        }
      }
    } catch {
      // Fall through gracefully to Open-Meteo if BMKG is unavailable
    }
  }

  // 2. Global Open-Meteo (all countries outside Indonesia, or fallback)
  try {
    const fallbackLabel =
      geo?.displayName || headerCity || (isIndonesia ? 'Indonesia' : 'Local Weather');
    const globalResult = await fetchOpenMeteoWeather(lat, lon, fallbackLabel);
    if (globalResult) {
      return NextResponse.json(globalResult);
    }
  } catch {
    // Fall back to CLEAR
  }

  return NextResponse.json({
    weather: 'CLEAR' as WeatherType,
    source: 'Fallback',
    locationName: headerCity || '',
    description: 'Clear',
    tempC: null,
  });
}