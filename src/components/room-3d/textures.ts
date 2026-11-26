import * as THREE from 'three';
import {
  GuestbookPostcard,
  OwnerProfile,
  POSTCARD_LIMITS,
  PosterItem,
  RoomConfig,
  VinylRecord,
} from '@/types/orihour';

const sleeveDataUrlCache = new Map<string, string>();
const corsImageCache = new Map<string, Promise<HTMLImageElement | null>>();

let cachedWalnutPbr: PbrMaterialMaps | null = null;
let cachedLeatherPbr: PbrMaterialMaps | null = null;
let cachedPlasterPbr: { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } | null = null;
let cachedMaroonRugPbr: { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } | null = null;
let cachedCorkboardPbr: { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } | null = null;
let cachedMeadowPbr: { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } | null = null;
let cachedBarkPbr: { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } | null = null;
let cachedGrassClumpTex: THREE.CanvasTexture | null = null;
let cachedLeafSprigTex: THREE.CanvasTexture | null = null;
let cachedDriftingLeafTex: THREE.CanvasTexture | null = null;
let cachedSunTex: THREE.CanvasTexture | null = null;
let cachedMoonTex: THREE.CanvasTexture | null = null;
let cachedSoftShadowTex: THREE.CanvasTexture | null = null;
let cachedCoffeeTex: THREE.CanvasTexture | null = null;
let cachedSteamWispTex: THREE.CanvasTexture | null = null;
const cachedCloudTexMap = new Map<number, THREE.CanvasTexture>();

export interface PbrMaterialMaps {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

export function loadCorsImage(url?: string | null): Promise<HTMLImageElement | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  const clean = url?.trim();
  if (!clean) return Promise.resolve(null);

  const cached = corsImageCache.get(clean);
  if (cached) return cached;

  const promise = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      corsImageCache.delete(clean);
      resolve(null);
    };
    img.src = clean;
  });

  corsImageCache.set(clean, promise);
  return promise;
}

export function createWalnutWoodPbr(): PbrMaterialMaps {
  if (cachedWalnutPbr) return cachedWalnutPbr;

  const size = 512;
  const colorCanvas = document.createElement('canvas');
  const bumpCanvas = document.createElement('canvas');
  const roughCanvas = document.createElement('canvas');
  colorCanvas.width = bumpCanvas.width = roughCanvas.width = size;
  colorCanvas.height = bumpCanvas.height = roughCanvas.height = size;

  const cCtx = colorCanvas.getContext('2d')!;
  const bCtx = bumpCanvas.getContext('2d')!;
  const rCtx = roughCanvas.getContext('2d')!;

  const baseGrad = cCtx.createLinearGradient(0, 0, 0, size);
  baseGrad.addColorStop(0, '#5E3B25');
  baseGrad.addColorStop(0.35, '#68422A');
  baseGrad.addColorStop(0.7, '#583722');
  baseGrad.addColorStop(1, '#5E3B25');
  cCtx.fillStyle = baseGrad;
  cCtx.fillRect(0, 0, size, size);

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#B0B0B0';
  rCtx.fillRect(0, 0, size, size);

  for (let i = 0; i < 36; i++) {
    const y = (i / 36) * size;
    const wave = Math.sin(i * 0.72) * 16 + Math.cos(i * 1.35) * 7;
    const thickness = 4 + (i % 5) * 2.2;
    const isDark = i % 3 === 0;

    cCtx.strokeStyle = isDark ? 'rgba(38, 21, 11, 0.24)' : 'rgba(154, 106, 70, 0.12)';
    cCtx.lineWidth = thickness;
    cCtx.beginPath();
    cCtx.moveTo(0, y);
    cCtx.bezierCurveTo(size * 0.32, y + wave, size * 0.68, y - wave, size, y);
    cCtx.stroke();

    bCtx.strokeStyle = isDark ? 'rgba(116, 116, 116, 0.45)' : 'rgba(138, 138, 138, 0.4)';
    bCtx.lineWidth = thickness * 0.75;
    bCtx.beginPath();
    bCtx.moveTo(0, y);
    bCtx.bezierCurveTo(size * 0.32, y + wave, size * 0.68, y - wave, size, y);
    bCtx.stroke();

    rCtx.strokeStyle = isDark ? 'rgba(186, 186, 186, 0.35)' : 'rgba(164, 164, 164, 0.35)';
    rCtx.lineWidth = thickness * 0.8;
    rCtx.beginPath();
    rCtx.moveTo(0, y);
    rCtx.bezierCurveTo(size * 0.32, y + wave, size * 0.68, y - wave, size, y);
    rCtx.stroke();
  }

  for (let y = 0; y < size; y += 4) {
    const wave = Math.sin(y * 0.025) * 10 + Math.cos(y * 0.06) * 4;
    const isDarkFiber = y % 12 === 0;
    cCtx.strokeStyle = isDarkFiber ? 'rgba(34, 18, 9, 0.2)' : 'rgba(166, 116, 78, 0.07)';
    cCtx.lineWidth = isDarkFiber ? 1.6 : 1.0;
    cCtx.beginPath();
    cCtx.moveTo(0, y);
    cCtx.bezierCurveTo(170, y + wave, 340, y - wave, size, y);
    cCtx.stroke();
  }

  const setupTex = (canvas: HTMLCanvasElement, srgb = false) => {
    const tex = new THREE.CanvasTexture(canvas);
    if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 1.2);
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 4;
    return tex;
  };

  cachedWalnutPbr = {
    map: setupTex(colorCanvas, true),
    bumpMap: setupTex(bumpCanvas),
    roughnessMap: setupTex(roughCanvas),
  };
  return cachedWalnutPbr;
}

export function createLeatherPbr(): PbrMaterialMaps {
  if (cachedLeatherPbr) return cachedLeatherPbr;

  const size = 256;
  const cCanvas = document.createElement('canvas');
  const bCanvas = document.createElement('canvas');
  const rCanvas = document.createElement('canvas');
  cCanvas.width = bCanvas.width = rCanvas.width = size;
  cCanvas.height = bCanvas.height = rCanvas.height = size;

  const cCtx = cCanvas.getContext('2d')!;
  const bCtx = bCanvas.getContext('2d')!;
  const rCtx = rCanvas.getContext('2d')!;

  cCtx.fillStyle = '#432718';
  cCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#707070';
  bCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#A8A8A8';
  rCtx.fillRect(0, 0, size, size);

  for (let i = 0; i < 64; i++) {
    const x = (Math.sin(i * 19.7 + 1.3) * 0.5 + 0.5) * size;
    const y = (Math.cos(i * 37.1 + 4.7) * 0.5 + 0.5) * size;
    const rad = 16 + (i % 28);
    const g = cCtx.createRadialGradient(x, y, 1, x, y, rad);
    g.addColorStop(
      0,
      i % 2 === 0 ? 'rgba(104, 64, 40, 0.24)' : 'rgba(26, 14, 8, 0.26)'
    );
    g.addColorStop(1, 'rgba(0,0,0,0)');
    cCtx.fillStyle = g;
    cCtx.beginPath();
    cCtx.arc(x, y, rad, 0, Math.PI * 2);
    cCtx.fill();
  }

  for (let i = 0; i < 1600; i++) {
    const x = (Math.sin(i * 12.9898 + 2.1) * 0.5 + 0.5) * size;
    const y = (Math.cos(i * 78.233 + 5.9) * 0.5 + 0.5) * size;
    const r = 1.4 + (i % 3) * 0.45;

    cCtx.fillStyle = i % 3 === 0 ? 'rgba(92, 58, 38, 0.32)' : 'rgba(34, 19, 11, 0.34)';
    cCtx.fillRect(x, y, r * 1.4, r);

    bCtx.fillStyle = i % 2 === 0 ? '#A4A4A4' : '#525252';
    bCtx.fillRect(x, y, r, r);

    rCtx.fillStyle = i % 2 === 0 ? '#888888' : '#BCBCBC';
    rCtx.fillRect(x, y, r, r);
  }

  const setup = (canvas: HTMLCanvasElement, srgb = false) => {
    const tex = new THREE.CanvasTexture(canvas);
    if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2.2, 1.8);
    tex.anisotropy = 4;
    return tex;
  };

  cachedLeatherPbr = {
    map: setup(cCanvas, true),
    bumpMap: setup(bCanvas),
    roughnessMap: setup(rCanvas),
  };
  return cachedLeatherPbr;
}

export function createCoffeeSurfaceTexture(): THREE.CanvasTexture {
  if (cachedCoffeeTex) return cachedCoffeeTex;

  const size = 256;
  const cx = size * 0.5;
  const cy = size * 0.5;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const baseGrad = ctx.createRadialGradient(cx - 8, cy - 6, 12, cx, cy, 128);
  baseGrad.addColorStop(0.0, '#221008');
  baseGrad.addColorStop(0.45, '#331A0D');
  baseGrad.addColorStop(0.76, '#5E341B');
  baseGrad.addColorStop(0.91, '#9A6238');
  baseGrad.addColorStop(0.97, '#C48F5C');
  baseGrad.addColorStop(1.0, '#7C4B28');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, size, size);

  ctx.save();
  ctx.translate(cx, cy);
  for (let i = 0; i < 6; i++) {
    ctx.rotate(0.95);
    const swirlGrad = ctx.createLinearGradient(-70, -25, 70, 25);
    swirlGrad.addColorStop(0, 'rgba(182, 126, 76, 0)');
    swirlGrad.addColorStop(0.5, 'rgba(182, 126, 76, 0.22)');
    swirlGrad.addColorStop(1, 'rgba(182, 126, 76, 0)');
    ctx.strokeStyle = swirlGrad;
    ctx.lineWidth = 7 + (i % 3) * 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, 42 + i * 11, 0.15, 2.25);
    ctx.stroke();
  }
  ctx.restore();

  for (let i = 0; i < 160; i++) {
    const angle = (i * 2.39996) % (Math.PI * 2);
    const radius = 84 + ((i * 19) % 38);
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    const r = 1.1 + (i % 3) * 0.75;
    ctx.fillStyle =
      i % 2 === 0 ? 'rgba(224, 186, 142, 0.34)' : 'rgba(136, 84, 48, 0.32)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const gloss = ctx.createRadialGradient(cx - 32, cy - 28, 2, cx - 32, cy - 28, 52);
  gloss.addColorStop(0, 'rgba(255, 236, 206, 0.16)');
  gloss.addColorStop(1, 'rgba(255, 236, 206, 0)');
  ctx.fillStyle = gloss;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cachedCoffeeTex = tex;
  return tex;
}

