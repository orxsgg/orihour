export interface CropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ViewportCropTransform {
  viewportWidth: number;
  viewportHeight: number;
  panX: number;
  panY: number;
  zoom: number;
  rotationDeg: number;
}

export interface ProcessImageOptions {
  targetWidth: number;
  targetHeight: number;
  autoEnhanceLowRes?: boolean;
  forceEnhance?: boolean;
  mimeType?: 'image/jpeg' | 'image/webp' | 'image/png';
  quality?: number;
}

export interface ProcessedImageResult {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
  sourceCropWidth: number;
  sourceCropHeight: number;
  wasUpscaled: boolean;
  wasEnhanced: boolean;
}

export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Gagal membaca file gambar. Pastikan format JPG, PNG, atau WebP valid.'));
    };
    img.src = objectUrl;
  });
}

export function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Gagal memuat gambar dari URL.'));
    img.src = url;
  });
}

/**
 * Computes the exact minimum uniform scale so a rotated image (natW x natH)
 * completely covers the crop viewport (vpW x vpH) with zero empty/black corners.
 */
export function computeRotatedCoverScale(
  natW: number,
  natH: number,
  vpW: number,
  vpH: number,
  rotationDeg: number
): { baseScale: number; reqW: number; reqH: number } {
  const rad = (rotationDeg * Math.PI) / 180;
  const absCos = Math.abs(Math.cos(rad));
  const absSin = Math.abs(Math.sin(rad));
  const reqW = vpW * absCos + vpH * absSin;
  const reqH = vpW * absSin + vpH * absCos;
  const baseScale = Math.max(reqW / Math.max(1, natW), reqH / Math.max(1, natH));
  return { baseScale, reqW, reqH };
}

/**
 * Clamps (panX, panY) in viewport coordinates against the rotated image's safe bounds
 * so dragging at any rotation angle never exposes blank edges inside the crop frame.
 */
export function clampRotatedPan(
  panX: number,
  panY: number,
  natW: number,
  natH: number,
  vpW: number,
  vpH: number,
  zoom: number,
  rotationDeg: number
): { panX: number; panY: number; scale: number } {
  const { baseScale, reqW, reqH } = computeRotatedCoverScale(natW, natH, vpW, vpH, rotationDeg);
  const scale = baseScale * Math.max(1, zoom);

  const availLocalX = Math.max(0, (natW * scale - reqW) * 0.5);
  const availLocalY = Math.max(0, (natH * scale - reqH) * 0.5);

  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  // Transform pan into image's local unrotated axes
  const localX = panX * cos + panY * sin;
  const localY = -panX * sin + panY * cos;

  const clampedLocalX = Math.max(-availLocalX, Math.min(availLocalX, localX));
  const clampedLocalY = Math.max(-availLocalY, Math.min(availLocalY, localY));

  // Transform back to viewport axes
  return {
    panX: clampedLocalX * cos - clampedLocalY * sin,
    panY: clampedLocalX * sin + clampedLocalY * cos,
    scale,
  };
}

/**
 * Progressive multi-step canvas scaler (<= 1.35x per pass) for cleaner edges
 * when upscaling low-resolution covers or downscaling large exports.
 */
function multiStepScale(
  source: HTMLCanvasElement,
  targetW: number,
  targetH: number
): HTMLCanvasElement {
  let current = source;
  let curW = source.width;
  let curH = source.height;

  const isUpscaling = targetW > curW || targetH > curH;

  if (isUpscaling) {
    while (curW * 1.35 < targetW || curH * 1.35 < targetH) {
      const nextW = Math.min(targetW, Math.round(curW * 1.35));
      const nextH = Math.min(targetH, Math.round(curH * 1.35));
      const stepCanvas = document.createElement('canvas');
      stepCanvas.width = nextW;
      stepCanvas.height = nextH;
      const sCtx = stepCanvas.getContext('2d')!;
      sCtx.imageSmoothingEnabled = true;
      sCtx.imageSmoothingQuality = 'high';
      sCtx.drawImage(current, 0, 0, nextW, nextH);
      current = stepCanvas;
      curW = nextW;
      curH = nextH;
    }
  } else {
    while (curW * 0.5 > targetW && curH * 0.5 > targetH) {
      const nextW = Math.max(targetW, Math.round(curW * 0.5));
      const nextH = Math.max(targetH, Math.round(curH * 0.5));
      const stepCanvas = document.createElement('canvas');
      stepCanvas.width = nextW;
      stepCanvas.height = nextH;
      const sCtx = stepCanvas.getContext('2d')!;
      sCtx.imageSmoothingEnabled = true;
      sCtx.imageSmoothingQuality = 'high';
      sCtx.drawImage(current, 0, 0, nextW, nextH);
      current = stepCanvas;
      curW = nextW;
      curH = nextH;
    }
  }

  if (curW === targetW && curH === targetH) {
    return current;
  }

  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = targetW;
  finalCanvas.height = targetH;
  const fCtx = finalCanvas.getContext('2d')!;
  fCtx.imageSmoothingEnabled = true;
  fCtx.imageSmoothingQuality = 'high';
  fCtx.drawImage(current, 0, 0, targetW, targetH);
  return finalCanvas;
}

