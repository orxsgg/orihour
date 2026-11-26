import { WeatherType } from '@/types/orihour';

export interface AtmosphereState {
  phaseLabel: string;
  skyTop: string;
  skyBottom: string;
  skyHorizon: string;
  fogColor: string;
  sunColor: string;
  sunIntensity: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  roomFillColor: string;
  roomFillIntensity: number;
  envIntensity: number;
  wallTint: string;
  sunPosition: [number, number, number];
  moonPosition: [number, number, number];
  sunLightPosition: [number, number, number];
  sunOpacity: number;
  moonOpacity: number;
  starOpacity: number;
  autoLampOn: boolean;
  isNightHud: boolean;
}

interface Keyframe {
  hour: number;
  skyTop: string;
  skyBottom: string;
  skyHorizon: string;
  fog: string;
  sunColor: string;
  sunIntensity: number;
  hemiIntensity: number;
  roomFillColor: string;
  roomFillIntensity: number;
  envIntensity: number;
  wallTint: string;
  starOpacity: number;
}

// Calibrated to Central Kalimantan (WIB / UTC+7) solar cycle:
// Dawn ~04:15-05:15 | Sunrise ~05:05 | Solar Noon ~11:11 | Golden Hour ~15:45-17:15 | Sunset ~17:18 | Dusk ~17:20-18:20
const KEYFRAMES: Keyframe[] = [
  {
    hour: 0.0,
    skyTop: '#040814',
    skyBottom: '#0C162B',
    skyHorizon: '#17253F',
    fog: '#0F1A2E',
    sunColor: '#A8C4F5',
    sunIntensity: 0.42,
    hemiIntensity: 0.56,
    roomFillColor: '#FFD2A0',
    roomFillIntensity: 0.56,
    envIntensity: 0.36,
    wallTint: '#948B82',
    starOpacity: 1.0,
  },
  {
    hour: 4.1,
    skyTop: '#081024',
    skyBottom: '#162544',
    skyHorizon: '#2B3A5C',
    fog: '#18243E',
    sunColor: '#A6C0EC',
    sunIntensity: 0.46,
    hemiIntensity: 0.6,
    roomFillColor: '#FFD8AC',
    roomFillIntensity: 0.54,
    envIntensity: 0.4,
    wallTint: '#9C938A',
    starOpacity: 0.72,
  },
  {
    hour: 5.08,
    skyTop: '#243A68',
    skyBottom: '#C97F6F',
    skyHorizon: '#F4B884',
    fog: '#CFA18A',
    sunColor: '#FFB673',
    sunIntensity: 1.42,
    hemiIntensity: 0.88,
    roomFillColor: '#FFE6CC',
    roomFillIntensity: 0.46,
    envIntensity: 0.68,
    wallTint: '#DFD4C8',
    starOpacity: 0.06,
  },
  {
    hour: 7.5,
    skyTop: '#2C6CC9',
    skyBottom: '#8EC6F2',
    skyHorizon: '#E4F0F8',
    fog: '#C6DFEE',
    sunColor: '#FFF5DC',
    sunIntensity: 2.35,
    hemiIntensity: 1.15,
    roomFillColor: '#FFFDF8',
    roomFillIntensity: 0.38,
    envIntensity: 0.88,
    wallTint: '#F4EFE6',
    starOpacity: 0,
  },
  {
    hour: 11.2,
    skyTop: '#1E5CC0',
    skyBottom: '#89C3F1',
    skyHorizon: '#E2EFF8',
    fog: '#CBE2F2',
    sunColor: '#FFFDF7',
    sunIntensity: 2.55,
    hemiIntensity: 1.22,
    roomFillColor: '#FFFFFF',
    roomFillIntensity: 0.36,
    envIntensity: 0.94,
    wallTint: '#F8F4EC',
    starOpacity: 0,
  },
  {
    hour: 15.6,
    skyTop: '#2A66C2',
    skyBottom: '#98C4E6',
    skyHorizon: '#EFE4D2',
    fog: '#D6DFEA',
    sunColor: '#FFEFCA',
    sunIntensity: 2.3,
    hemiIntensity: 1.1,
    roomFillColor: '#FFF8EC',
    roomFillIntensity: 0.42,
    envIntensity: 0.86,
    wallTint: '#F2EAE0',
    starOpacity: 0,
  },
  {
    hour: 16.9,
    skyTop: '#324B80',
    skyBottom: '#DA8350',
    skyHorizon: '#FBBF78',
    fog: '#DE9F74',
    sunColor: '#FF9E44',
    sunIntensity: 2.1,
    hemiIntensity: 0.96,
    roomFillColor: '#FFE8CE',
    roomFillIntensity: 0.5,
    envIntensity: 0.76,
    wallTint: '#E9DBC8',
    starOpacity: 0,
  },
  {
    hour: 17.7,
    skyTop: '#151E3C',
    skyBottom: '#69415F',
    skyHorizon: '#B86A60',
    fog: '#47364F',
    sunColor: '#D47F8A',
    sunIntensity: 0.72,
    hemiIntensity: 0.66,
    roomFillColor: '#FFDCB0',
    roomFillIntensity: 0.56,
    envIntensity: 0.48,
    wallTint: '#B4A99E',
    starOpacity: 0.52,
  },
  {
    hour: 18.6,
    skyTop: '#060C1C',
    skyBottom: '#111E38',
    skyHorizon: '#1D2D4C',
    fog: '#111C31',
    sunColor: '#9FBDF2',
    sunIntensity: 0.48,
    hemiIntensity: 0.6,
    roomFillColor: '#FFD2A0',
    roomFillIntensity: 0.58,
    envIntensity: 0.42,
    wallTint: '#9B9289',
    starOpacity: 0.98,
  },
  {
    hour: 24.0,
    skyTop: '#040814',
    skyBottom: '#0C162B',
    skyHorizon: '#17253F',
    fog: '#0F1A2E',
    sunColor: '#A8C4F5',
    sunIntensity: 0.42,
    hemiIntensity: 0.56,
    roomFillColor: '#FFD2A0',
    roomFillIntensity: 0.56,
    envIntensity: 0.36,
    wallTint: '#948B82',
    starOpacity: 1.0,
  },
];

