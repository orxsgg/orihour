'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, Volume2, Scissors, RotateCcw } from 'lucide-react';

interface SnippetTrimmerProps {
  audioUrl?: string;
  durationLabel?: string;
  startSec: number;
  endSec: number;
  fadeInSec?: number;
  fadeOutSec?: number;
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

function smoothCosine(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return 0.5 - 0.5 * Math.cos(clamped * Math.PI);
}

type DragMode = 'move' | 'start' | 'end' | 'playhead' | null;

export default function SnippetTrimmer({
  audioUrl,
  durationLabel,
  startSec,
  endSec,
  fadeInSec = 0,
  fadeOutSec = 0,
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
  const playheadRef = useRef(startSec);
  const dragOriginRef = useRef({
    clientX: 0,
    startSec: 0,
    endSec: 30,
  });

  const safeTotal = Math.max(MIN_SNIPPET_SEC + 1, totalSec);
  const clampedStart = Math.max(0, Math.min(startSec, safeTotal - MIN_SNIPPET_SEC));
  const clampedEnd = Math.max(
    clampedStart + MIN_SNIPPET_SEC,
    Math.min(endSec, safeTotal)
  );
  const spanSec = clampedEnd - clampedStart;

  const rangeRef = useRef({
    startSec: clampedStart,
    endSec: clampedEnd,
    fadeInSec: Math.max(0, Number(fadeInSec) || 0),
    fadeOutSec: Math.max(0, Number(fadeOutSec) || 0),
  });
  rangeRef.current = {
    startSec: clampedStart,
    endSec: clampedEnd,
    fadeInSec: Math.max(0, Number(fadeInSec) || 0),
    fadeOutSec: Math.max(0, Number(fadeOutSec) || 0),
  };

  const updatePlayhead = (nextSec: number) => {
    const bounded = Math.max(
      rangeRef.current.startSec,
      Math.min(rangeRef.current.endSec, nextSec)
    );
    playheadRef.current = bounded;
    setPlayheadSec(bounded);
  };

  const applyPreviewFadeVolume = (el: HTMLAudioElement, curSec: number) => {
    const { startSec: s, endSec: e, fadeInSec: fiRaw, fadeOutSec: foRaw } = rangeRef.current;
    if (fiRaw <= 0 && foRaw <= 0) {
      el.volume = 1;
      return;
    }
    const span = Math.max(0.5, e - s);
    let fi = fiRaw;
    let fo = foRaw;
    if (fi + fo > span) {
      const scale = span / (fi + fo);
      fi *= scale;
      fo *= scale;
    }
    const elapsed = Math.max(0, curSec - s);
    const remaining = Math.max(0, e - curSec);
    const inMult = fi > 0.02 ? smoothCosine(elapsed / fi) : 1;
    const outMult = fo > 0.02 ? smoothCosine(remaining / fo) : 1;
    el.volume = Math.max(0, Math.min(1, Math.min(inMult, outMult)));
  };

  useEffect(() => {
    const parsed = parseDurationLabelToSec(durationLabel);
    setTotalSec(() => {
      if (
        audioRef.current &&
        Number.isFinite(audioRef.current.duration) &&
        audioRef.current.duration > 0
      ) {
        return Math.max(10, Math.round(audioRef.current.duration));
      }
      return Math.max(15, parsed, endSec);
    });
  }, [durationLabel, endSec]);

  useEffect(() => {
    if (playheadRef.current < clampedStart || playheadRef.current > clampedEnd) {
      updatePlayhead(clampedStart);
    }
  }, [clampedStart, clampedEnd]);

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

    const { startSec: s, endSec: e } = rangeRef.current;
    const clampedFrom =
      fromSec >= e - 0.15 || fromSec < s ? s : Math.max(s, Math.min(e - 0.1, fromSec));

    try {
      audio.currentTime = Math.max(0, Math.min(safeTotal - 0.1, clampedFrom));
    } catch {
      // Ignore seek before metadata loaded
    }

    applyPreviewFadeVolume(audio, clampedFrom);
    updatePlayhead(clampedFrom);

    audio
      .play()
      .then(() => {
        setIsPlaying(true);
        const tick = () => {
          const el = audioRef.current;
          if (!el || el.paused) return;
          const curRange = rangeRef.current;
          if (el.currentTime >= curRange.endSec || el.currentTime < curRange.startSec - 0.25) {
            el.currentTime = curRange.startSec;
          }
          applyPreviewFadeVolume(el, el.currentTime);
          playheadRef.current = el.currentTime;
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

  useEffect(() => {
    stopPreview();
    updatePlayhead(clampedStart);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [audioUrl]);

  useEffect(() => {
    if (!dragMode) return;

    const handleMove = (e: PointerEvent) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0) return;

      if (dragMode === 'playhead') {
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const rawSec = ratio * safeTotal;
        const { startSec: s, endSec: en } = rangeRef.current;
        const nextPlayhead = Math.max(s, Math.min(en - 0.1, rawSec));
        playheadRef.current = nextPlayhead;
        setPlayheadSec(nextPlayhead);
        if (audioRef.current && Number.isFinite(audioRef.current.duration)) {
          try {
            audioRef.current.currentTime = nextPlayhead;
          } catch {
            // Ignore seek while scrubbing
          }
        }
        return;
      }

      const deltaPx = e.clientX - dragOriginRef.current.clientX;
      const deltaSec = (deltaPx / rect.width) * safeTotal;
      const origStart = dragOriginRef.current.startSec;
      const origEnd = dragOriginRef.current.endSec;

      if (dragMode === 'move') {
        const width = origEnd - origStart;
        let nextStart = Math.round(origStart + deltaSec);
        nextStart = Math.max(0, Math.min(safeTotal - width, nextStart));
        const nextEnd = nextStart + width;
        playheadRef.current = nextStart;
        setPlayheadSec(nextStart);
        onChange(nextStart, nextEnd);
      } else if (dragMode === 'start') {
        let nextStart = Math.round(origStart + deltaSec);
        nextStart = Math.max(0, Math.min(origEnd - MIN_SNIPPET_SEC, nextStart));
        playheadRef.current = nextStart;
        setPlayheadSec(nextStart);
        onChange(nextStart, origEnd);
      } else if (dragMode === 'end') {
        let nextEnd = Math.round(origEnd + deltaSec);
        nextEnd = Math.max(origStart + MIN_SNIPPET_SEC, Math.min(safeTotal, nextEnd));
        const keptPlayhead = Math.min(playheadRef.current, nextEnd - 0.5);
        playheadRef.current = Math.max(origStart, keptPlayhead);
        setPlayheadSec(playheadRef.current);
        onChange(origStart, nextEnd);
      }
    };

    const handleUp = () => {
      const finishedMode = dragMode;
      setDragMode(null);
      if (audioUrl) {
        if (finishedMode === 'playhead') {
          startPreviewFrom(playheadRef.current);
        } else {
          startPreviewFrom(rangeRef.current.startSec);
        }
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
    playheadRef.current = nextStart;
    setPlayheadSec(nextStart);
    if (audioUrl) {
      window.setTimeout(() => startPreviewFrom(nextStart), 40);
    }
  };

  const handlePlayheadRangeScrub = (nextVal: number) => {
    const clamped = Math.max(clampedStart, Math.min(clampedEnd - 0.1, nextVal));
    playheadRef.current = clamped;
    setPlayheadSec(clamped);
    if (audioRef.current && Number.isFinite(audioRef.current.duration)) {
      try {
        audioRef.current.currentTime = clamped;
      } catch {
        // Ignore seek error
      }
    }
  };

  const leftPct = (clampedStart / safeTotal) * 100;
  const widthPct = ((clampedEnd - clampedStart) / safeTotal) * 100;
  const boundedPlayhead = Math.max(clampedStart, Math.min(clampedEnd, playheadSec));
  const playheadPct =
    ((boundedPlayhead - clampedStart) / Math.max(0.5, clampedEnd - clampedStart)) * 100;

  const fadeInPct = Math.min(50, ((Math.max(0, fadeInSec) || 0) / Math.max(1, spanSec)) * 100);
  const fadeOutPct = Math.min(50, ((Math.max(0, fadeOutSec) || 0) / Math.max(1, spanSec)) * 100);

  return (
    <div className="rounded-2xl border border-[#4A2E1B]/18 bg-[#FAF5EC] p-3">
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

      {/* Top Row: Play/Pause + Restart + Selected Range & Current Playhead Time + Presets */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!audioUrl}
            onClick={() => {
              if (isPlaying) stopPreview();
              else startPreviewFrom(playheadRef.current);
            }}
            className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#4A2E1B] text-[#FAF5EC] shadow-xs transition hover:bg-[#3A2213] disabled:cursor-not-allowed disabled:opacity-40"
            title={
              audioUrl
                ? 'Putar / Jeda dari posisi garis playhead (termasuk efek Fade In/Out)'
                : 'Upload MP3 dulu untuk preview'
            }
          >
            {isPlaying ? (
              <Pause className="h-3 w-3" />
            ) : (
              <Play className="ml-0.5 h-3 w-3" />
            )}
          </button>

          {audioUrl && (
            <button
              type="button"
              onClick={() => startPreviewFrom(clampedStart)}
              className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[#4A2E1B]/20 bg-white text-[#5C4432] transition hover:bg-[#EFE4D3] hover:text-[#241A13]"
              title="Ulang preview dari titik awal"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          )}

          <div>
            <p className="font-mono text-[10.5px] font-bold text-[#241A13]">
              {fmtSec(clampedStart)} - {fmtSec(clampedEnd)}{' '}
              <span className="font-normal text-[#7A5230]">({spanSec} dtk)</span>
              {audioUrl && (
                <span className="ml-1.5 rounded bg-[#4A2E1B]/10 px-1.5 py-0.5 text-[9.5px] text-[#4A2E1B]">
                  ▶ {fmtSec(boundedPlayhead)}
                </span>
              )}
            </p>
            <p className="inline-flex items-center gap-1 font-mono text-[9px] text-[#7A624E]">
              {dragMode === 'playhead' ? (
                <>
                  <Volume2 className="h-2.5 w-2.5 text-[#4A2E1B]" />
                  Menggeser posisi putar ke {fmtSec(boundedPlayhead)}...
                </>
              ) : dragMode ? (
                <>
                  <Scissors className="h-2.5 w-2.5 text-[#4A2E1B]" />
                  Mengatur rentang... lepas untuk dengar preview
                </>
              ) : isPlaying ? (
                <>
                  <Volume2 className="h-2.5 w-2.5 text-emerald-700" />
                  Geser garis putih atau slider bawah untuk loncat posisi
                </>
              ) : audioUrl ? (
                'Geser kotak, tarik tepi, atau geser garis playhead bebas'
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

      {/* Interactive Waveform & Draggable Highlight Window + Fade Visuals + Draggable Playhead */}
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

        {/* Draggable Highlight Window */}
        <div
          onPointerDown={(e) => beginDrag('move', e)}
          className="absolute inset-y-0 cursor-grab border-y-2 border-[#4A2E1B] bg-[#B58A52]/16 active:cursor-grabbing"
          style={{
            left: `${leftPct}%`,
            width: `${Math.max(4, widthPct)}%`,
          }}
        >
          {/* Visual Fade-In Slope Indicator */}
          {fadeInPct > 0 && (
            <div
              className="pointer-events-none absolute inset-y-0 left-0 bg-gradient-to-r from-[#4A2E1B]/35 to-transparent"
              style={{ width: `${fadeInPct}%` }}
            />
          )}

          {/* Visual Fade-Out Slope Indicator */}
          {fadeOutPct > 0 && (
            <div
              className="pointer-events-none absolute inset-y-0 right-0 bg-gradient-to-l from-[#4A2E1B]/35 to-transparent"
              style={{ width: `${fadeOutPct}%` }}
            />
          )}

          {/* Draggable Vertical Playhead Line */}
          <div
            onPointerDown={(e) => beginDrag('playhead', e)}
            title="Geser garis ini untuk memindahkan posisi preview audio"
            className="group absolute inset-y-0 z-20 flex w-4 -translate-x-1/2 cursor-ew-resize justify-center"
            style={{ left: `${Math.max(0, Math.min(100, playheadPct))}%` }}
          >
            <div className="h-full w-[2.5px] bg-[#FAF5EC] shadow-[0_0_6px_rgba(36,26,19,0.85)] transition-colors group-hover:bg-[#E6C79C]" />
            <span className="absolute top-0.5 h-2.5 w-2.5 rounded-full border border-[#4A2E1B] bg-[#FAF5EC] shadow-xs transition-transform group-hover:scale-125" />
          </div>

          {/* Left Trim Handle */}
          <div
            onPointerDown={(e) => beginDrag('start', e)}
            className="absolute inset-y-0 left-0 z-30 flex w-3.5 -translate-x-1/2 cursor-ew-resize items-center justify-center rounded-l-md bg-[#4A2E1B] shadow-sm transition hover:bg-[#3A2213]"
            title="Tarik untuk ubah titik mulai"
          >
            <span className="h-4 w-[2px] rounded-full bg-[#FAF5EC]/85" />
          </div>

          {/* Right Trim Handle */}
          <div
            onPointerDown={(e) => beginDrag('end', e)}
            className="absolute inset-y-0 right-0 z-30 flex w-3.5 translate-x-1/2 cursor-ew-resize items-center justify-center rounded-r-md bg-[#4A2E1B] shadow-sm transition hover:bg-[#3A2213]"
            title="Tarik untuk ubah titik selesai"
          >
            <span className="h-4 w-[2px] rounded-full bg-[#FAF5EC]/85" />
          </div>
        </div>
      </div>

      {/* Dedicated Fine-Grain Playhead Seek Bar */}
      {audioUrl && (
        <div className="mt-2.5 flex items-center gap-2">
          <span className="font-mono text-[9px] font-semibold text-[#7A5230]">
            {fmtSec(clampedStart)}
          </span>
          <div className="relative flex flex-1 items-center">
            <div className="pointer-events-none h-1 w-full overflow-hidden rounded-full bg-[#4A2E1B]/16">
              <div
                className="h-full rounded-full bg-[#4A2E1B]"
                style={{ width: `${Math.max(0, Math.min(100, playheadPct))}%` }}
              />
            </div>
            <input
              type="range"
              min={clampedStart}
              max={Math.max(clampedStart + 0.5, clampedEnd)}
              step={0.1}
              value={boundedPlayhead}
              onPointerDown={() => stopPreview()}
              onChange={(e) => handlePlayheadRangeScrub(parseFloat(e.target.value))}
              onPointerUp={() => startPreviewFrom(playheadRef.current)}
              onKeyUp={() => startPreviewFrom(playheadRef.current)}
              aria-label="Geser posisi preview"
              className="absolute inset-0 h-4 w-full -translate-y-1.5 cursor-pointer opacity-0"
            />
            <span
              className="pointer-events-none absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#FAF5EC] bg-[#4A2E1B] shadow-xs"
              style={{ left: `${Math.max(0, Math.min(100, playheadPct))}%` }}
            />
          </div>
          <span className="font-mono text-[9px] font-semibold text-[#7A5230]">
            {fmtSec(clampedEnd)}
          </span>
        </div>
      )}

      {/* Bottom Full-Track Time Ruler */}
      <div className="mt-1.5 flex items-center justify-between font-mono text-[9px] text-[#7A624E]">
        <span>00:00</span>
        <span>{fmtSec(safeTotal * 0.5)}</span>
        <span>{fmtSec(safeTotal)}</span>
      </div>
    </div>
  );
}