/**
 * Adaptive Unsharp Mask + subtle tonal clarity boost for low-resolution upscaled images.
 */
function applyAdaptiveEnhancement(
  canvas: HTMLCanvasElement,
  strength: number,
  threshold: number,
  contrastFactor: number
) {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const imgData = ctx.getImageData(0, 0, w, h);
  const src = imgData.data;
  const len = src.length;

  const temp = new Float32Array(len);
  const blurred = new Float32Array(len);

  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const xm2 = Math.max(0, x - 2);
      const xm1 = Math.max(0, x - 1);
      const xp1 = Math.min(w - 1, x + 1);
      const xp2 = Math.min(w - 1, x + 2);

      const i0 = (row + xm2) * 4;
      const i1 = (row + xm1) * 4;
      const i2 = (row + x) * 4;
      const i3 = (row + xp1) * 4;
      const i4 = (row + xp2) * 4;

      for (let c = 0; c < 3; c++) {
        temp[i2 + c] =
          (src[i0 + c] +
            src[i1 + c] * 4 +
            src[i2 + c] * 6 +
            src[i3 + c] * 4 +
            src[i4 + c]) *
          0.0625;
      }
      temp[i2 + 3] = src[i2 + 3];
    }
  }

  for (let y = 0; y < h; y++) {
    const ym2 = Math.max(0, y - 2) * w;
    const ym1 = Math.max(0, y - 1) * w;
    const y0 = y * w;
    const yp1 = Math.min(h - 1, y + 1) * w;
    const yp2 = Math.min(h - 1, y + 2) * w;

    for (let x = 0; x < w; x++) {
      const i0 = (ym2 + x) * 4;
      const i1 = (ym1 + x) * 4;
      const i2 = (y0 + x) * 4;
      const i3 = (yp1 + x) * 4;
      const i4 = (yp2 + x) * 4;

      for (let c = 0; c < 3; c++) {
        blurred[i2 + c] =
          (temp[i0 + c] +
            temp[i1 + c] * 4 +
            temp[i2 + c] * 6 +
            temp[i3 + c] * 4 +
            temp[i4 + c]) *
          0.0625;
      }
    }
  }

  for (let i = 0; i < len; i += 4) {
    const r = src[i];
    const g = src[i + 1];
    const b = src[i + 2];

    const dr = r - blurred[i];
    const dg = g - blurred[i + 1];
    const db = b - blurred[i + 2];

    const edgeMag = Math.abs(dr * 0.299 + dg * 0.587 + db * 0.114);
    const mask = edgeMag > threshold ? Math.min(1, (edgeMag - threshold) / 14) : 0;
    const gain = strength * mask;

    let nr = r + dr * gain;
    let ng = g + dg * gain;
    let nb = b + db * gain;

    if (contrastFactor !== 1) {
      nr = (nr - 128) * contrastFactor + 128;
      ng = (ng - 128) * contrastFactor + 128;
      nb = (nb - 128) * contrastFactor + 128;
    }

    src[i] = Math.max(0, Math.min(255, Math.round(nr)));
    src[i + 1] = Math.max(0, Math.min(255, Math.round(ng)));
    src[i + 2] = Math.max(0, Math.min(255, Math.round(nb)));
  }

  ctx.putImageData(imgData, 0, 0);
}