function getPhaseLabelForWibHour(h: number): string {
  if (h >= 23.0 || h < 1.5) return 'MIDNIGHT';
  if (h < 4.25) return 'LATE NIGHT';
  if (h < 5.25) return 'DAWN';
  if (h < 10.0) return 'MORNING';
  if (h < 15.75) return 'DAYLIGHT';
  if (h < 17.25) return 'GOLDEN HOUR';
  if (h < 18.25) return 'DUSK';
  return 'NIGHT';
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function lerpHex(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const bl = Math.round(b1 + (b2 - b1) * t);
  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function computeAtmosphere(hourDecimal: number, weather: WeatherType): AtmosphereState {
  const h = ((hourDecimal % 24) + 24) % 24;

  let k1 = KEYFRAMES[0];
  let k2 = KEYFRAMES[1];
  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    if (h >= KEYFRAMES[i].hour && h <= KEYFRAMES[i + 1].hour) {
      k1 = KEYFRAMES[i];
      k2 = KEYFRAMES[i + 1];
      break;
    }
  }

  const span = Math.max(0.001, k2.hour - k1.hour);
  const rawT = (h - k1.hour) / span;
  const t = rawT * rawT * (3 - 2 * rawT);

  let skyTop = lerpHex(k1.skyTop, k2.skyTop, t);
  let skyBottom = lerpHex(k1.skyBottom, k2.skyBottom, t);
  let skyHorizon = lerpHex(k1.skyHorizon, k2.skyHorizon, t);
  let fogColor = lerpHex(k1.fog, k2.fog, t);
  let sunColor = lerpHex(k1.sunColor, k2.sunColor, t);
  let sunIntensity = lerp(k1.sunIntensity, k2.sunIntensity, t);
  let hemiIntensity = lerp(k1.hemiIntensity, k2.hemiIntensity, t);
  let roomFillColor = lerpHex(k1.roomFillColor, k2.roomFillColor, t);
  let roomFillIntensity = lerp(k1.roomFillIntensity, k2.roomFillIntensity, t);
  let envIntensity = lerp(k1.envIntensity, k2.envIntensity, t);
  let wallTint = lerpHex(k1.wallTint, k2.wallTint, t);
  let starOpacity = lerp(k1.starOpacity, k2.starOpacity, t);

  // Distant celestial arc behind the rolling horizon hills
  const sunriseHour = 5.08;
  const sunsetHour = 17.3;
  const dayLength = sunsetHour - sunriseHour;
  const dayAngle = ((h - sunriseHour) / dayLength) * Math.PI;

  const sunX = -1.4 - Math.cos(dayAngle) * 19.5;
  const sunY = 1.6 + Math.sin(dayAngle) * 13.0;
  const sunFade =
    Math.min(1, Math.max(0, (h - (sunriseHour - 0.3)) / 0.65)) *
    Math.min(1, Math.max(0, (sunsetHour + 0.3 - h) / 0.65));

  const nightLength = 24 - dayLength;
  const nightHours = h >= sunsetHour ? h - sunsetHour : h + (24 - sunsetHour);
  const nightAngle = (nightHours / nightLength) * Math.PI;

  const moonX = -1.4 - Math.cos(nightAngle) * 18.0;
  const moonY = 1.8 + Math.sin(nightAngle) * 12.2;
  const moonFade =
    h >= sunsetHour
      ? Math.min(1, (h - sunsetHour) / 0.7)
      : h <= sunriseHour
      ? Math.min(1, Math.max(0, (sunriseHour - h) / 0.7))
      : 0;

  if (weather === 'CLOUDY') {
    skyTop = lerpHex(skyTop, '#56677D', 0.5);
    skyBottom = lerpHex(skyBottom, '#8596AB', 0.5);
    skyHorizon = lerpHex(skyHorizon, '#A8B6C5', 0.54);
    fogColor = lerpHex(fogColor, '#8293A6', 0.5);
    wallTint = lerpHex(wallTint, '#B4B1AC', 0.26);
    sunColor = lerpHex(sunColor, '#CFDCE8', 0.55);
    sunIntensity *= 0.34;
    hemiIntensity *= 0.84;
    envIntensity *= 0.62;
    starOpacity *= 0.16;
  } else if (weather === 'RAIN') {
    // Heavy storm overcast blocks direct sun/moon beams and eliminates harsh tabletop specular glare
    const rainSunTarget = lerpHex('#3A4B63', '#879BB2', sunFade);
    skyTop = lerpHex(skyTop, '#182234', 0.72);
    skyBottom = lerpHex(skyBottom, '#2E3E54', 0.68);
    skyHorizon = lerpHex(skyHorizon, '#46576E', 0.64);
    fogColor = lerpHex(fogColor, '#263447', 0.72);
    wallTint = lerpHex(wallTint, '#7E8084', 0.38);

    sunColor = lerpHex(sunColor, rainSunTarget, 0.88);
    sunIntensity *= lerp(0.05, 0.085, sunFade);
    hemiIntensity *= lerp(0.48, 0.58, sunFade);
    envIntensity *= lerp(0.28, 0.30, sunFade);

    // Keep interior softly cozy (cool muted fill during daytime rain, warm lamp bounce at night rain)
    roomFillColor = lerpHex('#FFD2A0', '#C8D3DF', sunFade * 0.68);
    roomFillIntensity = lerp(0.46, 0.36, sunFade);
    starOpacity = 0;
  }

  const sunOpacity = weather === 'RAIN' ? 0 : sunFade * (weather === 'CLOUDY' ? 0.32 : 1.0);
  const moonOpacity = weather === 'RAIN' ? 0 : moonFade * (weather === 'CLOUDY' ? 0.35 : 1.0);

  // Keep directional light positioned cleanly for indoor window shadow casting
  const useSunLight = sunOpacity >= moonOpacity;
  const lightX = (useSunLight ? sunX : moonX) * 0.28;
  const lightY = Math.max(4.4, (useSunLight ? sunY : moonY) * 0.72);

  const autoLampOn = h >= 17.15 || h <= 5.75 || weather === 'RAIN';
  const isNightHud = h >= 17.0 || h < 6.0 || weather === 'RAIN';

  return {
    phaseLabel: getPhaseLabelForWibHour(h),
    skyTop,
    skyBottom,
    skyHorizon,
    fogColor,
    sunColor,
    sunIntensity,
    hemiSky: skyBottom,
    hemiGround: '#4A3628',
    hemiIntensity,
    roomFillColor,
    roomFillIntensity,
    envIntensity,
    wallTint,
    sunPosition: [sunX, sunY, -64],
    moonPosition: [moonX, moonY, -63.5],
    sunLightPosition: [lightX, lightY, -14],
    sunOpacity,
    moonOpacity,
    starOpacity,
    autoLampOn,
    isNightHud,
  };
}