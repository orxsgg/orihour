'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ZoomIn,
  ZoomOut,
  Sparkles,
  Check,
  Move,
  RotateCcw,
  RotateCw,
  Disc3,
} from 'lucide-react';
import {
  clampRotatedPan,
  loadImageFromFile,
  processTransformedImage,
  ProcessedImageResult,
} from '@/lib/imageProcessor';

export interface VinylPreviewMeta {
  title: string;
  artist: string;
  releaseYear: number;
  labelColor: string;
  showCoverOverlay: boolean;
}

interface ImageCropEnhanceModalProps {
  file: File | null;
  title?: string;
  targetWidth: number;
  targetHeight: number;
  vinylPreview?: VinylPreviewMeta;
  onCancel: () => void;
  onConfirm: (result: ProcessedImageResult) => void;
}

export default function ImageCropEnhanceModal({
  file,
  title = 'Crop, Rotate & Enhance Image',
  targetWidth,
  targetHeight,
  vinylPreview,
  onCancel,
  onConfirm,
}: ImageCropEnhanceModalProps) {
  const [mounted, setMounted] = useState(false);
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const [objectUrl, setObjectUrl] = useState<string>('');
  const [loadError, setLoadError] = useState<string | null>(null);

  const [zoom, setZoom] = useState(1);
  const [rotationDeg, setRotationDeg] = useState(0);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [autoEnhanceLowRes, setAutoEnhanceLowRes] = useState(true);
  const [forceEnhance, setForceEnhance] = useState(false);
  const [processing, setProcessing] = useState(false);

  const draggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  useEffect(() => {
    setMounted(true);
  }, []);

  const aspect = targetWidth / targetHeight;
  const vpW = aspect >= 1 ? 300 : Math.round(320 * aspect);
  const vpH = aspect >= 1 ? Math.round(300 / aspect) : 320;

  useEffect(() => {
    if (!file) {
      setImageEl(null);
      setObjectUrl('');
      setLoadError(null);
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setObjectUrl(previewUrl);
    setLoadError(null);
    setZoom(1);
    setRotationDeg(0);
    setPanX(0);
    setPanY(0);
    setForceEnhance(false);

    let active = true;
    loadImageFromFile(file)
      .then((img) => {
        if (active) setImageEl(img);
      })
      .catch((err) => {
        if (active) {
          setLoadError(err instanceof Error ? err.message : 'Gagal membaca gambar.');
        }
      });

    return () => {
      active = false;
      URL.revokeObjectURL(previewUrl);
    };
  }, [file]);

  const layout = useMemo(() => {
    if (!imageEl) return null;
    const natW = imageEl.naturalWidth;
    const natH = imageEl.naturalHeight;

    const clamped = clampRotatedPan(
      panX,
      panY,
      natW,
      natH,
      vpW,
      vpH,
      zoom,
      rotationDeg
    );

    const dispW = natW * clamped.scale;
    const dispH = natH * clamped.scale;
    const nativeCropW = vpW / clamped.scale;
    const nativeCropH = vpH / clamped.scale;
    const isLowRes =
      nativeCropW < targetWidth * 0.95 || nativeCropH < targetHeight * 0.95;

    return {
      natW,
      natH,
      dispW,
      dispH,
      scale: clamped.scale,
      clampedPanX: clamped.panX,
      clampedPanY: clamped.panY,
      nativeCropW,
      nativeCropH,
      isLowRes,
    };
  }, [imageEl, vpW, vpH, zoom, rotationDeg, panX, panY, targetWidth, targetHeight]);

  if (!file || !mounted) return null;

  const normalizeAngle = (deg: number) => {
    let a = ((deg + 180) % 360 + 360) % 360 - 180;
    if (a === -180 && deg > 0) a = 180;
    return Math.round(a);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!layout) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: layout.clampedPanX,
      panY: layout.clampedPanY,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || !layout) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const next = clampRotatedPan(
      dragStartRef.current.panX + dx,
      dragStartRef.current.panY + dy,
      layout.natW,
      layout.natH,
      vpW,
      vpH,
      zoom,
      rotationDeg
    );
    setPanX(next.panX);
    setPanY(next.panY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handleApply = async () => {
    if (!imageEl || !layout) return;
    setProcessing(true);
    try {
      const result = await processTransformedImage(
        imageEl,
        {
          viewportWidth: vpW,
          viewportHeight: vpH,
          panX: layout.clampedPanX,
          panY: layout.clampedPanY,
          zoom,
          rotationDeg,
        },
        {
          targetWidth,
          targetHeight,
          autoEnhanceLowRes,
          forceEnhance,
          mimeType: 'image/jpeg',
          quality: 0.94,
        }
      );
      onConfirm(result);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Gagal memproses gambar.');
    } finally {
      setProcessing(false);
    }
  };

  const miniPreviewSize = 144;
  const miniRatio = miniPreviewSize / vpW;

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-[#18110C]/65 p-4 backdrop-blur-md"
      onClick={onCancel}
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[26px] border border-[#E7DAC7] bg-[#FAF5EC] text-[#241A13] shadow-[0_32px_90px_-20px_rgba(18,12,8,0.65)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#4A2E1B]/12 bg-[#F4ECE0] px-6 py-4">
          <div>
            <p className="font-mono text-[10px] font-semibold tracking-[0.16em] text-[#7A5230] uppercase">
              IMAGE EDITOR · TARGET {targetWidth} × {targetHeight} PX
            </p>
            <h3 className="mt-0.5 font-serif text-2xl leading-tight text-[#241A13]">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[#4A2E1B]/15 bg-[#FAF5EC] text-[#4A2E1B] transition hover:bg-white"
            aria-label="Tutup editor gambar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="orihour-scroll grid flex-1 grid-cols-1 gap-6 overflow-y-auto p-6 md:grid-cols-12">
          {/* Left: Interactive Drag, Zoom & Rotate Viewport */}
          <div className="flex flex-col items-center justify-center md:col-span-7">
            {loadError ? (
              <div className="rounded-2xl border border-[#4A2E1B]/25 bg-[#4A2E1B]/8 p-4 text-xs text-[#4A2E1B]">
                {loadError}
              </div>
            ) : (
              <>
                <div
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  className="relative cursor-grab overflow-hidden rounded-2xl border-2 border-[#4A2E1B]/80 bg-[#1B140F] shadow-inner select-none active:cursor-grabbing"
                  style={{ width: vpW, height: vpH, touchAction: 'none' }}
                >
                  {layout && objectUrl && (
                    <img
                      src={objectUrl}
                      alt="Crop source"
                      draggable={false}
                      className="pointer-events-none absolute top-1/2 left-1/2 max-w-none select-none"
                      style={{
                        width: layout.dispW,
                        height: layout.dispH,
                        transformOrigin: 'center center',
                        transform: `translate(calc(-50% + ${layout.clampedPanX}px), calc(-50% + ${layout.clampedPanY}px)) rotate(${rotationDeg}deg)`,
                      }}
                    />
                  )}

                  {/* Rule-of-thirds crop guide */}
                  <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                    {Array.from({ length: 9 }).map((_, idx) => (
                      <div key={idx} className="border border-white/18" />
                    ))}
                  </div>
                </div>

                {/* Zoom Control */}
                <div className="mt-4 flex w-full max-w-[320px] items-center gap-3">
                  <ZoomOut className="h-4 w-4 shrink-0 text-[#6B5442]" />
                  <input
                    type="range"
                    min={1}
                    max={3.5}
                    step={0.02}
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="h-1.5 flex-1 cursor-pointer accent-[#4A2E1B]"
                  />
                  <ZoomIn className="h-4 w-4 shrink-0 text-[#6B5442]" />
                </div>

                {/* Rotation Controls (Quick -90° / +90° + Fine Angle Slider) */}
                <div className="mt-3 w-full max-w-[320px] rounded-2xl border border-[#4A2E1B]/12 bg-white/80 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] font-semibold tracking-wider text-[#5C4432] uppercase">
                      Rotasi ({rotationDeg}°)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setRotationDeg((prev) => normalizeAngle(prev - 90))}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#4A2E1B]/15 bg-[#FAF5EC] px-2 py-1 font-mono text-[10px] font-semibold text-[#3A2213] hover:bg-[#EFE5D5]"
                        title="Putar 90 derajat ke kiri"
                      >
                        <RotateCcw className="h-3 w-3" />
                        -90°
                      </button>
                      <button
                        type="button"
                        onClick={() => setRotationDeg((prev) => normalizeAngle(prev + 90))}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#4A2E1B]/15 bg-[#FAF5EC] px-2 py-1 font-mono text-[10px] font-semibold text-[#3A2213] hover:bg-[#EFE5D5]"
                        title="Putar 90 derajat ke kanan"
                      >
                        <RotateCw className="h-3 w-3" />
                        +90°
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setZoom(1);
                          setRotationDeg(0);
                          setPanX(0);
                          setPanY(0);
                        }}
                        className="cursor-pointer rounded-lg border border-[#4A2E1B]/15 bg-white px-2 py-1 font-mono text-[10px] font-semibold text-[#6B5442] hover:bg-[#F5ECE0]"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    step={1}
                    value={rotationDeg}
                    onChange={(e) => setRotationDeg(parseInt(e.target.value, 10))}
                    className="mt-2 h-1.5 w-full cursor-pointer accent-[#4A2E1B]"
                  />
                </div>

                <p className="mt-2.5 inline-flex items-center gap-1.5 font-mono text-[10.5px] text-[#7A624E]">
                  <Move className="h-3 w-3" />
                  Geser gambar untuk memposisikan area crop
                </p>
              </>
            )}
          </div>

          {/* Right: Quality Info, Auto-Enhance & Live Cover/Vinyl Preview */}
          <div className="flex flex-col justify-between gap-4 md:col-span-5">
            <div className="space-y-3.5">
              {layout && (
                <div
                  className={`rounded-2xl border p-3.5 ${
                    layout.isLowRes
                      ? 'border-[#B58A52]/45 bg-[#F4E6CE]/70'
                      : 'border-emerald-700/25 bg-emerald-500/8'
                  }`}
                >
                  <div className="flex items-center justify-between font-mono text-[10px] font-semibold tracking-wider uppercase">
                    <span className={layout.isLowRes ? 'text-[#6E4D1B]' : 'text-emerald-800'}>
                      {layout.isLowRes ? 'RESOLUSI RENDAH TERDETEKSI' : 'KUALITAS TINGGI (HD)'}
                    </span>
                    <Sparkles
                      className={`h-3.5 w-3.5 ${
                        layout.isLowRes ? 'text-[#8C6226]' : 'text-emerald-700'
                      }`}
                    />
                  </div>
                  <p className="mt-1 text-xs text-[#3C2F24]">
                    Area crop:{' '}
                    <strong>
                      {Math.round(layout.nativeCropW)} × {Math.round(layout.nativeCropH)} px
                    </strong>
                    <br />
                    Output ekspor:{' '}
                    <strong>
                      {targetWidth} × {targetHeight} px
                    </strong>
                  </p>
                  {layout.isLowRes && autoEnhanceLowRes && (
                    <p className="mt-1.5 text-[11px] leading-snug text-[#6E4D1B]">
                      Auto-Upscale bertahap + penajaman tepi adaptif aktif otomatis agar cover tidak buram di 3D.
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2 rounded-2xl border border-[#4A2E1B]/12 bg-white/80 p-3.5">
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={autoEnhanceLowRes}
                    onChange={(e) => setAutoEnhanceLowRes(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[#4A2E1B]"
                  />
                  <span className="text-xs leading-snug text-[#2E221A]">
                    <strong>Auto-Enhance gambar resolusi rendah</strong>
                    <span className="block text-[11px] text-[#6B5442]">
                      Tingkatkan ketajaman &amp; skala otomatis jika di bawah {targetWidth}px.
                    </span>
                  </span>
                </label>

                <label className="flex cursor-pointer items-start gap-2.5 border-t border-[#4A2E1B]/10 pt-2">
                  <input
                    type="checkbox"
                    checked={forceEnhance}
                    onChange={(e) => setForceEnhance(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[#4A2E1B]"
                  />
                  <span className="text-xs leading-snug text-[#2E221A]">
                    <strong>Paksa penajaman ekstra (Clarity Boost)</strong>
                    <span className="block text-[11px] text-[#6B5442]">
                      Berguna jika gambar HD terlihat agak lembut/blur.
                    </span>
                  </span>
                </label>
              </div>

              {vinylPreview && layout && objectUrl && (
                <div className="rounded-2xl border border-[#4A2E1B]/12 bg-white/85 p-3.5">
                  <p className="font-mono text-[9.5px] font-semibold tracking-[0.14em] text-[#7A624E] uppercase">
                    LIVE PREVIEW SAMPUL &amp; PIRINGAN 3D
                  </p>
                  <div className="mt-2.5 flex items-center gap-3">
                    <div
                      className="relative shrink-0 overflow-hidden rounded-xl border border-black/15 bg-[#1B140F] shadow-md"
                      style={{ width: miniPreviewSize, height: miniPreviewSize }}
                    >
                      <img
                        src={objectUrl}
                        alt="Sleeve preview"
                        className="pointer-events-none absolute top-1/2 left-1/2 max-w-none"
                        style={{
                          width: layout.dispW * miniRatio,
                          height: layout.dispH * miniRatio,
                          transformOrigin: 'center center',
                          transform: `translate(calc(-50% + ${layout.clampedPanX * miniRatio}px), calc(-50% + ${layout.clampedPanY * miniRatio}px)) rotate(${rotationDeg}deg)`,
                        }}
                      />
                      {vinylPreview.showCoverOverlay && (
                        <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/82 via-black/58 to-transparent px-2.5 pt-2 pb-4 text-white">
                          <p className="truncate font-sans text-[10.5px] font-bold leading-tight">
                            {vinylPreview.title || 'Untitled'}
                          </p>
                          <p className="truncate font-mono text-[8px] text-white/80">
                            {vinylPreview.artist || 'Artist'} · {vinylPreview.releaseYear}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-center">
                      <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-[#111318] shadow-md ring-1 ring-black/25">
                        <div className="absolute inset-1.5 rounded-full border border-white/10" />
                        <div className="absolute inset-3.5 rounded-full border border-white/8" />
                        <div
                          className="relative flex h-11 w-11 flex-col items-center justify-center rounded-full px-1 text-center text-white shadow-inner ring-1 ring-white/50"
                          style={{ backgroundColor: vinylPreview.labelColor || '#4A2E1B' }}
                        >
                          <span className="font-mono text-[4.5px] tracking-wider opacity-80">
                            ORIHOUR
                          </span>
                          <span className="mt-1.5 max-w-[36px] truncate font-sans text-[5.5px] font-bold">
                            {vinylPreview.title || 'Track'}
                          </span>
                          <span className="absolute h-1.5 w-1.5 rounded-full bg-[#090A0D]" />
                        </div>
                      </div>
                      <span className="mt-1.5 inline-flex items-center gap-1 font-mono text-[8.5px] text-[#6D5645]">
                        <Disc3 className="h-2.5 w-2.5 text-[#4A2E1B]" />
                        Auto-sync judul
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 border-t border-[#4A2E1B]/12 pt-4">
              <button
                type="button"
                onClick={onCancel}
                disabled={processing}
                className="cursor-pointer rounded-xl border border-[#4A2E1B]/20 bg-white px-4 py-2 text-xs font-semibold text-[#4A2E1B] transition hover:bg-[#F3E9DA]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={processing || !layout}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#4A2E1B] px-4 py-2 text-xs font-semibold text-[#FAF5EC] shadow-md transition hover:bg-[#3A2213] disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" />
                <span>{processing ? 'Memproses & Enhance...' : 'Terapkan & Upload'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}