async function finalizeCanvasResult(
  cropCanvas: HTMLCanvasElement,
  sourceCropWidth: number,
  sourceCropHeight: number,
  options: ProcessImageOptions
): Promise<ProcessedImageResult> {
  const {
    targetWidth,
    targetHeight,
    autoEnhanceLowRes = true,
    forceEnhance = false,
    mimeType = 'image/jpeg',
    quality = 0.94,
  } = options;

  const upscaleRatio = Math.max(
    targetWidth / Math.max(16, sourceCropWidth),
    targetHeight / Math.max(16, sourceCropHeight)
  );
  const wasUpscaled = upscaleRatio > 1.05;

  const outputCanvas = multiStepScale(cropCanvas, targetWidth, targetHeight);

  const shouldEnhance = forceEnhance || (autoEnhanceLowRes && wasUpscaled);
  if (shouldEnhance) {
    const strength = wasUpscaled ? Math.min(1.15, 0.48 + (upscaleRatio - 1) * 0.45) : 0.42;
    const threshold = wasUpscaled ? 3.5 : 4.5;
    const contrast = wasUpscaled ? 1.045 : 1.02;
    applyAdaptiveEnhancement(outputCanvas, strength, threshold, contrast);
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    outputCanvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Gagal mengekspor gambar hasil crop.'));
      },
      mimeType,
      quality
    );
  });

  const dataUrl = outputCanvas.toDataURL(mimeType, quality);

  return {
    blob,
    dataUrl,
    width: targetWidth,
    height: targetHeight,
    sourceCropWidth: Math.round(sourceCropWidth),
    sourceCropHeight: Math.round(sourceCropHeight),
    wasUpscaled,
    wasEnhanced: shouldEnhance,
  };
}

/**
 * Exact WYSIWYG crop + rotation + zoom + auto-enhance matching the interactive modal preview.
 */
export async function processTransformedImage(
  image: HTMLImageElement,
  transform: ViewportCropTransform,
  options: ProcessImageOptions
): Promise<ProcessedImageResult> {
  const natW = image.naturalWidth;
  const natH = image.naturalHeight;
  const { viewportWidth: vpW, viewportHeight: vpH, zoom, rotationDeg } = transform;

  const { panX, panY, scale } = clampRotatedPan(
    transform.panX,
    transform.panY,
    natW,
    natH,
    vpW,
    vpH,
    zoom,
    rotationDeg
  );

  // Effective native pixel resolution inside the crop window
  const nativeCropW = Math.max(16, Math.round(vpW / scale));
  const nativeCropH = Math.max(16, Math.round(vpH / scale));

  // Extract rotated crop at native pixel density before progressive scaling
  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = nativeCropW;
  cropCanvas.height = nativeCropH;
  const ctx = cropCanvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const vpToNative = nativeCropW / vpW;
  ctx.save();
  ctx.translate(
    nativeCropW * 0.5 + panX * vpToNative,
    nativeCropH * 0.5 + panY * vpToNative
  );
  ctx.rotate((rotationDeg * Math.PI) / 180);
  ctx.drawImage(image, -natW * 0.5, -natH * 0.5, natW, natH);
  ctx.restore();

  return finalizeCanvasResult(cropCanvas, nativeCropW, nativeCropH, options);
}

/**
 * Legacy axis-aligned crop helper retained for compatibility.
 */
export async function processCroppedImage(
  image: HTMLImageElement,
  crop: CropBox,
  options: ProcessImageOptions
): Promise<ProcessedImageResult> {
  const sx = Math.max(0, Math.round(crop.x));
  const sy = Math.max(0, Math.round(crop.y));
  const sw = Math.max(16, Math.min(image.naturalWidth - sx, Math.round(crop.width)));
  const sh = Math.max(16, Math.min(image.naturalHeight - sy, Math.round(crop.height)));

  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = sw;
  cropCanvas.height = sh;
  const cCtx = cropCanvas.getContext('2d')!;
  cCtx.imageSmoothingEnabled = true;
  cCtx.imageSmoothingQuality = 'high';
  cCtx.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);

  return finalizeCanvasResult(cropCanvas, sw, sh, options);
}