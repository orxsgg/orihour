'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Film,
  X,
  Play,
  Pause,
  Camera,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

interface VideoThumbnailPickerModalProps {
  file: File | null;
  onCancel: () => void;
  onCapture: (capturedImageFile: File) => void;
}

function fmtTime(sec: number): string {
  const safe = Math.max(0, Number.isFinite(sec) ? sec : 0);
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  const tenths = Math.floor((safe % 1) * 10);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${tenths}`;
}

export default function VideoThumbnailPickerModal({
  file,
  onCancel,
  onCapture,
}: VideoThumbnailPickerModalProps) {
  const [mounted, setMounted] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      setDuration(0);
      setCurrentTime(0);
      setIsPlaying(false);
      setVideoError(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    setDuration(0);
    setCurrentTime(0);
    setIsPlaying(false);
    setVideoError(null);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  if (!file || !objectUrl || !mounted) return null;

  const seekTo = (nextSec: number) => {
    const vid = videoRef.current;
    if (!vid) return;
    const maxDur = Number.isFinite(vid.duration) && vid.duration > 0 ? vid.duration : duration;
    const clamped = Math.max(0, Math.min(maxDur || 0, nextSec));
    try {
      vid.currentTime = clamped;
      setCurrentTime(clamped);
    } catch {
      // Ignore seek error before metadata ready
    }
  };

  const togglePlay = () => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) {
      vid.play().catch(() => {});
    } else {
      vid.pause();
    }
  };

  const handleCaptureFrame = () => {
    const vid = videoRef.current;
    if (!vid || vid.videoWidth <= 0 || vid.videoHeight <= 0) {
      setVideoError('Frame video belum siap. Tunggu sebentar atau geser timeline.');
      return;
    }

    setCapturing(true);
    setVideoError(null);

    try {
      vid.pause();
      const canvas = document.createElement('canvas');
      canvas.width = vid.videoWidth;
      canvas.height = vid.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Browser gagal menyiapkan kanvas tangkapan gambar.');
      }

      ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          setCapturing(false);
          if (!blob) {
            setVideoError('Gagal mengambil gambar dari frame video ini.');
            return;
          }
          const baseName = file.name.replace(/\.[^.]+$/, '') || 'video-cover';
          const imageFile = new File([blob], `${baseName}-frame.jpg`, {
            type: 'image/jpeg',
          });
          onCapture(imageFile);
        },
        'image/jpeg',
        0.95
      );
    } catch (err) {
      setCapturing(false);
      setVideoError(
        err instanceof Error ? err.message : 'Gagal menangkap thumbnail dari video.'
      );
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-[#18110C]/72 p-3 backdrop-blur-md sm:p-4"
      onClick={() => {
        if (!capturing) onCancel();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-[24px] border border-[#E7DAC7] bg-[#FAF5EC] text-[#241A13] shadow-2xl"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#4A2E1B]/12 bg-[#F4ECE0] px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-2">
            <Film className="h-4 w-4 shrink-0 text-[#4A2E1B]" />
            <div className="min-w-0">
              <h3 className="truncate font-serif text-xl text-[#241A13]">
                Ambil Thumbnail Cover dari Video
              </h3>
              <p className="truncate font-mono text-[9.5px] text-[#7A624E]">{file.name}</p>
            </div>
          </div>

          <button
            type="button"
            disabled={capturing}
            onClick={onCancel}
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[#4A2E1B]/15 bg-[#FAF5EC] text-[#4A2E1B] hover:bg-white disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Video Preview + Scrubber */}
        <div className="orihour-scroll flex-1 space-y-4 overflow-y-auto p-5">
          <div className="relative overflow-hidden rounded-2xl border border-[#4A2E1B]/18 bg-[#120E0B] shadow-inner">
            <video
              ref={videoRef}
              src={objectUrl}
              playsInline
              muted
              preload="auto"
              onLoadedMetadata={(e) => {
                const dur = e.currentTarget.duration;
                if (Number.isFinite(dur) && dur > 0) {
                  setDuration(dur);
                  // Lompat sedikit ke 0.5 detik agar tidak blank hitam di frame 0
                  const initial = Math.min(0.5, dur * 0.1);
                  e.currentTarget.currentTime = initial;
                  setCurrentTime(initial);
                }
              }}
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime || 0)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
              onError={() =>
                setVideoError(
                  'Format video ini tidak didukung pratinjau browser. Coba format MP4 (H.264) atau WebM.'
                )
              }
              className="mx-auto max-h-[46vh] w-full object-contain"
            />
          </div>

          {/* Controls & Timeline */}
          <div className="space-y-3 rounded-2xl border border-[#4A2E1B]/14 bg-white/90 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[#4A2E1B] text-[#FAF5EC] shadow-xs transition hover:bg-[#3A2213]"
                  title={isPlaying ? 'Jeda video' : 'Putar video'}
                >
                  {isPlaying ? (
                    <Pause className="h-3.5 w-3.5" />
                  ) : (
                    <Play className="ml-0.5 h-3.5 w-3.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => seekTo(currentTime - 1)}
                  className="inline-flex cursor-pointer items-center gap-0.5 rounded-lg border border-[#4A2E1B]/18 bg-[#FAF5EC] px-2 py-1 font-mono text-[10px] font-semibold text-[#4A2E1B] hover:bg-[#EFE4D3]"
                  title="Mundur 1 detik"
                >
                  <ChevronLeft className="h-3 w-3" />
                  <span>1s</span>
                </button>

                <button
                  type="button"
                  onClick={() => seekTo(currentTime + 1)}
                  className="inline-flex cursor-pointer items-center gap-0.5 rounded-lg border border-[#4A2E1B]/18 bg-[#FAF5EC] px-2 py-1 font-mono text-[10px] font-semibold text-[#4A2E1B] hover:bg-[#EFE4D3]"
                  title="Maju 1 detik"
                >
                  <span>1s</span>
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>

              <span className="font-mono text-[11px] font-bold text-[#4A2E1B]">
                {fmtTime(currentTime)}{' '}
                <span className="font-normal text-[#8A7360]">/ {fmtTime(duration)}</span>
              </span>
            </div>

            <input
              type="range"
              min={0}
              max={Math.max(0.1, duration)}
              step={0.05}
              value={Math.min(currentTime, Math.max(0.1, duration))}
              onChange={(e) => seekTo(parseFloat(e.target.value))}
              aria-label="Pilih frame video untuk cover"
              className="w-full cursor-pointer accent-[#4A2E1B]"
            />

            <p className="text-[11px] text-[#6B5442]">
              Geser slider ke momen terbaik di video, lalu klik <strong>Gunakan Frame Ini</strong> untuk langsung masuk ke editor Crop &amp; Rotasi 1:1.
            </p>
          </div>

          {videoError && (
            <div className="flex items-center gap-2 rounded-xl border border-[#6E1D2C]/25 bg-[#6E1D2C]/10 px-3.5 py-2.5 text-xs font-semibold text-[#571622]">
              <AlertTriangle className="h-4 w-4 shrink-0 text-[#6E1D2C]" />
              <span>{videoError}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#4A2E1B]/12 bg-[#F4ECE0] px-5 py-3.5">
          <button
            type="button"
            disabled={capturing}
            onClick={onCancel}
            className="cursor-pointer rounded-xl border border-[#4A2E1B]/20 bg-white px-4 py-2 text-xs font-semibold text-[#4A2E1B] hover:bg-[#EFE5D5] disabled:opacity-45"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={capturing || Boolean(videoError)}
            onClick={handleCaptureFrame}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#4A2E1B] px-4 py-2 text-xs font-semibold text-[#FAF5EC] shadow-sm transition hover:bg-[#3A2213] disabled:opacity-50"
          >
            {capturing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Camera className="h-3.5 w-3.5" />
            )}
            <span>{capturing ? 'Mengambil Frame...' : 'Gunakan Frame Ini'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}