// Organic Soft Wispy Steam Texture (Zero Hard Geometric Edges — For Realistic Coffee Steam Sprites)
export function createSteamWispTexture(): THREE.CanvasTexture {
  if (cachedSteamWispTex) return cachedSteamWispTex;

  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  // Soft overlapping curling vapor puffs fading seamlessly to 0 before the borders
  const puffs = [
    { x: 64, y: 66, r: 42, a: 0.24 },
    { x: 52, y: 54, r: 32, a: 0.2 },
    { x: 76, y: 50, r: 30, a: 0.18 },
    { x: 60, y: 38, r: 26, a: 0.16 },
    { x: 70, y: 80, r: 28, a: 0.17 },
    { x: 56, y: 74, r: 24, a: 0.14 },
  ];

  for (const p of puffs) {
    const g = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, p.r);
    g.addColorStop(0.0, `rgba(255, 248, 238, ${p.a})`);
    g.addColorStop(0.45, `rgba(255, 246, 235, ${p.a * 0.45})`);
    g.addColorStop(1.0, 'rgba(255, 246, 235, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Soft circular edge mask to guarantee zero visible square sprite bounds
  ctx.globalCompositeOperation = 'destination-in';
  const mask = ctx.createRadialGradient(64, 64, 16, 64, 64, 60);
  mask.addColorStop(0, 'rgba(255,255,255,1)');
  mask.addColorStop(0.7, 'rgba(255,255,255,0.55)');
  mask.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = mask;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'source-over';

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  cachedSteamWispTex = tex;
  return tex;
}

export function createWalletCoverTexture(brandText = 'ORIHOUR'): THREE.CanvasTexture {
  const w = 512;
  const h = 400;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(w * 0.48, h * 0.45, 25, w * 0.5, h * 0.5, 320);
  grad.addColorStop(0, '#533220');
  grad.addColorStop(0.68, '#3E2416');
  grad.addColorStop(1, '#29160C');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 1600; i++) {
    const x = (Math.sin(i * 17.31 + 1.1) * 0.5 + 0.5) * w;
    const y = (Math.cos(i * 43.17 + 2.9) * 0.5 + 0.5) * h;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(108, 68, 45, 0.22)' : 'rgba(20, 10, 6, 0.26)';
    ctx.fillRect(x, y, 2, 2);
  }

  ctx.strokeStyle = 'rgba(18, 9, 5, 0.65)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(18, 18, w - 36, h - 36, 22);
  ctx.stroke();

  ctx.strokeStyle = '#C9A370';
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  ctx.setLineDash([10, 9]);
  ctx.beginPath();
  ctx.roundRect(28, 28, w - 56, h - 56, 16);
  ctx.stroke();
  ctx.setLineDash([]);

  if (brandText) {
    ctx.textAlign = 'right';
    ctx.font = '600 22px Georgia, serif';
    ctx.fillStyle = 'rgba(18, 9, 5, 0.78)';
    ctx.fillText(brandText.toUpperCase(), w - 52, h - 54);
    ctx.fillStyle = 'rgba(186, 138, 96, 0.24)';
    ctx.fillText(brandText.toUpperCase(), w - 51, h - 53);
    ctx.textAlign = 'left';
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function createWalletInteriorTexture(side: 'left' | 'right'): THREE.CanvasTexture {
  const w = 512;
  const h = 400;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#3C2315';
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 1400; i++) {
    const x = (Math.sin(i * 23.11 + 3.1) * 0.5 + 0.5) * w;
    const y = (Math.cos(i * 51.73 + 1.7) * 0.5 + 0.5) * h;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(96, 60, 38, 0.22)' : 'rgba(22, 12, 7, 0.24)';
    ctx.fillRect(x, y, 2, 2);
  }

  const spineGrad =
    side === 'left'
      ? ctx.createLinearGradient(w - 58, 0, w, 0)
      : ctx.createLinearGradient(0, 0, 58, 0);
  spineGrad.addColorStop(0, side === 'left' ? 'rgba(14, 7, 4, 0)' : 'rgba(14, 7, 4, 0.58)');
  spineGrad.addColorStop(1, side === 'left' ? 'rgba(14, 7, 4, 0.58)' : 'rgba(14, 7, 4, 0)');
  ctx.fillStyle = spineGrad;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(201, 163, 112, 0.85)';
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.roundRect(18, 18, w - 36, h - 36, 14);
  ctx.stroke();
  ctx.setLineDash([]);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function createIdentityCardTexture(
  owner: OwnerProfile,
  avatarImg?: HTMLImageElement | null
): THREE.CanvasTexture {
  const w = 768;
  const h = 486;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#F6F0E3');
  bg.addColorStop(0.55, '#EFE6D5');
  bg.addColorStop(1, '#E4D6BE');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(154, 120, 84, 0.16)';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 16; i++) {
    const baseY = 95 + i * 24;
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    ctx.bezierCurveTo(220, baseY - 22, 520, baseY + 22, w, baseY - 6);
    ctx.stroke();
  }

  ctx.fillStyle = '#1B1410';
  ctx.fillRect(0, 0, w, 84);
  ctx.fillStyle = '#842536';
  ctx.fillRect(0, 80, w, 5);

  ctx.fillStyle = '#FAF5EC';
  ctx.font = 'bold 26px Georgia, serif';
  ctx.fillText('ORIHOUR', 34, 45);

  ctx.fillStyle = '#D4AA63';
  ctx.font = 'bold 14px monospace';
  ctx.fillText('RESIDENT IDENTITY PASS', 34, 67);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#EDE2D3';
  ctx.font = 'bold 15px monospace';
  ctx.fillText(owner.idCode.toUpperCase(), w - 34, 42);
  ctx.fillStyle = '#B8A694';
  ctx.font = '13px monospace';
  ctx.fillText(owner.location.toUpperCase(), w - 34, 64);
  ctx.textAlign = 'left';

  const px = 34;
  const py = 112;
  const pw = 198;
  const ph = 246;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, 14);
  ctx.clip();

  if (avatarImg) {
    const imgRatio = avatarImg.width / avatarImg.height;
    const boxRatio = pw / ph;
    let drawW = pw;
    let drawH = ph;
    let ox = px;
    let oy = py;
    if (imgRatio > boxRatio) {
      drawW = ph * imgRatio;
      ox = px - (drawW - pw) * 0.5;
    } else {
      drawH = pw / imgRatio;
      oy = py - (drawH - ph) * 0.5;
    }
    ctx.drawImage(avatarImg, ox, oy, drawW, drawH);
  } else {
    const studioBg = ctx.createLinearGradient(px, py, px + pw, py + ph);
    studioBg.addColorStop(0, '#3D2C24');
    studioBg.addColorStop(0.55, '#594235');
    studioBg.addColorStop(1, '#261B16');
    ctx.fillStyle = studioBg;
    ctx.fillRect(px, py, pw, ph);

    const halo = ctx.createRadialGradient(
      px + pw * 0.5,
      py + ph * 0.42,
      12,
      px + pw * 0.5,
      py + ph * 0.42,
      118
    );
    halo.addColorStop(0, 'rgba(244, 198, 142, 0.36)');
    halo.addColorStop(1, 'rgba(244, 198, 142, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(px, py, pw, ph);

    const cx = px + pw * 0.5;
    ctx.fillStyle = '#1E1A18';
    ctx.beginPath();
    ctx.ellipse(cx, py + ph + 16, 86, 82, 0, Math.PI, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#EAE2D6';
    ctx.beginPath();
    ctx.moveTo(cx - 24, py + 178);
    ctx.lineTo(cx, py + 216);
    ctx.lineTo(cx + 24, py + 178);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#C99B7B';
    ctx.beginPath();
    ctx.roundRect(cx - 17, py + 148, 34, 42, 12);
    ctx.fill();

    ctx.fillStyle = '#D6A989';
    ctx.beginPath();
    ctx.ellipse(cx, py + 112, 41, 50, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1D1815';
    ctx.beginPath();
    ctx.ellipse(cx, py + 90, 44, 34, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx - 34, py + 95, 12, 0, Math.PI * 2);
    ctx.arc(cx + 34, py + 95, 12, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.strokeStyle = '#9D8366';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, 14);
  ctx.stroke();

  const rx = 258;

  ctx.fillStyle = '#6E5A47';
  ctx.font = 'bold 13px monospace';
  ctx.fillText('FULL NAME', rx, 130);

  ctx.fillStyle = '#120E0B';
  ctx.font = 'bold 39px Georgia, serif';
  ctx.fillText(owner.name.slice(0, 22), rx, 174);

  ctx.fillStyle = '#842536';
  ctx.font = 'bold 14px monospace';
  ctx.fillText(owner.role.toUpperCase().slice(0, 34), rx, 202);

  ctx.fillStyle = 'rgba(30, 22, 16, 0.2)';
  ctx.fillRect(rx, 220, w - rx - 34, 2);

  const spY = 238;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
  ctx.strokeStyle = 'rgba(22, 163, 74, 0.45)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.roundRect(rx, spY, w - rx - 34, 54, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#1DB954';
  ctx.beginPath();
  ctx.arc(rx + 28, spY + 27, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  [
    { y: spY + 22, dx: 8.5, lift: 2.6 },
    { y: spY + 27.5, dx: 7.0, lift: 2.1 },
    { y: spY + 32.5, dx: 5.4, lift: 1.6 },
  ].forEach((arc) => {
    ctx.beginPath();
    ctx.moveTo(rx + 28 - arc.dx, arc.y);
    ctx.quadraticCurveTo(rx + 28, arc.y - arc.lift, rx + 28 + arc.dx, arc.y);
    ctx.stroke();
  });

  ctx.fillStyle = '#584E45';
  ctx.font = 'bold 11px monospace';
  ctx.fillText('SPOTIFY', rx + 56, spY + 21);
  ctx.fillStyle = '#120E0B';
  ctx.font = 'bold 19px sans-serif';
  ctx.fillText(owner.spotifyHandle, rx + 56, spY + 43);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#15803D';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('OPEN ↗', w - 50, spY + 33);
  ctx.textAlign = 'left';

  const igY = 304;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
  ctx.strokeStyle = 'rgba(74, 46, 27, 0.36)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.roundRect(rx, igY, w - rx - 34, 54, 12);
  ctx.fill();
  ctx.stroke();

  const igGrad = ctx.createLinearGradient(rx + 14, igY + 42, rx + 42, igY + 12);
  igGrad.addColorStop(0, '#9E2D41');
  igGrad.addColorStop(0.55, '#C13584');
  igGrad.addColorStop(1, '#5B3A9E');
  ctx.fillStyle = igGrad;
  ctx.beginPath();
  ctx.roundRect(rx + 14, igY + 13, 28, 28, 8);
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(rx + 28, igY + 27, 6.2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(rx + 35.5, igY + 19.5, 1.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#584E45';
  ctx.font = 'bold 11px monospace';
  ctx.fillText('INSTAGRAM', rx + 56, igY + 21);
  ctx.fillStyle = '#120E0B';
  ctx.font = 'bold 19px sans-serif';
  ctx.fillText(owner.instagramHandle, rx + 56, igY + 43);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#4A2E1B';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('OPEN ↗', w - 50, igY + 33);
  ctx.textAlign = 'left';

  ctx.fillStyle = 'rgba(27, 20, 16, 0.1)';
  ctx.fillRect(0, h - 88, w, 88);

  ctx.fillStyle = '#3F3228';
  ctx.font = 'italic 24px Georgia, serif';
  ctx.fillText(owner.name, 34, h - 38);

  ctx.fillStyle = '#6D5D4E';
  ctx.font = 'bold 11px monospace';
  ctx.fillText('AUTHORIZED LISTENING ROOM PASS · VALID INDEFINITELY', 34, h - 18);

  let bx = w - 220;
  for (let i = 0; i < 38; i++) {
    const bw = i % 5 === 0 ? 4 : i % 3 === 0 ? 3 : 1.8;
    ctx.fillStyle = 'rgba(20, 15, 12, 0.78)';
    ctx.fillRect(bx, h - 66, bw, 38);
    bx += bw + (i % 2 === 0 ? 2.5 : 3.5);
  }

  ctx.strokeStyle = 'rgba(42, 31, 24, 0.22)';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, w - 4, h - 4);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function createPlasterWallPbr(): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  if (cachedPlasterPbr) return cachedPlasterPbr;

  const size = 256;
  const colorCanvas = document.createElement('canvas');
  const bumpCanvas = document.createElement('canvas');
  colorCanvas.width = bumpCanvas.width = size;
  colorCanvas.height = bumpCanvas.height = size;

  const cCtx = colorCanvas.getContext('2d')!;
  const bCtx = bumpCanvas.getContext('2d')!;

  cCtx.fillStyle = '#F3EEE6';
  cCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  for (let i = 0; i < 3600; i++) {
    const x = (Math.sin(i * 12.9898 + 0.5) * 0.5 + 0.5) * size;
    const y = (Math.cos(i * 78.233 + 1.9) * 0.5 + 0.5) * size;

    cCtx.fillStyle =
      i % 2 === 0 ? 'rgba(130, 118, 104, 0.02)' : 'rgba(255, 255, 255, 0.024)';
    cCtx.fillRect(x, y, 2, 2);

    bCtx.fillStyle = i % 2 === 0 ? '#747474' : '#8C8C8C';
    bCtx.fillRect(x, y, 1.8, 1.8);
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(4, 3);
  map.anisotropy = 4;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(4, 3);
  bumpMap.anisotropy = 4;

  cachedPlasterPbr = { map, bumpMap };
  return cachedPlasterPbr;
}

export function createMaroonRugPbr(): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  if (cachedMaroonRugPbr) return cachedMaroonRugPbr;

  const cCanvas = document.createElement('canvas');
  const bCanvas = document.createElement('canvas');
  cCanvas.width = bCanvas.width = 512;
  cCanvas.height = bCanvas.height = 384;

  const ctx = cCanvas.getContext('2d')!;
  const bCtx = bCanvas.getContext('2d')!;
  ctx.scale(0.5, 0.5);
  bCtx.scale(0.5, 0.5);

  const w = 1024;
  const h = 768;

  ctx.fillStyle = '#5C1622';
  ctx.fillRect(0, 0, w, h);

  const rad = ctx.createRadialGradient(w / 2, h / 2, 60, w / 2, h / 2, 580);
  rad.addColorStop(0, 'rgba(122, 34, 48, 0.45)');
  rad.addColorStop(1, 'rgba(54, 12, 18, 0.55)');
  ctx.fillStyle = rad;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = '#2B170F';
  ctx.lineWidth = 28;
  ctx.strokeRect(26, 26, w - 52, h - 52);

  ctx.strokeStyle = '#3E2216';
  ctx.lineWidth = 10;
  ctx.strokeRect(58, 58, w - 116, h - 116);

  ctx.strokeStyle = '#26140D';
  ctx.lineWidth = 4;
  ctx.strokeRect(94, 94, w - 188, h - 188);

  ctx.fillStyle = '#2B170F';
  for (let x = 84; x <= w - 84; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 66);
    ctx.lineTo(x + 12, 76);
    ctx.lineTo(x, 86);
    ctx.lineTo(x - 12, 76);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x, h - 86);
    ctx.lineTo(x + 12, h - 76);
    ctx.lineTo(x, h - 66);
    ctx.lineTo(x - 12, h - 76);
    ctx.closePath();
    ctx.fill();
  }
  for (let y = 110; y <= h - 110; y += 48) {
    ctx.beginPath();
    ctx.moveTo(76, y - 12);
    ctx.lineTo(86, y);
    ctx.lineTo(76, y + 12);
    ctx.lineTo(66, y);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(w - 76, y - 12);
    ctx.lineTo(w - 66, y);
    ctx.lineTo(w - 76, y + 12);
    ctx.lineTo(w - 86, y);
    ctx.closePath();
    ctx.fill();
  }

  ctx.strokeStyle = 'rgba(43, 23, 15, 0.42)';
  ctx.lineWidth = 3;
  const step = 64;
  for (let x = 112; x < w - 112; x += step) {
    for (let y = 112; y < h - 112; y += step) {
      ctx.beginPath();
      ctx.moveTo(x + step / 2, y);
      ctx.lineTo(x + step, y + step / 2);
      ctx.lineTo(x + step / 2, y + step);
      ctx.lineTo(x, y + step / 2);
      ctx.closePath();
      ctx.stroke();

      ctx.fillStyle = 'rgba(61, 34, 22, 0.55)';
      ctx.beginPath();
      ctx.arc(x + step / 2, y + step / 2, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const cx = w / 2;
  const cy = h / 2;
  ctx.fillStyle = '#331B12';
  ctx.beginPath();
  ctx.moveTo(cx, cy - 135);
  ctx.lineTo(cx + 185, cy);
  ctx.lineTo(cx, cy + 135);
  ctx.lineTo(cx - 185, cy);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#24120B';
  ctx.lineWidth = 6;
  ctx.stroke();

  ctx.fillStyle = '#6B1C29';
  ctx.beginPath();
  ctx.moveTo(cx, cy - 92);
  ctx.lineTo(cx + 126, cy);
  ctx.lineTo(cx, cy + 92);
  ctx.lineTo(cx - 126, cy);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#2B170F';
  ctx.beginPath();
  ctx.moveTo(cx, cy - 42);
  ctx.lineTo(cx + 58, cy);
  ctx.lineTo(cx, cy + 42);
  ctx.lineTo(cx - 58, cy);
  ctx.closePath();
  ctx.fill();

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 6) {
    ctx.fillStyle = y % 12 === 0 ? 'rgba(20, 8, 6, 0.08)' : 'rgba(255, 220, 210, 0.03)';
    ctx.fillRect(0, y, w, 2);
    bCtx.fillStyle = y % 12 === 0 ? '#626262' : '#9B9B9B';
    bCtx.fillRect(0, y, w, 2);
  }

  const map = new THREE.CanvasTexture(cCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;

  const bumpMap = new THREE.CanvasTexture(bCanvas);
  bumpMap.anisotropy = 4;

  cachedMaroonRugPbr = { map, bumpMap };
  return cachedMaroonRugPbr;
}

function fitTextEllipsis(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  const clean = text.trim();
  if (ctx.measureText(clean).width <= maxWidth) return clean;
  let out = clean;
  while (out.length > 1 && ctx.measureText(out + '...').width > maxWidth) {
    out = out.slice(0, -1);
  }
  return out.trimEnd() + '...';
}

function wrapTextSafe(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
): number {
  const rawWords = text.split(/\s+/).filter(Boolean);
  const tokens: string[] = [];
  for (const word of rawWords) {
    if (ctx.measureText(word).width <= maxWidth) {
      tokens.push(word);
    } else {
      let chunk = '';
      for (const ch of word) {
        if (chunk && ctx.measureText(chunk + ch).width > maxWidth) {
          tokens.push(chunk);
          chunk = ch;
        } else {
          chunk += ch;
        }
      }
      if (chunk) tokens.push(chunk);
    }
  }

  const lines: string[] = [];
  let current = '';

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const candidate = current ? `${current} ${token}` : token;

    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = token;
      if (lines.length === maxLines - 1) {
        const rest = [current, ...tokens.slice(i + 1)].join(' ');
        lines.push(fitTextEllipsis(ctx, rest, maxWidth));
        current = '';
        break;
      }
    } else {
      current = candidate;
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(fitTextEllipsis(ctx, current, maxWidth));
  }

  for (const line of lines) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }

  return y;
}

export function createCorkboardTexture(): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  if (cachedCorkboardPbr) return cachedCorkboardPbr;

  const size = 256;
  const cCanvas = document.createElement('canvas');
  const bCanvas = document.createElement('canvas');
  cCanvas.width = bCanvas.width = size;
  cCanvas.height = bCanvas.height = size;

  const ctx = cCanvas.getContext('2d')!;
  const bCtx = bCanvas.getContext('2d')!;

  ctx.fillStyle = '#B78A5B';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  const specks = ['#9A6E43', '#C99E6E', '#835933', '#D4AD80', '#A4784B'];
  for (let i = 0; i < 2400; i++) {
    const x = (Math.sin(i * 19.13) * 0.5 + 0.5) * size;
    const y = (Math.cos(i * 47.71) * 0.5 + 0.5) * size;
    const w = 1.8 + (i % 3);
    const h = 1.8 + ((i * 3) % 3);
    ctx.fillStyle = specks[i % specks.length];
    ctx.fillRect(x, y, w, h);

    bCtx.fillStyle = i % 2 === 0 ? '#5E5E5E' : '#A6A6A6';
    bCtx.fillRect(x, y, w, h);
  }

  const map = new THREE.CanvasTexture(cCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3, 2);
  map.anisotropy = 4;

  const bumpMap = new THREE.CanvasTexture(bCanvas);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(3, 2);

  cachedCorkboardPbr = { map, bumpMap };
  return cachedCorkboardPbr;
}

function formatPostcardDateOnly(postcard: GuestbookPostcard): string {
  if (postcard.createdAt) {
    const d = new Date(postcard.createdAt);
    if (!Number.isNaN(d.getTime())) {
      return d
        .toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
        .toUpperCase();
    }
  }
  return (postcard.dateLabel || '').toUpperCase();
}

export function createPostcardTexture(postcard: GuestbookPostcard): THREE.CanvasTexture {
  const w = 512;
  const h = 360;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const accent =
    postcard.pinColor && postcard.pinColor.toUpperCase() !== '#D94E28'
      ? postcard.pinColor
      : '#4A2E1B';

  ctx.fillStyle = '#FAF3E3';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(100, 74, 52, 0.25)';
  ctx.lineWidth = 4;
  ctx.strokeRect(14, 14, w - 28, h - 28);

  ctx.save();
  ctx.beginPath();
  ctx.rect(22, 22, w - 44, h - 44);
  ctx.clip();

  ctx.fillStyle = accent;
  ctx.fillRect(28, 28, 72, 6);

  ctx.fillStyle = '#7A6858';
  ctx.font = 'bold 13px monospace';
  ctx.fillText(postcard.isPinned ? 'CURATOR PINNED NOTE' : 'VISITOR POSTCARD', 28, 56);

  ctx.strokeStyle = accent;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(w - 94, 28, 66, 74);
  ctx.fillStyle = accent;
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('ORIHOUR', w - 61, 58);
  ctx.font = '11px monospace';
  ctx.fillText('POST', w - 61, 80);
  ctx.textAlign = 'left';

  const safeTitle = postcard.songTitle.slice(0, POSTCARD_LIMITS.songTitle);
  const safeArtist = postcard.artist.slice(0, POSTCARD_LIMITS.artist);
  const safeSender = postcard.senderName.slice(0, POSTCARD_LIMITS.senderName);
  const safeReason = postcard.reason.slice(0, POSTCARD_LIMITS.reason);

  ctx.fillStyle = '#1B1612';
  const titleFontSize = safeTitle.length > 24 ? 21 : safeTitle.length > 18 ? 24 : 27;
  ctx.font = `bold ${titleFontSize}px Georgia, serif`;
  ctx.fillText(fitTextEllipsis(ctx, safeTitle, 358), 28, 106);

  ctx.fillStyle = '#6E462C';
  ctx.font = 'italic 18px Georgia, serif';
  ctx.fillText(fitTextEllipsis(ctx, `by ${safeArtist}`, 358), 28, 136);

  ctx.strokeStyle = 'rgba(110, 70, 44, 0.16)';
  ctx.lineWidth = 1.5;
  for (let ly = 186; ly <= 282; ly += 32) {
    ctx.beginPath();
    ctx.moveTo(28, ly);
    ctx.lineTo(w - 28, ly);
    ctx.stroke();
  }

  ctx.fillStyle = '#312A24';
  ctx.font = '17px sans-serif';
  wrapTextSafe(ctx, `"${safeReason}"`, 28, 180, w - 60, 32, 4);

  ctx.fillStyle = '#7A6858';
  ctx.font = 'bold 13.5px monospace';
  ctx.fillText(fitTextEllipsis(ctx, `FROM: ${safeSender.toUpperCase()}`, 265), 28, h - 28);
  ctx.textAlign = 'right';
  ctx.fillText(formatPostcardDateOnly(postcard), w - 28, h - 28);
  ctx.textAlign = 'left';

  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function createNotepadTexture(
  vinyl: VinylRecord | null,
  isPlaying: boolean
): THREE.CanvasTexture {
  const w = 768;
  const h = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const paperGrad = ctx.createLinearGradient(0, 0, w, h);
  paperGrad.addColorStop(0, '#EFE7D8');
  paperGrad.addColorStop(0.5, '#EBE2D2');
  paperGrad.addColorStop(1, '#E2D6C3');
  ctx.fillStyle = paperGrad;
  ctx.fillRect(0, 0, w, h);

  const spineShadow = ctx.createLinearGradient(0, 0, 54, 0);
  spineShadow.addColorStop(0, 'rgba(38, 24, 16, 0.24)');
  spineShadow.addColorStop(0.5, 'rgba(38, 24, 16, 0.06)');
  spineShadow.addColorStop(1, 'rgba(38, 24, 16, 0)');
  ctx.fillStyle = spineShadow;
  ctx.fillRect(0, 0, 54, h);

  for (let i = 0; i < 1600; i++) {
    const x = (Math.sin(i * 19.31 + 1.1) * 0.5 + 0.5) * w;
    const y = (Math.cos(i * 53.77 + 2.7) * 0.5 + 0.5) * h;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(92, 68, 48, 0.035)' : 'rgba(255, 252, 246, 0.05)';
    ctx.fillRect(x, y, 2, 2);
  }

  ctx.strokeStyle = 'rgba(110, 78, 56, 0.22)';
  ctx.lineWidth = 2;
  ctx.strokeRect(42, 42, w - 84, h - 84);

  ctx.fillStyle = '#4A2E1B';
  ctx.font = 'bold 18px monospace';
  ctx.fillText('ORIHOUR · LISTENING LOG', 78, 94);

  ctx.textAlign = 'right';
  ctx.fillStyle = !vinyl ? '#7C6D5E' : isPlaying ? '#2E6F4E' : '#7C6D5E';
  ctx.font = 'bold 17px monospace';
  ctx.fillText(
    !vinyl ? '○ EMPTY PLATTER' : isPlaying ? '● NOW SPINNING' : '○ STANDBY',
    w - 76,
    94
  );
  ctx.textAlign = 'left';

  ctx.fillStyle = '#4A2E1B';
  ctx.fillRect(78, 114, 140, 3);
  ctx.fillStyle = 'rgba(74, 46, 27, 0.22)';
  ctx.fillRect(218, 115, w - 294, 1.5);

  ctx.strokeStyle = 'rgba(118, 96, 78, 0.16)';
  ctx.lineWidth = 1.5;
  for (let ly = 216; ly < 928; ly += 46) {
    ctx.beginPath();
    ctx.moveTo(78, ly);
    ctx.lineTo(w - 76, ly);
    ctx.stroke();
  }

  if (!vinyl) {
    ctx.fillStyle = '#6E462C';
    ctx.font = 'bold 17px monospace';
    ctx.fillText('TURNTABLE STANDBY', 78, 166);

    ctx.fillStyle = '#1D1713';
    ctx.font = 'bold 46px Georgia, serif';
    ctx.fillText('No Record on Platter', 78, 246);

    ctx.fillStyle = '#5C4D40';
    ctx.font = 'italic 26px Georgia, serif';
    wrapTextSafe(
      ctx,
      'The platter and cover display stand are resting quietly right now.',
      78,
      308,
      w - 156,
      44,
      3
    );

    ctx.fillStyle = '#312923';
    ctx.font = '25px Georgia, serif';
    wrapTextSafe(
      ctx,
      'Click the wooden vinyl rack on the left or open Collection to place a record onto the turntable and read its liner notes.',
      78,
      446,
      w - 156,
      46,
      5
    );

    ctx.fillStyle = '#8A7968';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('PICK A RECORD FROM THE RACK TO BEGIN', 78, h - 68);
  } else {
    const genreLabel = (vinyl.genre || vinyl.mood || 'Indie').toUpperCase();
    const typeLabel = (vinyl.releaseType || 'Song').toUpperCase();
    const isSong = vinyl.releaseType === 'Song';

    ctx.fillStyle = '#6E462C';
    ctx.font = 'bold 17px monospace';
    ctx.fillText(
      `${genreLabel} · ${typeLabel} · ${vinyl.releaseYear} · ${
        isSong ? vinyl.duration : `${vinyl.tracks?.length || 0} TRACKS`
      }`,
      78,
      162
    );

    ctx.fillStyle = '#1D1713';
    ctx.font = 'bold 42px Georgia, serif';
    let y = wrapTextSafe(ctx, vinyl.title, 78, 212, w - 156, 48, 2);

    ctx.fillStyle = '#5C4D40';
    ctx.font = 'italic 25px Georgia, serif';
    const subline =
      isSong && vinyl.album ? `${vinyl.artist} - ${vinyl.album}` : vinyl.artist;
    y = wrapTextSafe(ctx, subline, 78, y + 6, w - 156, 34, 2);

    y += 30;
    const sectionHeaderY = y;
    ctx.fillStyle = '#4A2E1B';
    ctx.font = 'bold 15px monospace';
    ctx.fillText(isSong ? 'FAVORITE LYRIC' : 'FAVORITE SONG', 78, sectionHeaderY);

    const quoteTopY = sectionHeaderY + 46;
    ctx.fillStyle = '#241D18';
    ctx.font = 'italic 29px Georgia, serif';
    const highlightText = isSong
      ? vinyl.favoriteLyric
        ? `"${vinyl.favoriteLyric}"`
        : '"-"'
      : vinyl.favoriteSong || vinyl.tracks?.[0]?.title || '-';
    const afterQuoteY = wrapTextSafe(
      ctx,
      highlightText,
      102,
      quoteTopY,
      w - 180,
      44,
      isSong ? 3 : 2
    );

    const barTop = quoteTopY - 26;
    const barBottom = Math.max(barTop + 30, afterQuoteY - 32);
    ctx.fillStyle = '#4A2E1B';
    ctx.fillRect(78, barTop, 4, barBottom - barTop);

    const notesHeaderY = afterQuoteY + 26;
    ctx.fillStyle = '#4A2E1B';
    ctx.font = 'bold 15px monospace';
    ctx.fillText('CURATOR NOTES', 78, notesHeaderY);

    ctx.fillStyle = '#312923';
    ctx.font = '25px Georgia, serif';
    wrapTextSafe(
      ctx,
      vinyl.linerNotes || 'Curator notes have not been written for this pressing yet.',
      78,
      notesHeaderY + 42,
      w - 156,
      44,
      6
    );

    ctx.fillStyle = '#8A7968';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('CLICK JOURNAL TO READ · ESC TO PUT DOWN', 78, h - 68);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function renderSleeveCanvas(
  vinyl: VinylRecord,
  coverImg?: HTMLImageElement | null
): HTMLCanvasElement {
  const size = coverImg ? 768 : 512;
  const s = size / 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const base =
    vinyl.labelColor && vinyl.labelColor.toUpperCase() !== '#D94E28'
      ? vinyl.labelColor
      : '#4A2E1B';

  if (coverImg) {
    const imgRatio = coverImg.naturalWidth / Math.max(1, coverImg.naturalHeight);
    let drawW = size;
    let drawH = size;
    let ox = 0;
    let oy = 0;
    if (imgRatio > 1) {
      drawW = size * imgRatio;
      ox = -(drawW - size) * 0.5;
    } else if (imgRatio < 1) {
      drawH = size / imgRatio;
      oy = -(drawH - size) * 0.5;
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(coverImg, ox, oy, drawW, drawH);

    const edgeVig = ctx.createRadialGradient(
      size * 0.5,
      size * 0.5,
      size * 0.36,
      size * 0.5,
      size * 0.5,
      size * 0.72
    );
    edgeVig.addColorStop(0, 'rgba(0,0,0,0)');
    edgeVig.addColorStop(1, 'rgba(0,0,0,0.16)');
    ctx.fillStyle = edgeVig;
    ctx.fillRect(0, 0, size, size);

    if (vinyl.showCoverOverlay !== false) {
      const headerGrad = ctx.createLinearGradient(0, 0, 0, 128 * s);
      headerGrad.addColorStop(0, 'rgba(12, 13, 18, 0.86)');
      headerGrad.addColorStop(0.68, 'rgba(12, 13, 18, 0.62)');
      headerGrad.addColorStop(1, 'rgba(12, 13, 18, 0)');
      ctx.fillStyle = headerGrad;
      ctx.fillRect(0, 0, size, 128 * s);

      ctx.fillStyle = base;
      ctx.fillRect(24 * s, 84 * s, 64 * s, 3 * s);

      const titleSize = vinyl.title.length > 26 ? 21 * s : 25 * s;
      ctx.fillStyle = '#F8F6F0';
      ctx.font = `bold ${titleSize}px sans-serif`;
      ctx.fillText(fitTextEllipsis(ctx, vinyl.title, size - 48 * s), 24 * s, 42 * s);

      ctx.fillStyle = '#E2E8F0';
      ctx.font = `600 ${16 * s}px monospace`;
      ctx.fillText(
        fitTextEllipsis(ctx, `${vinyl.artist} - ${vinyl.releaseYear}`, size - 48 * s),
        24 * s,
        70 * s
      );
    }

    return canvas;
  }

  const style = vinyl.artStyle % 4;
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, base);
  grad.addColorStop(1, '#12151E');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  if (style === 0) {
    for (let r = 215; r >= 45; r -= 42) {
      ctx.beginPath();
      ctx.arc(256, 286, r, 0, Math.PI * 2);
      ctx.fillStyle = r % 84 === 0 ? 'rgba(15,17,24,0.42)' : 'rgba(248,246,240,0.14)';
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(348, 198, 48, 0, Math.PI * 2);
    ctx.fillStyle = '#F8F6F0';
    ctx.fill();
  } else if (style === 1) {
    ctx.fillStyle = 'rgba(15,17,24,0.46)';
    ctx.fillRect(42, 118, 188, 350);
    ctx.fillStyle = 'rgba(248,246,240,0.92)';
    ctx.beginPath();
    ctx.arc(345, 290, 92, 0, Math.PI * 2);
    ctx.fill();
  } else if (style === 2) {
    ctx.strokeStyle = 'rgba(248,246,240,0.58)';
    ctx.lineWidth = 3;
    for (let y = 140; y <= 435; y += 30) {
      ctx.beginPath();
      ctx.moveTo(42, y);
      ctx.bezierCurveTo(185, y - 34, 325, y + 34, 470, y);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = 'rgba(248,246,240,0.22)';
    ctx.beginPath();
    ctx.moveTo(0, 512);
    ctx.lineTo(310, 0);
    ctx.lineTo(512, 0);
    ctx.lineTo(202, 512);
    ctx.closePath();
    ctx.fill();
  }

  if (vinyl.showCoverOverlay !== false) {
    ctx.fillStyle = 'rgba(12, 14, 20, 0.88)';
    ctx.fillRect(0, 0, 512, 88);
    ctx.fillStyle = base;
    ctx.fillRect(0, 84, 512, 4);

    ctx.fillStyle = '#F8F6F0';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(fitTextEllipsis(ctx, vinyl.title, 464), 24, 41);

    ctx.fillStyle = '#CBD5E1';
    ctx.font = '17px monospace';
    ctx.fillText(fitTextEllipsis(ctx, `${vinyl.artist} - ${vinyl.releaseYear}`, 464), 24, 69);
  }

  return canvas;
}

export function getSleeveDataUrl(vinyl: VinylRecord): string {
  if (vinyl.coverUrl) return vinyl.coverUrl;
  const key = `${vinyl.id}_${vinyl.title}_${vinyl.artist}_${vinyl.releaseYear}_${vinyl.labelColor}_${vinyl.artStyle}_${vinyl.showCoverOverlay}_v5`;
  if (!sleeveDataUrlCache.has(key)) {
    sleeveDataUrlCache.set(key, renderSleeveCanvas(vinyl).toDataURL('image/jpeg', 0.9));
  }
  return sleeveDataUrlCache.get(key)!;
}

export function createSleeveTexture(
  vinyl: VinylRecord,
  coverImg?: HTMLImageElement | null
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(renderSleeveCanvas(vinyl, coverImg));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  return tex;
}

export function createVinylDiscTexture(vinyl: VinylRecord): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const cx = 256;
  const cy = 256;

  ctx.fillStyle = '#0F1116';
  ctx.fillRect(0, 0, 512, 512);

  const sheen = ctx.createConicGradient(0.4, cx, cy);
  sheen.addColorStop(0, 'rgba(255,255,255,0.02)');
  sheen.addColorStop(0.14, 'rgba(255,255,255,0.2)');
  sheen.addColorStop(0.28, 'rgba(255,255,255,0.02)');
  sheen.addColorStop(0.55, 'rgba(255,255,255,0.02)');
  sheen.addColorStop(0.68, 'rgba(255,255,255,0.18)');
  sheen.addColorStop(0.82, 'rgba(255,255,255,0.02)');
  sheen.addColorStop(1, 'rgba(255,255,255,0.02)');
  ctx.fillStyle = sheen;
  ctx.beginPath();
  ctx.arc(cx, cy, 250, 0, Math.PI * 2);
  ctx.fill();

  for (let r = 96; r < 246; r += 5) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = r % 20 === 0 ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  const labelColor =
    vinyl.labelColor && vinyl.labelColor.toUpperCase() !== '#D94E28'
      ? vinyl.labelColor
      : '#4A2E1B';

  ctx.beginPath();
  ctx.arc(cx, cy, 88, 0, Math.PI * 2);
  ctx.fillStyle = labelColor;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, 80, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.68)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.font = 'bold 12px monospace';
  ctx.fillText(`ORIHOUR · ${vinyl.releaseYear}`, cx, cy - 38);

  const labelTitleSize = vinyl.title.length > 20 ? 12 : 14;
  ctx.font = `bold ${labelTitleSize}px sans-serif`;
  ctx.fillText(fitTextEllipsis(ctx, vinyl.title, 136), cx, cy + 38);

  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  ctx.font = '10px monospace';
  ctx.fillText(fitTextEllipsis(ctx, vinyl.artist, 126), cx, cy + 56);

  ctx.beginPath();
  ctx.arc(cx, cy, 10, 0, Math.PI * 2);
  ctx.fillStyle = '#090A0D';
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Mid-Century Warm Backlit Split-Flip Chronometer Face
export function drawFlipClockFace(
  canvas: HTMLCanvasElement,
  hourDecimal: number,
  isLive: boolean,
  phaseLabel: string
) {
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;

  const totalMins = Math.floor((((hourDecimal % 24) + 24) % 24) * 60);
  const hh = String(Math.floor(totalMins / 60)).padStart(2, '0');
  const mm = String(totalMins % 60).padStart(2, '0');

  const cavityGrad = ctx.createLinearGradient(0, 0, 0, h);
  cavityGrad.addColorStop(0, '#1B120C');
  cavityGrad.addColorStop(0.5, '#251911');
  cavityGrad.addColorStop(1, '#160E09');
  ctx.fillStyle = cavityGrad;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#DFBA74';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ORIHOUR · CHRONOMETER', w * 0.5, 20);

  const drawFlipTile = (x: number, y: number, tw: number, th: number, digits: string) => {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 4, tw, th, 14);
    ctx.fill();

    const tileGrad = ctx.createLinearGradient(0, y, 0, y + th);
    tileGrad.addColorStop(0.0, '#FFF8EC');
    tileGrad.addColorStop(0.48, '#F6EAD5');
    tileGrad.addColorStop(0.52, '#ECDCBF');
    tileGrad.addColorStop(1.0, '#DFCAAB');
    ctx.fillStyle = tileGrad;
    ctx.beginPath();
    ctx.roundRect(x, y, tw, th, 14);
    ctx.fill();

    ctx.strokeStyle = 'rgba(74, 46, 27, 0.32)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#1E130B';
    ctx.font = 'bold 112px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(digits, x + tw * 0.5, y + th * 0.52);

    const splitY = y + th * 0.5;
    ctx.fillStyle = '#1A110B';
    ctx.fillRect(x, splitY - 2.2, tw, 4.4);

    const creaseShade = ctx.createLinearGradient(0, splitY + 2, 0, splitY + 15);
    creaseShade.addColorStop(0, 'rgba(28, 18, 12, 0.25)');
    creaseShade.addColorStop(1, 'rgba(28, 18, 12, 0)');
    ctx.fillStyle = creaseShade;
    ctx.fillRect(x + 2, splitY + 2, tw - 4, 13);

    ctx.fillStyle = '#C89B54';
    ctx.fillRect(x - 2, splitY - 12, 8, 24);
    ctx.fillRect(x + tw - 6, splitY - 12, 8, 24);
  };

  drawFlipTile(28, 36, 206, 162, hh);
  drawFlipTile(278, 36, 206, 162, mm);

  ctx.fillStyle = '#E6C07B';
  ctx.beginPath();
  ctx.arc(w * 0.5, 95, 5.5, 0, Math.PI * 2);
  ctx.arc(w * 0.5, 139, 5.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = 'bold 15px monospace';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = isLive ? '#6EE7B7' : '#F3C982';
  ctx.textAlign = 'left';
  ctx.fillText(isLive ? '● LIVE' : '◐ SCRUB', 30, 226);

  ctx.fillStyle = '#E2CEB4';
  ctx.textAlign = 'right';
  ctx.fillText(phaseLabel.toUpperCase(), w - 30, 226);
}

export function createWallPlaqueTexture(config: RoomConfig): THREE.CanvasTexture {
  const w = 1200;
  const h = 250;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const woodGrad = ctx.createLinearGradient(0, 0, w, h);
  woodGrad.addColorStop(0, '#462B1B');
  woodGrad.addColorStop(0.5, '#3B2315');
  woodGrad.addColorStop(1, '#2D1A10');
  ctx.fillStyle = woodGrad;
  ctx.fillRect(0, 0, w, h);

  for (let y = 0; y < h; y += 3) {
    const wave = Math.sin(y * 0.055) * 8 + Math.cos(y * 0.14) * 3;
    const isDark = y % 6 === 0 || y % 9 === 0;
    ctx.strokeStyle = isDark ? 'rgba(22, 11, 6, 0.42)' : 'rgba(148, 102, 68, 0.14)';
    ctx.lineWidth = isDark ? 1.8 : 1.0;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(w * 0.35, y + wave, w * 0.65, y - wave, w, y);
    ctx.stroke();
  }

  const vig = ctx.createRadialGradient(w * 0.5, h * 0.5, 180, w * 0.5, h * 0.5, w * 0.56);
  vig.addColorStop(0, 'rgba(255, 220, 175, 0.06)');
  vig.addColorStop(1, 'rgba(15, 8, 4, 0.42)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(212, 172, 106, 0.55)';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(22, 22, w - 44, h - 44);

  ctx.strokeStyle = 'rgba(212, 172, 106, 0.25)';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(30, 30, w - 60, h - 60);

  const spacedTitle = config.wallTitle.toUpperCase().split('').join('  ');
  ctx.textAlign = 'center';
  ctx.font = '400 76px Georgia, serif';

  ctx.fillStyle = 'rgba(14, 7, 3, 0.72)';
  ctx.fillText(spacedTitle, w * 0.5 + 2, 128);

  const brassTextGrad = ctx.createLinearGradient(0, 62, 0, 134);
  brassTextGrad.addColorStop(0, '#F6E8CE');
  brassTextGrad.addColorStop(0.55, '#DFBE86');
  brassTextGrad.addColorStop(1, '#B88F52');
  ctx.fillStyle = brassTextGrad;
  ctx.fillText(spacedTitle, w * 0.5, 126);

  const ruleY = 154;
  ctx.strokeStyle = 'rgba(212, 172, 106, 0.48)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(w * 0.5 - 195, ruleY);
  ctx.lineTo(w * 0.5 - 14, ruleY);
  ctx.moveTo(w * 0.5 + 14, ruleY);
  ctx.lineTo(w * 0.5 + 195, ruleY);
  ctx.stroke();

  ctx.fillStyle = '#4D0F18';
  ctx.beginPath();
  ctx.moveTo(w * 0.5, ruleY - 6);
  ctx.lineTo(w * 0.5 + 6, ruleY);
  ctx.lineTo(w * 0.5, ruleY + 6);
  ctx.lineTo(w * 0.5 - 6, ruleY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#D5BC96';
  ctx.font = '600 18px monospace';
  ctx.fillText(config.wallSubtitle.toUpperCase(), w * 0.5, 194);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function createPosterFallbackTexture(poster: PosterItem): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 700;
  const ctx = canvas.getContext('2d')!;

  const accent =
    poster.accentColor && poster.accentColor.toUpperCase() !== '#D94E28'
      ? poster.accentColor
      : '#4A2E1B';

  ctx.fillStyle = '#F5F0E6';
  ctx.fillRect(0, 0, 512, 700);

  const artX = 34;
  const artY = 34;
  const artW = 444;
  const artH = 500;

  const grad = ctx.createLinearGradient(artX, artY, artX + artW, artY + artH);
  grad.addColorStop(0, accent);
  grad.addColorStop(1, '#111827');
  ctx.fillStyle = grad;
  ctx.fillRect(artX, artY, artW, artH);

  const st = poster.style % 4;
  if (st === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    ctx.arc(256, 260, 155, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#F5F0E6';
    ctx.beginPath();
    ctx.arc(315, 200, 46, 0, Math.PI * 2);
    ctx.fill();
  } else if (st === 1) {
    ctx.strokeStyle = 'rgba(245, 240, 230, 0.55)';
    ctx.lineWidth = 3;
    for (let y = 90; y < 480; y += 26) {
      ctx.beginPath();
      ctx.moveTo(artX + 20, y);
      ctx.bezierCurveTo(180, y - 38, 330, y + 38, artX + artW - 20, y);
      ctx.stroke();
    }
  } else if (st === 2) {
    for (let r = 185; r >= 35; r -= 30) {
      ctx.beginPath();
      ctx.arc(256, 285, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(245, 240, 230, 0.35)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = 'rgba(245, 240, 230, 0.18)';
    ctx.fillRect(72, 84, 150, 390);
    ctx.fillStyle = 'rgba(245, 240, 230, 0.85)';
    ctx.beginPath();
    ctx.arc(320, 290, 82, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#18181B';
  ctx.font = 'bold 34px Georgia, serif';
  ctx.fillText(poster.title.slice(0, 20), 34, 594);

  ctx.fillStyle = '#64748B';
  ctx.font = '600 18px monospace';
  ctx.fillText(poster.subtitle.slice(0, 32), 34, 634);

  ctx.fillStyle = accent;
  ctx.fillRect(34, 654, 72, 4);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function createMeadowPbr(): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  if (cachedMeadowPbr) return cachedMeadowPbr;

  const size = 512;
  const colorCanvas = document.createElement('canvas');
  const bumpCanvas = document.createElement('canvas');
  colorCanvas.width = bumpCanvas.width = size;
  colorCanvas.height = bumpCanvas.height = size;

  const cCtx = colorCanvas.getContext('2d')!;
  const bCtx = bumpCanvas.getContext('2d')!;

  cCtx.fillStyle = '#3F5A2E';
  cCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  const drawWrappedRadial = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    innerCol: string,
    outerCol: string
  ) => {
    for (let ox = -1; ox <= 1; ox++) {
      const px = x + ox * size;
      if (px + r < 0 || px - r > size) continue;
      for (let oy = -1; oy <= 1; oy++) {
        const py = y + oy * size;
        if (py + r < 0 || py - r > size) continue;
        const g = ctx.createRadialGradient(px, py, 2, px, py, r);
        g.addColorStop(0, innerCol);
        g.addColorStop(1, outerCol);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  const patches = [
    'rgba(78, 108, 52, 0.28)',
    'rgba(46, 68, 33, 0.30)',
    'rgba(82, 74, 48, 0.18)',
    'rgba(62, 90, 44, 0.26)',
    'rgba(102, 122, 62, 0.20)',
    'rgba(52, 74, 38, 0.24)',
  ];
  for (let i = 0; i < 140; i++) {
    const x = (Math.sin(i * 17.13 + 0.6) * 0.5 + 0.5) * size;
    const y = (Math.cos(i * 31.71 + 2.2) * 0.5 + 0.5) * size;
    const r = 24 + (i % 56);
    drawWrappedRadial(cCtx, x, y, r, patches[i % patches.length], 'rgba(0,0,0,0)');
    drawWrappedRadial(
      bCtx,
      x,
      y,
      r,
      i % 2 === 0 ? 'rgba(154,154,154,0.14)' : 'rgba(102,102,102,0.14)',
      'rgba(128,128,128,0)'
    );
  }

  for (let i = 0; i < 5500; i++) {
    const x = (Math.sin(i * 12.9898 + 1.3) * 0.5 + 0.5) * size;
    const y = (Math.cos(i * 78.233 + 3.7) * 0.5 + 0.5) * size;
    const len = 3 + (i % 6);
    const lean = ((i % 7) - 3) * 0.6;

    const strokeCol =
      i % 5 === 0
        ? 'rgba(114, 140, 70, 0.42)'
        : i % 5 === 1
        ? 'rgba(46, 68, 33, 0.45)'
        : i % 5 === 2
        ? 'rgba(72, 100, 48, 0.42)'
        : i % 5 === 3
        ? 'rgba(84, 74, 50, 0.26)'
        : 'rgba(130, 152, 80, 0.30)';

    cCtx.strokeStyle = strokeCol;
    cCtx.lineWidth = 1.2;

    const drawStroke = (ox: number, oy: number) => {
      cCtx.beginPath();
      cCtx.moveTo(x + ox, y + oy);
      cCtx.lineTo(x + ox + lean, y + oy - len);
      cCtx.stroke();
    };
    drawStroke(0, 0);
    if (y - len < 0) drawStroke(0, size);
    if (x + lean < 0) drawStroke(size, 0);
    if (x + lean > size) drawStroke(-size, 0);
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(8, 6);
  map.generateMipmaps = true;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.anisotropy = 4;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(8, 6);
  bumpMap.generateMipmaps = true;
  bumpMap.minFilter = THREE.LinearMipmapLinearFilter;

  cachedMeadowPbr = { map, bumpMap };
  return cachedMeadowPbr;
}

export function createGrassClumpTexture(): THREE.CanvasTexture {
  if (cachedGrassClumpTex) return cachedGrassClumpTex;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  const hash = (n: number) => {
    const s = Math.sin(n * 91.7 + 17.3) * 43758.5453;
    return s - Math.floor(s);
  };

  for (let i = 0; i < 24; i++) {
    const r1 = hash(i * 2.3 + 4.1);
    const r2 = hash(i * 4.7 + 1.9);
    const baseX = 18 + (i / 23) * 220 + (r1 - 0.5) * 10;
    const height = 62 + r2 * 78;
    const bend = (r1 - 0.5) * 52 + (baseX - 128) * 0.22;
    const baseW = 9 + r2 * 5;

    const grad = ctx.createLinearGradient(baseX, size, baseX + bend, size - height);
    grad.addColorStop(0.0, '#3A5229');
    grad.addColorStop(0.55, '#4A6834');
    grad.addColorStop(1.0, '#628342');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(baseX - baseW * 0.5, size);
    ctx.quadraticCurveTo(baseX + bend * 0.35 - baseW * 0.25, size - height * 0.5, baseX + bend, size - height);
    ctx.quadraticCurveTo(baseX + bend * 0.35 + baseW * 0.25, size - height * 0.5, baseX + baseW * 0.5, size);
    ctx.closePath();
    ctx.fill();
  }

  for (let i = 0; i < 30; i++) {
    const r1 = hash(i * 1.7 + 0.5);
    const r2 = hash(i * 3.1 + 2.4);
    const r3 = hash(i * 5.9 + 4.1);

    const baseX = 22 + (i / 29) * 212 + (r1 - 0.5) * 14;
    const height = 104 + r2 * 136;
    const bend = (r3 - 0.5) * 86 + (baseX - 128) * 0.32;
    const baseW = 6.5 + r1 * 4.5;

    const grad = ctx.createLinearGradient(baseX, size, baseX + bend, size - height);
    grad.addColorStop(0.0, '#3F5A2E');
    grad.addColorStop(0.32, i % 4 === 0 ? '#4E7037' : '#53763B');
    grad.addColorStop(0.72, i % 5 === 0 ? '#77984C' : '#6D8F47');
    grad.addColorStop(1.0, i % 6 === 0 ? '#A8B76C' : '#90AC5C');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(baseX - baseW * 0.5, size);
    ctx.quadraticCurveTo(
      baseX + bend * 0.38 - baseW * 0.24,
      size - height * 0.55,
      baseX + bend,
      size - height
    );
    ctx.quadraticCurveTo(
      baseX + bend * 0.38 + baseW * 0.24,
      size - height * 0.55,
      baseX + baseW * 0.5,
      size
    );
    ctx.closePath();
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cachedGrassClumpTex = tex;
  return tex;
}

// Natural Organic Fissured Oak/Maple Bark PBR (Zero Artificial Vertical Barcode Stripes)
export function createBarkPbr(): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  if (cachedBarkPbr) return cachedBarkPbr;

  const size = 512;
  const cCanvas = document.createElement('canvas');
  const bCanvas = document.createElement('canvas');
  cCanvas.width = bCanvas.width = size;
  cCanvas.height = bCanvas.height = size;

  const ctx = cCanvas.getContext('2d')!;
  const bCtx = bCanvas.getContext('2d')!;

  const hash = (n: number) => {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
    return s - Math.floor(s);
  };

  // Warm deep weathered oak base
  ctx.fillStyle = '#3C2E24';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#6A6A6A';
  bCtx.fillRect(0, 0, size, size);

  // Helper to draw seamlessly tiled organic shapes across canvas edges
  const drawWrappedPlate = (
    cx: number,
    cy: number,
    rw: number,
    rh: number,
    tilt: number,
    fillColor: string,
    edgeColor: string,
    bumpVal: number
  ) => {
    for (let ox = -1; ox <= 1; ox++) {
      const px = cx + ox * size;
      if (px + rw * 2 < 0 || px - rw * 2 > size) continue;
      for (let oy = -1; oy <= 1; oy++) {
        const py = cy + oy * size;
        if (py + rh * 2 < 0 || py - rh * 2 > size) continue;

        const drawPath = (targetCtx: CanvasRenderingContext2D) => {
          targetCtx.save();
          targetCtx.translate(px, py);
          targetCtx.rotate(tilt);
          targetCtx.beginPath();
          targetCtx.moveTo(0, -rh);
          targetCtx.bezierCurveTo(rw * 0.9, -rh * 0.65, rw * 1.05, rh * 0.45, rw * 0.15, rh);
          targetCtx.bezierCurveTo(-rw * 0.85, rh * 0.72, -rw * 1.0, -rh * 0.4, 0, -rh);
          targetCtx.closePath();
        };

        drawPath(ctx);
        ctx.fillStyle = fillColor;
        ctx.fill();
        ctx.strokeStyle = edgeColor;
        ctx.lineWidth = 2.2;
        ctx.stroke();
        ctx.restore();

        drawPath(bCtx);
        const bv = Math.max(60, Math.min(205, bumpVal));
        bCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
        bCtx.fill();
        bCtx.strokeStyle = '#3B3B3B';
        bCtx.lineWidth = 2.6;
        bCtx.stroke();
        bCtx.restore();
      }
    }
  };

  // 1. Overlapping organic weathered bark plates (varied sizes, natural muted tones)
  const platePalette = [
    '#4A3B2F',
    '#534336',
    '#43352A',
    '#5A4A3C',
    '#3E3026',
    '#4E4034',
    '#57483B',
  ];

  for (let i = 0; i < 210; i++) {
    const x = hash(i * 1.73 + 0.4) * size;
    const y = hash(i * 2.91 + 1.8) * size;
    const rw = 10 + hash(i * 4.17 + 0.9) * 18;
    const rh = 34 + hash(i * 5.63 + 2.1) * 58;
    const tilt = (hash(i * 7.21 + 3.3) - 0.5) * 0.22;
    const fillCol = platePalette[Math.floor(hash(i * 9.13) * platePalette.length)];
    const bumpVal = 118 + Math.round(hash(i * 11.41) * 48);

    drawWrappedPlate(
      x,
      y,
      rw,
      rh,
      tilt,
      fillCol,
      'rgba(24, 17, 12, 0.44)',
      bumpVal
    );
  }

  // 2. Irregular organic wandering bark furrows (non-periodic, natural branching crevices)
  for (let i = 0; i < 48; i++) {
    let x = hash(i * 3.17 + 7.2) * size;
    let y = hash(i * 6.41 + 1.5) * size;
    const steps = 6 + Math.floor(hash(i * 8.11) * 7);
    const width = 1.6 + hash(i * 2.59) * 2.6;

    const pts: { x: number; y: number }[] = [{ x, y }];
    for (let s = 1; s <= steps; s++) {
      x += (hash(i * 19.3 + s * 4.7) - 0.5) * 16;
      y += 14 + hash(i * 13.7 + s * 6.1) * 20;
      pts.push({ x, y });
    }

    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        ctx.strokeStyle = 'rgba(22, 15, 10, 0.56)';
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        pts.forEach((pt, idx) => {
          const px = pt.x + ox * size;
          const py = pt.y + oy * size;
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();

        bCtx.strokeStyle = 'rgba(42, 42, 42, 0.65)';
        bCtx.lineWidth = width + 0.8;
        bCtx.lineCap = 'round';
        bCtx.lineJoin = 'round';
        bCtx.beginPath();
        pts.forEach((pt, idx) => {
          const px = pt.x + ox * size;
          const py = pt.y + oy * size;
          if (idx === 0) bCtx.moveTo(px, py);
          else bCtx.lineTo(px, py);
        });
        bCtx.stroke();
      }
    }
  }

  // 3. Subtle horizontal bark knots, lenticels & weathered moss/lichen hints
  for (let i = 0; i < 60; i++) {
    const x = hash(i * 14.3 + 2.1) * size;
    const y = hash(i * 21.7 + 5.4) * size;
    const r = 10 + hash(i * 7.8) * 22;
    const isMoss = i % 4 === 0;
    const col = isMoss ? 'rgba(74, 86, 56, 0.14)' : 'rgba(98, 84, 70, 0.14)';
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const px = x + ox * size;
        const py = y + oy * size;
        if (px + r < 0 || px - r > size || py + r < 0 || py - r > size) continue;
        const g = ctx.createRadialGradient(px, py, 1, px, py, r);
        g.addColorStop(0, col);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // 4. Fine organic surface grain
  for (let i = 0; i < 3200; i++) {
    const x = hash(i * 12.9898 + 1.1) * size;
    const y = hash(i * 78.233 + 3.9) * size;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(26, 18, 12, 0.16)' : 'rgba(132, 114, 96, 0.1)';
    ctx.fillRect(x, y, 2, 3);
  }

  const map = new THREE.CanvasTexture(cCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(1.5, 2.5);
  map.generateMipmaps = true;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.anisotropy = 4;

  const bumpMap = new THREE.CanvasTexture(bCanvas);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(1.5, 2.5);
  bumpMap.generateMipmaps = true;
  bumpMap.minFilter = THREE.LinearMipmapLinearFilter;

  cachedBarkPbr = { map, bumpMap };
  return cachedBarkPbr;
}

export function createLeafSprigTexture(): THREE.CanvasTexture {
  if (cachedLeafSprigTex) return cachedLeafSprigTex;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  ctx.scale(0.5, 0.5);

  const hash = (n: number) => {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
    return s - Math.floor(s);
  };

  const subLobes = [
    { x: 256, y: 258, r: 145 },
    { x: 162, y: 215, r: 112 },
    { x: 348, y: 222, r: 112 },
    { x: 258, y: 152, r: 108 },
    { x: 185, y: 332, r: 100 },
    { x: 332, y: 328, r: 100 },
  ];

  const drawSoftLeaf = (
    x: number,
    y: number,
    len: number,
    wid: number,
    angle: number,
    c1: string,
    c2: string
  ) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    const grad = ctx.createLinearGradient(0, len * 0.45, 0, -len * 0.55);
    grad.addColorStop(0, c1);
    grad.addColorStop(1, c2);
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.moveTo(0, len * 0.48);
    ctx.bezierCurveTo(-wid * 0.95, len * 0.16, -wid * 0.88, -len * 0.28, 0, -len * 0.52);
    ctx.bezierCurveTo(wid * 0.88, -len * 0.28, wid * 0.95, len * 0.16, 0, len * 0.48);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  };

  const innerPalette: [string, string][] = [
    ['#294B24', '#396530'],
    ['#244320', '#345C2C'],
    ['#2E5328', '#417036'],
  ];
  const midPalette: [string, string][] = [
    ['#396531', '#568641'],
    ['#417036', '#61934A'],
    ['#345C2C', '#4F7E3D'],
  ];
  const outerPalette: [string, string][] = [
    ['#4E7D3C', '#78A858'],
    ['#578742', '#86B464'],
    ['#477438', '#6FA051'],
  ];

  for (let i = 0; i < 150; i++) {
    const tier = i < 55 ? 0 : i < 110 ? 1 : 2;
    const lobe = subLobes[i % subLobes.length];

    const r1 = hash(i * 1.93 + 0.7);
    const r2 = hash(i * 3.71 + 2.3);
    const r3 = hash(i * 6.13 + 4.9);
    const r4 = hash(i * 8.47 + 1.5);

    const theta = r1 * Math.PI * 2;
    const distScale = tier === 0 ? 0.62 : tier === 1 ? 0.86 : 1.02;
    const dist = Math.sqrt(r2) * lobe.r * distScale;

    const lx = lobe.x + Math.cos(theta) * dist;
    const ly = lobe.y + Math.sin(theta) * dist * 0.92;

    const outwardAngle = Math.atan2(ly - 256, lx - 256) + Math.PI * 0.5 + (r3 - 0.5) * 1.65;
    const leafLen = (tier === 0 ? 40 : tier === 1 ? 34 : 27) + r4 * 14;
    const leafWid = leafLen * (0.52 + r2 * 0.16);

    const pal = tier === 0 ? innerPalette : tier === 1 ? midPalette : outerPalette;
    const [c1, c2] = pal[i % pal.length];
    drawSoftLeaf(lx, ly, leafLen, leafWid, outwardAngle, c1, c2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 4;
  cachedLeafSprigTex = tex;
  return tex;
}

export function createDriftingLeafTexture(): THREE.CanvasTexture {
  if (cachedDriftingLeafTex) return cachedDriftingLeafTex;

  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  const grad = ctx.createLinearGradient(12, 54, 52, 10);
  grad.addColorStop(0, '#6F8E47');
  grad.addColorStop(0.55, '#9EB45D');
  grad.addColorStop(1, '#C5B86A');
  ctx.fillStyle = grad;

  ctx.beginPath();
  ctx.moveTo(32, 56);
  ctx.bezierCurveTo(10, 40, 12, 18, 32, 6);
  ctx.bezierCurveTo(52, 18, 54, 40, 32, 56);
  ctx.closePath();
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  cachedDriftingLeafTex = tex;
  return tex;
}

export function createSunTexture(): THREE.CanvasTexture {
  if (cachedSunTex) return cachedSunTex;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = 128;
  const cy = 128;

  ctx.clearRect(0, 0, size, size);

  const glow = ctx.createRadialGradient(cx, cy, 9, cx, cy, 125);
  glow.addColorStop(0.0, 'rgba(255, 254, 246, 1.0)');
  glow.addColorStop(0.11, 'rgba(255, 250, 232, 0.96)');
  glow.addColorStop(0.16, 'rgba(255, 236, 192, 0.55)');
  glow.addColorStop(0.28, 'rgba(255, 218, 152, 0.24)');
  glow.addColorStop(0.48, 'rgba(255, 204, 132, 0.09)');
  glow.addColorStop(0.74, 'rgba(255, 196, 124, 0.025)');
  glow.addColorStop(1.0, 'rgba(255, 196, 124, 0.0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, 21);
  core.addColorStop(0.0, 'rgba(255, 255, 252, 1.0)');
  core.addColorStop(0.72, 'rgba(255, 252, 238, 0.98)');
  core.addColorStop(0.92, 'rgba(255, 244, 214, 0.55)');
  core.addColorStop(1.0, 'rgba(255, 240, 200, 0.0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(cx, cy, 21, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  cachedSunTex = tex;
  return tex;
}

export function createMoonTexture(): THREE.CanvasTexture {
  if (cachedMoonTex) return cachedMoonTex;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = 128;
  const cy = 128;

  ctx.clearRect(0, 0, size, size);

  const halo = ctx.createRadialGradient(cx, cy, 21, cx, cy, 124);
  halo.addColorStop(0.0, 'rgba(225, 238, 255, 0.42)');
  halo.addColorStop(0.2, 'rgba(195, 218, 252, 0.2)');
  halo.addColorStop(0.45, 'rgba(165, 196, 245, 0.075)');
  halo.addColorStop(0.75, 'rgba(145, 180, 238, 0.018)');
  halo.addColorStop(1.0, 'rgba(145, 180, 238, 0.0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, size, size);

  const moonR = 32;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, moonR, 0, Math.PI * 2);
  ctx.clip();

  const base = ctx.createRadialGradient(cx - 8, cy - 8, 4, cx, cy, moonR + 3);
  base.addColorStop(0, '#FFFDF7');
  base.addColorStop(0.68, '#E6EBF3');
  base.addColorStop(1, '#BAC5D6');
  ctx.fillStyle = base;
  ctx.fillRect(cx - moonR - 2, cy - moonR - 2, moonR * 2 + 4, moonR * 2 + 4);

  const maria = [
    { x: -8, y: -6, r: 10, a: 0.17 },
    { x: 7, y: -8, r: 8, a: 0.15 },
    { x: 5, y: 6, r: 10, a: 0.16 },
    { x: -11, y: 8, r: 7, a: 0.13 },
  ];
  maria.forEach((m) => {
    const mg = ctx.createRadialGradient(cx + m.x, cy + m.y, 1, cx + m.x, cy + m.y, m.r);
    mg.addColorStop(0, `rgba(98, 112, 134, ${m.a})`);
    mg.addColorStop(1, 'rgba(98, 112, 134, 0)');
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.arc(cx + m.x, cy + m.y, m.r, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  cachedMoonTex = tex;
  return tex;
}

export function createSoftShadowTexture(): THREE.CanvasTexture {
  if (cachedSoftShadowTex) return cachedSoftShadowTex;

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(14, 28, 16, 0.55)');
  grad.addColorStop(0.55, 'rgba(14, 28, 16, 0.22)');
  grad.addColorStop(1, 'rgba(14, 28, 16, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  cachedSoftShadowTex = tex;
  return tex;
}

export function createCloudTexture(variant = 0): THREE.CanvasTexture {
  const key = variant % 3;
  const cached = cachedCloudTexMap.get(key);
  if (cached) return cached;

  const w = 512;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);

  const presets: { x: number; y: number; rx: number; ry: number; bright: number; alpha: number }[][] = [
    [
      { x: 140, y: 154, rx: 95, ry: 42, bright: 215, alpha: 0.42 },
      { x: 245, y: 152, rx: 135, ry: 48, bright: 210, alpha: 0.5 },
      { x: 365, y: 156, rx: 95, ry: 40, bright: 215, alpha: 0.4 },
      { x: 195, y: 122, rx: 86, ry: 56, bright: 246, alpha: 0.55 },
      { x: 278, y: 108, rx: 98, ry: 66, bright: 255, alpha: 0.62 },
      { x: 345, y: 130, rx: 74, ry: 48, bright: 244, alpha: 0.5 },
      { x: 118, y: 144, rx: 64, ry: 34, bright: 238, alpha: 0.35 },
      { x: 404, y: 148, rx: 62, ry: 32, bright: 235, alpha: 0.32 },
    ],
    [
      { x: 130, y: 158, rx: 105, ry: 36, bright: 212, alpha: 0.38 },
      { x: 265, y: 156, rx: 150, ry: 42, bright: 208, alpha: 0.46 },
      { x: 385, y: 160, rx: 92, ry: 34, bright: 214, alpha: 0.36 },
      { x: 215, y: 132, rx: 92, ry: 44, bright: 250, alpha: 0.52 },
      { x: 315, y: 126, rx: 95, ry: 48, bright: 255, alpha: 0.56 },
      { x: 165, y: 142, rx: 72, ry: 36, bright: 242, alpha: 0.42 },
    ],
    [
      { x: 160, y: 152, rx: 112, ry: 46, bright: 205, alpha: 0.46 },
      { x: 290, y: 154, rx: 132, ry: 46, bright: 202, alpha: 0.5 },
      { x: 195, y: 114, rx: 84, ry: 62, bright: 252, alpha: 0.6 },
      { x: 268, y: 98, rx: 92, ry: 68, bright: 255, alpha: 0.64 },
      { x: 348, y: 122, rx: 82, ry: 52, bright: 246, alpha: 0.54 },
      { x: 108, y: 144, rx: 68, ry: 36, bright: 232, alpha: 0.34 },
      { x: 408, y: 146, rx: 68, ry: 34, bright: 232, alpha: 0.32 },
    ],
  ];

  const puffs = presets[key];

  puffs.forEach((p) => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(1, p.ry / p.rx);
    const g = ctx.createRadialGradient(0, -p.rx * 0.16, p.rx * 0.08, 0, 0, p.rx);
    g.addColorStop(0, `rgba(${p.bright}, ${p.bright}, ${Math.min(255, p.bright + 4)}, ${p.alpha})`);
    g.addColorStop(
      0.55,
      `rgba(${Math.max(175, p.bright - 18)}, ${Math.max(180, p.bright - 14)}, ${Math.max(
        190,
        p.bright - 8
      )}, ${p.alpha * 0.65})`
    );
    g.addColorStop(1, 'rgba(220, 226, 236, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, p.rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  ctx.globalCompositeOperation = 'destination-out';
  const bottomFade = ctx.createLinearGradient(0, 178, 0, 232);
  bottomFade.addColorStop(0, 'rgba(0,0,0,0)');
  bottomFade.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = bottomFade;
  ctx.fillRect(0, 178, w, 78);
  ctx.globalCompositeOperation = 'source-over';

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cachedCloudTexMap.set(key, tex);
  return tex;
}