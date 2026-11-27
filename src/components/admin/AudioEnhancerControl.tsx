'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Play, Pause, Volume2 } from 'lucide-react';
import {
  AUDIO_ENHANCE_PRESETS,
  AudioEnhancePreset,
  applyAudioEnhancePreset,
  connectRealtimeAudioEnhancer,
  parseAudioEnhancePreset,
  stripAudioEnhancePreset,
} from '@/lib/audioEnhancer';

interface AudioEnhancerControlProps {
  audioUrl: string;
  onChangeAudioUrl: (nextUrl: string) => void;
  compact?: boolean;
}

export default function AudioEnhancerControl({
  audioUrl,
  onChangeAudioUrl,
  compact = false,
}: AudioEnhancerControlProps) {
  const activePreset = parseAudioEnhancePreset(audioUrl);
  const cleanUrl = stripAudioEnhancePreset(audioUrl);

  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [compareOriginal, setCompareOriginal] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const enhancerRef = useRef<{ setPreset: (next: AudioEnhancePreset) => void } | null>(
    null
  );

  // Stop and tear down preview cleanly when source URL changes or component unmounts
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current.src = '';
        } catch {
          // Ignore cleanup errors
        }
        audioRef.current = null;
      }
      enhancerRef.current = null;
      if (ctxRef.current) {
        ctxRef.current.close().catch(() => {});
        ctxRef.current = null;
      }
      setPreviewPlaying(false);
    };
  }, [cleanUrl]);

  // Dynamically update DSP preset during live preview
  useEffect(() => {
    if (!enhancerRef.current) return;
    enhancerRef.current.setPreset(compareOriginal ? 'none' : activePreset);
  }, [activePreset, compareOriginal]);

  if (!cleanUrl) return null;

  const activeInfo =
    AUDIO_ENHANCE_PRESETS.find((p) => p.id === activePreset) ||
    AUDIO_ENHANCE_PRESETS[0];

  const handleSelectPreset = (preset: AudioEnhancePreset) => {
    setCompareOriginal(false);
    setPreviewError(null);
    onChangeAudioUrl(applyAudioEnhancePreset(cleanUrl, preset));
  };

  const handleTogglePreview = async () => {
    setPreviewError(null);

    if (previewPlaying && audioRef.current) {
      audioRef.current.pause();
      setPreviewPlaying(false);
      return;
    }

    try {
      if (!ctxRef.current) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!AudioCtx) {
          setPreviewError('Browser ini tidak mendukung Web Audio Enhancer.');
          return;
        }
        ctxRef.current = new AudioCtx();
      }

      if (ctxRef.current.state === 'suspended') {
        await ctxRef.current.resume();
      }

      if (!audioRef.current) {
        const audio = new Audio();
        audio.crossOrigin = 'anonymous';
        audio.preload = 'auto';
        audio.src = cleanUrl;
        audio.onended = () => setPreviewPlaying(false);
        audio.onerror = () => {
          setPreviewPlaying(false);
          setPreviewError('Gagal memuat audio preview (cek CORS/link audio).');
        };

        const chain = connectRealtimeAudioEnhancer(
          ctxRef.current,
          audio,
          compareOriginal ? 'none' : activePreset
        );
        if (!chain) {
          setPreviewError('Gagal menyambungkan filter audio.');
          return;
        }

        audioRef.current = audio;
        enhancerRef.current = chain;
      } else {
        enhancerRef.current?.setPreset(compareOriginal ? 'none' : activePreset);
      }

      await audioRef.current.play();
      setPreviewPlaying(true);
    } catch {
      setPreviewPlaying(false);
      setPreviewError('Preview diblokir browser atau audio gagal diputar.');
    }
  };

  if (compact) {
    return (
      <div className="rounded-lg border border-[#4A2E1B]/12 bg-white/85 px-2.5 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 font-mono text-[9.5px] font-semibold tracking-wider text-[#7A5230] uppercase">
            <Sparkles className="h-3 w-3" />
            Audio Enhance
          </span>

          <div className="flex items-center gap-1.5">
            {activePreset !== 'none' && (
              <button
                type="button"
                onClick={() => setCompareOriginal((prev) => !prev)}
                className={`cursor-pointer rounded-md border px-2 py-0.5 font-mono text-[9px] font-semibold transition ${
                  compareOriginal
                    ? 'border-[#7A5230] bg-[#7A5230] text-[#FAF5EC]'
                    : 'border-[#4A2E1B]/18 bg-[#FAF5EC] text-[#5C4432] hover:bg-white'
                }`}
                title="Bandingkan suara asli vs hasil enhance"
              >
                {compareOriginal ? 'Mode: Asli' : 'Bandingkan Asli'}
              </button>
            )}

            <button
              type="button"
              onClick={() => void handleTogglePreview()}
              className={`inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[9.5px] font-semibold transition ${
                previewPlaying
                  ? 'bg-[#6E1D2C] text-[#FAF5EC]'
                  : 'bg-[#4A2E1B] text-[#FAF5EC] hover:bg-[#3A2213]'
              }`}
            >
              {previewPlaying ? (
                <>
                  <Pause className="h-2.5 w-2.5" />
                  <span>Stop</span>
                </>
              ) : (
                <>
                  <Play className="h-2.5 w-2.5" />
                  <span>Test</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mt-1.5 flex flex-wrap gap-1">
          {AUDIO_ENHANCE_PRESETS.map((preset) => {
            const selected = activePreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPreset(preset.id)}
                className={`cursor-pointer rounded-full border px-2 py-0.5 font-mono text-[9.5px] font-semibold whitespace-nowrap transition ${
                  selected
                    ? 'border-[#4A2E1B] bg-[#4A2E1B] text-[#FAF5EC]'
                    : 'border-[#4A2E1B]/16 bg-[#FAF5EC] text-[#5C4432] hover:bg-white'
                }`}
                title={preset.description}
              >
                {preset.shortLabel}
              </button>
            );
          })}
        </div>

        {previewError && (
          <p className="mt-1 text-[10px] font-medium text-[#6E1D2C]">{previewError}</p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3.5 border-t border-[#4A2E1B]/10 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 font-mono text-[9.5px] font-semibold tracking-wider text-[#5C4432] uppercase">
          <Sparkles className="h-3 w-3 text-[#B58A52]" />
          Audio Enhancement (Mastering)
        </span>

        <div className="flex items-center gap-1.5">
          {activePreset !== 'none' && (
            <button
              type="button"
              onClick={() => setCompareOriginal((prev) => !prev)}
              className={`cursor-pointer rounded-lg border px-2 py-1 font-mono text-[9.5px] font-semibold transition ${
                compareOriginal
                  ? 'border-[#7A5230] bg-[#7A5230] text-[#FAF5EC]'
                  : 'border-[#4A2E1B]/18 bg-[#FAF5EC] text-[#5C4432] hover:bg-white'
              }`}
              title="Dengarkan perbandingan audio asli tanpa filter"
            >
              {compareOriginal ? 'A/B: Original' : 'A/B: Enhanced'}
            </button>
          )}

          <button
            type="button"
            onClick={() => void handleTogglePreview()}
            className={`inline-flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1 text-[10.5px] font-semibold transition ${
              previewPlaying
                ? 'bg-[#6E1D2C] text-[#FAF5EC] hover:bg-[#571622]'
                : 'bg-[#4A2E1B] text-[#FAF5EC] hover:bg-[#3A2213]'
            }`}
          >
            {previewPlaying ? (
              <>
                <Pause className="h-3 w-3" />
                <span>Stop</span>
              </>
            ) : (
              <>
                <Volume2 className="h-3 w-3" />
                <span>Preview</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {AUDIO_ENHANCE_PRESETS.map((preset) => {
          const selected = activePreset === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleSelectPreset(preset.id)}
              className={`cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold whitespace-nowrap transition ${
                selected
                  ? 'border-[#4A2E1B] bg-[#4A2E1B] text-[#FAF5EC] shadow-xs'
                  : 'border-[#4A2E1B]/18 bg-[#FAF5EC] text-[#5C4432] hover:bg-white'
              }`}
            >
              {preset.shortLabel}
            </button>
          );
        })}
      </div>

      <p className="mt-1.5 text-[10.5px] leading-snug text-[#6B5442]">
        <span className="font-semibold text-[#4A2E1B]">{activeInfo.label}:</span>{' '}
        {activeInfo.description}
      </p>

      {previewError && (
        <p className="mt-1 text-[10.5px] font-medium text-[#6E1D2C]">{previewError}</p>
      )}
    </div>
  );
}