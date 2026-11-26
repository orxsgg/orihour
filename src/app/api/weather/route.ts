import { NextRequest, NextResponse } from 'next/server';
import { WeatherType } from '@/types/orihour';

export const dynamic = 'force-dynamic';

// Fallback hanya dipakai saat berjalan di localhost (tidak ada Vercel geo-header)
const FALLBACK_LAT = Number(process.env.WEATHER_LAT ?? -2.2083);
const FALLBACK_LON = Number(process.env.WEATHER_LON ?? 113.9167);

function parseCoord(raw: string | null | undefined, min: number, max: number): number | null {
  if (!raw) return null;
  const num = Number(raw);
  if (!Number.isFinite(num) || num < min || num > max) return null;
  return num;
}

function mapOpenMeteoToWeather(
  weatherCode: number,
  rainMm: number,
  precipitationMm: number,
  cloudCover: number,
  windSpeed: number
): WeatherType {
  // Hanya kode hujan nyata, hujan deras, atau badai petir
  const realRainCodes = new Set([61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);
  const drizzleCodes = new Set([51, 53, 55, 56, 57]);

  if (
    (realRainCodes.has(weatherCode) && (rainMm >= 0.1 || precipitationMm >= 0.1)) ||
    rainMm >= 0.25 ||
    precipitationMm >= 0.3
  ) {
    return 'RAIN';
  }

  if (windSpeed >= 18) {
    return 'BREEZY';
  }

  if (
    drizzleCodes.has(weatherCode) ||
    weatherCode === 2 ||
    weatherCode === 3 ||
    weatherCode === 45 ||
    weatherCode === 48 ||
    cloudCover >= 65
  ) {
    return 'CLOUDY';
  }

  return 'CLEAR';
}

export async function GET(req: NextRequest) {
  try {
    // Prioritas: 1. Query (?lat=&lon=) -> 2. Header lokasi pengunjung (Vercel) -> 3. Fallback lokal
    const queryLat = parseCoord(req.nextUrl.searchParams.get('lat'), -90, 90);
    const queryLon = parseCoord(req.nextUrl.searchParams.get('lon'), -180, 180);

    const visitorLat = parseCoord(req.headers.get('x-vercel-ip-latitude'), -90, 90);
    const visitorLon = parseCoord(req.headers.get('x-vercel-ip-longitude'), -180, 180);

    const lat = queryLat ?? visitorLat ?? FALLBACK_LAT;
    const lon = queryLon ?? visitorLon ?? FALLBACK_LON;

    const endpoint =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
      `&current=weather_code,rain,precipitation,cloud_cover,wind_speed_10m` +
      `&timezone=auto`;

    const res = await fetch(endpoint, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return NextResponse.json({ weather: 'CLEAR' as WeatherType });
    }

    const data = await res.json();
    const current = data?.current;

    const weather = mapOpenMeteoToWeather(
      Number(current?.weather_code ?? 0),
      Number(current?.rain ?? 0),
      Number(current?.precipitation ?? 0),
      Number(current?.cloud_cover ?? 0),
      Number(current?.wind_speed_10m ?? 0)
    );

    // Hanya mengembalikan status cuaca (nol metadata lokasi yang terekspos)
    return NextResponse.json({ weather });
  } catch {
    return NextResponse.json({ weather: 'CLEAR' as WeatherType });
  }
}