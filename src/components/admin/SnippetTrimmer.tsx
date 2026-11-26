'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, Volume2, Scissors } from 'lucide-react';

interface SnippetTrimmerProps {
  audioUrl?: string;
  durationLabel?: string;
  startSec: number;
  endSec: number;
  onChange: (nextStartSec: number, nextEndSec: number) => void;
  compact?: boolean;
}

const MIN_SNIPPET_SEC = 5;

function parseDurationLabelToSec(label?: string): number {
  if (!label) return 180;
  const parts = label.split(':').map((p) => parseInt(p.trim(), 10));
  if (parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
    return Math.max(15, parts[0] * 60 + parts[1]);
  }
  return 180;
}

function fmtSec(sec: number): string {
  const safe = Math.max(0, Math.round(sec));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

type DragMode = 'move' | 'start' | 'end' | null;

export default function SnippetTrimmer({
  audioUrl,
  durationLabel,
  startSec,
  endSec,
  onChange,
  compact = false,
}: SnippetTrimmerProps) {
  const [totalSec, setTotalSec] = useState<number>(() =>
    Math.max(15, parseDurationLabelToSec(durationLabel), endSec + 5)
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadSec, setPlayheadSec] = useState(startSec);
  const [dragMode, setDragMode] = useState<DragMode>(null);

  const trackRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const dragOriginRef = useRef({
    clientX: 0,
    startSec: 0,
    endSec: 30,
  });

  // Keep refs synced for smooth requestAnimationFrame loop
  const rangeRef = useRef({ startSec, endSec });
  rangeRef.current = { startSec, endSec };

  // Sync fallback duration when durationLabel changes
  useEffect(() => {
    const parsed = parseDurationLabelToSec(durationLabel);
    setTotalSec((prev) => {
      if (audioRef.current && Number.isFinite(audioRef.current.duration) && audioRef.current.duration > 0) {
        return Math.max(10, Math.round(audioRef.current.duration));
      }
      return Math.max(15, parsed, endSec);
    });
  }, [durationLabel, endSec]);

  // Deterministic Instagram-style vertical waveform bars
  const bars = useMemo(() => {
    const count = compact ? 42 : 56;
    const seedStr = audioUrl || durationLabel || 'orihour-waveform';
    let seed = 17;
    for (let i = 0; i < seedStr.length; i++) {
      seed = (seed * 31 + seedStr.charCodeAt(i)) % 10007;
    }
    return Array.from({ length: count }, (_, i) => {
      const wave1 = Math.sin(i * 0.42 + seed * 0.1) * 0.34;
      const wave2 = Math.cos(i * 0.87 + seed * 0.23) * 0.22;
      const pulse = Math.sin((i / count) * Math.PI) * 0.28;
      const raw = 0.42 + wave1 + wave2 + pulse;
      return Math.max(18, Math.min(96, Math.round(raw * 100)));
    });
  }, [audioUrl, durationLabel, compact]);

  const safeTotal = Math.max(MIN_SNIPPET_SEC + 1, totalSec);
  const clampedStart = Math.max(0, Math.min(startSec, safeTotal - MIN_SNIPPET_SEC));
  const clampedEnd = Math.max(
    clampedStart + MIN_SNIPPET_SEC,
    Math.min(endSec, safeTotal)
  );
  const spanSec = clampedEnd - clampedStart;

  const stopPreview = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
  };

  const startPreviewFrom = (fromSec: number) => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    try {
      audio.currentTime = Math.max(0, Math.min(safeTotal - 0.2, fromSec));
    } catch {
      // Ignore seek before metadata
    }

    audio
      .play()
      .then(() => {
        setIsPlaying(true);
        const tick = () => {
          const el = audioRef.current;
          if (!el || el.paused) return;
          const { startSec: s, endSec: e } = rangeRef.current;
          if (el.currentTime >= e || el.currentTime < s - 0.3) {
            el.currentTime = s;
          }
          setPlayheadSec(el.currentTime);
          rafRef.current = requestAnimationFrame(tick);
        };
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(tick);
      })
      .catch(() => {
        setIsPlaying(false);
      });
  };

  // Cleanup audio on unmount or URL change
  useEffect(() => {
    stopPreview();
    setPlayheadSec(startSec);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [audioUrl]);

  // Global pointer drag handling for smooth Instagram-like scrubbing
  useEffect(() => {
    if (!dragMode) return;

    const handleMove = (e: PointerEvent) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0) return;

      const deltaPx = e.clientX - dragOriginRef.current.clientX;
      const deltaSec = (deltaPx / rect.width) * safeTotal;
      const origStart = dragOriginRef.current.startSec;
      const origEnd = dragOriginRef.current.endSec;

      if (dragMode === 'move') {
        const width = origEnd - origStart;
        let nextStart = Math.round(origStart + deltaSec);
        nextStart = Math.max(0, Math.min(safeTotal - width, nextStart));
        const nextEnd = nextStart + width;
        setPlayheadSec(nextStart);
        onChange(nextStart, nextEnd);
      } else if (dragMode === 'start') {
        let nextStart = Math.round(origStart + deltaSec);
        nextStart = Math.max(0, Math.min(origEnd - MIN_SNIPPET_SEC, nextStart));
        setPlayheadSec(nextStart);
        onChange(nextStart, origEnd);
      } else if (dragMode === 'end') {
        let nextEnd = Math.round(origEnd + deltaSec);
        nextEnd = Math.max(origStart + MIN_SNIPPET_SEC, Math.min(safeTotal, nextEnd));
        setPlayheadSec(origStart);
        onChange(origStart, nextEnd);
      }
    };

    const handleUp = () => {
      setDragMode(null);
      // Automatically preview the newly selected range once user finishes dragging!
      if (audioUrl) {
        startPreviewFrom(rangeRef.current.startSec);
      }
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [dragMode, safeTotal, audioUrl, onChange]);

  const beginDrag = (mode: Exclude<DragMode, null>, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Pause preview while actively dragging so audio doesn't stutter
    stopPreview();
    dragOriginRef.current = {
      clientX: e.clientX,
      startSec: clampedStart,
      endSec: clampedEnd,
    };
    setDragMode(mode);
  };

  const applyPresetLength = (presetSec: number) => {
    const len = Math.min(presetSec, safeTotal);
    const nextStart = Math.min(clampedStart, Math.max(0, safeTotal - len));
    const nextEnd = nextStart + len;
    onChange(nextStart, nextEnd);
    setPlayheadSec(nextStart);
    if (audioUrl) {
      window.setTimeout(() => startPreviewFrom(nextStart), 40);
    }
  };

  const leftPct = (clampedStart / safeTotal) * 100;
  const widthPct = ((clampedEnd - clampedStart) / safeTotal) * 100;
  const playheadPct =
    ((Math.max(clampedStart, Math.min(clampedEnd, playheadSec)) - clampedStart) /
      Math.max(0.5, clampedEnd - clampedStart)) *
    100;

  return (
    <div className="rounded-2xl border border-[#4A2E1B]/18 bg-[#FAF5EC] p-3">
      {/* Hidden native audio engine for snippet preview */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="metadata"
          onLoadedMetadata={(e) => {
            const dur = e.currentTarget.duration;
            if (Number.isFinite(dur) && dur > 5) {
              const rounded = Math.round(dur);
              setTotalSec(rounded);
              if (clampedEnd > rounded) {
                const nextEnd = rounded;
                const nextStart = Math.max(0, Math.min(clampedStart, nextEnd - MIN_SNIPPET_SEC));
                onChange(nextStart, nextEnd);
              }
            }
          }}
        />
      )}

      {/* Top Row: Play/Pause Preview + Selected Range Badge + Quick Presets */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!audioUrl}
            onClick={() => {
              if (isPlaying) stopPreview();
              else startPreviewFrom(clampedStart);
            }}
            className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#4A2E1B] text-[#FAF5EC] shadow-xs transition hover:bg-[#3A2213] disabled:cursor-not-allowed disabled:opacity-40"
            title={audioUrl ? 'Putar / Jeda preview snippet' : 'Upload MP3 dulu untuk preview suara'}
          >
            {isPlaying ? (
              <Pause className="h-3 w-3" />
            ) : (
              <Play className="ml-0.5 h-3 w-3" />
            )}
          </button>

          <div>
            <p className="font-mono text-[10.5px] font-bold text-[#241A13]">
              {fmtSec(clampedStart)} - {fmtSec(clampedEnd)}{' '}
              <span className="font-normal text-[#7A5230]">({spanSec} dtk)</span>
            </p>
            <p className="inline-flex items-center gap-1 font-mono text-[9px] text-[#7A624E]">
              {dragMode ? (
                <>
                  <Scissors className="h-2.5 w-2.5 text-[#4A2E1B]" />
                  Menggeser rentang... lepas untuk dengar preview
                </>
              ) : isPlaying ? (
                <>
                  <Volume2 className="h-2.5 w-2.5 text-emerald-700" />
                  Memutar preview bagian terpilih (loop)
                </>
              ) : audioUrl ? (
                'Geser kotak atau tarik tepi kiri/kanan bebas'
              ) : (
                'Upload MP3 agar preview bunyi otomatis saat dilepas'
              )}
            </p>
          </div>
        </div>

        {/* Quick duration chips */}
        <div className="flex items-center gap-1">
          {[15, 30, 45, 60].map((sec) => (
            <button
              key={sec}
              type="button"
              onClick={() => applyPresetLength(sec)}
              className={`cursor-pointer rounded-lg border px-2 py-0.5 font-mono text-[9.5px] font-semibold transition ${
                spanSec === sec
                  ? 'border-[#4A2E1B] bg-[#4A2E1B] text-[#FAF5EC]'
                  : 'border-[#4A2E1B]/18 bg-white text-[#5C4432] hover:bg-[#EFE4D3]'
              }`}
            >
              {sec}s
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Instagram-Style Waveform & Draggable Highlight Window */}
      <div
        ref={trackRef}
        className={`relative mt-3 overflow-hidden rounded-xl border border-[#4A2E1B]/15 bg-[#EFE5D6] select-none ${
          compact ? 'h-12' : 'h-16'
        }`}
        style={{ touchAction: 'none' }}
      >
        {/* Background Waveform Bars */}
        <div className="pointer-events-none flex h-full w-full items-center justify-between gap-[2px] px-1.5">
          {bars.map((heightPct, idx) => {
            const barCenterPct = ((idx + 0.5) / bars.length) * 100;
            const isInside = barCenterPct >= leftPct && barCenterPct <= leftPct + widthPct;
            return (
              <span
                key={idx}
                className={`flex-1 rounded-full transition-colors ${
                  isInside ? 'bg-[#4A2E1B]' : 'bg-[#4A2E1B]/25'
                }`}
                style={{ height: `${heightPct}%` }}
              />
            );
          })}
        </div>

        {/* Dimmed masks outside selected window */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 bg-[#241A13]/14"
          style={{ width: `${leftPct}%` }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 bg-[#241A13]/14"
          style={{ width: `${Math.max(0, 100 - leftPct - widthPct)}%` }}
        />

        {/* Draggable Highlight Window (Slide whole snippet along track) */}
        <div
          onPointerDown={(e) => beginDrag('move', e)}
          className="absolute inset-y-0 cursor-grab border-y-2 border-[#4A2E1B] bg-[#B58A52]/16 active:cursor-grabbing"
          style={{
            left: `${leftPct}%`,
            width: `${Math.max(4, widthPct)}%`,
          }}
        >
          {/* Live Moving Playhead inside the selected snippet */}
          {isPlaying && (
            <div
              className="pointer-events-none absolute inset-y-0 w-[2px] bg-[#FAF5EC] shadow-[0_0_6px_rgba(36,26,19,0.8)]"
              style={{ left: `${Math.max(0, Math.min(100, playheadPct))}%` }}
            />
          )}

          {/* Left Trim Handle (Drag to adjust start time / duration freely) */}
          <div
            onPointerDown={(e) => beginDrag('start', e)}
            className="absolute inset-y-0 left-0 flex w-3.5 -translate-x-1/2 cursor-ew-resize items-center justify-center rounded-l-md bg-[#4A2E1B] shadow-sm transition hover:bg-[#3A2213]"
            title="Tarik untuk ubah titik mulai"
          >
            <span className="h-4 w-[2px] rounded-full bg-[#FAF5EC]/85" />
          </div>

          {/* Right Trim Handle (Drag to adjust end time / duration freely) */}
          <div
            onPointerDown={(e) => beginDrag('end', e)}
            className="absolute inset-y-0 right-0 flex w-3.5 translate-x-1/2 cursor-ew-resize items-center justify-center rounded-r-md bg-[#4A2E1B] shadow-sm transition hover:bg-[#3A2213]"
            title="Tarik untuk ubah titik selesai"
          >
            <span className="h-4 w-[2px] rounded-full bg-[#FAF5EC]/85" />
          </div>
        </div>
      </div>

      {/* Bottom Time Ruler */}
      <div className="mt-1.5 flex items-center justify-between font-mono text-[9px] text-[#7A624E]">
        <span>00:00</span>
        <span>{fmtSec(safeTotal * 0.5)}</span>
        <span>{fmtSec(safeTotal)}</span>
      </div>
    </div>
  );
}