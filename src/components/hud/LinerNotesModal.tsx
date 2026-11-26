'use client';

import React, { useMemo } from 'react';
import { X, Disc3, Play, Pause, Star, ListMusic, Scissors } from 'lucide-react';
import { TrackItem, VinylRecord } from '@/types/orihour';
import { getSleeveDataUrl } from '@/components/room-3d/textures';

interface LinerNotesModalProps {
  open: boolean;
  activeVinyl: VinylRecord | null;
  activeTrack: TrackItem | null;
  isPlaying: boolean;
  progressRatio: number;
  onTogglePlay: () => void;
  onSelectTrack: (track: TrackItem) => void;
  onSeekProgress: (ratio: number) => void;
  onClose: () => void;
}

export default function LinerNotesModal({
  open,
  activeVinyl,
  activeTrack,
  isPlaying,
  progressRatio,
  onTogglePlay,
  onSelectTrack,
  onSeekProgress,
  onClose,
}: LinerNotesModalProps) {
  const activeCoverUrl = useMemo(() => {
    if (!activeVinyl || typeof window === 'undefined') return '';
    return activeVinyl.coverUrl || getSleeveDataUrl(activeVinyl);
  }, [activeVinyl]);

  if (!open || !activeVinyl) return null;

  const isSong = activeVinyl.releaseType === 'Song';
  const tracks = activeVinyl.tracks || [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#18110C]/58 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-[26px] border border-[#E5D7C3] bg-[#FAF5EC]/95 text-[#241A13] shadow-[0_32px_90px_-20px_rgba(12,8,6,0.58),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#4A2E1B]/12 bg-[#F4ECE0]/85 px-6 py-4">
          <div className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.14em] text-[#4A2E1B] uppercase">
            <Disc3 className="h-4 w-4 text-[#7A5230]" />
            <span>
              {isSong ? 'CURATOR LINER NOTES' : `${activeVinyl.releaseType} · TRACKLIST & NOTES`}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[#4A2E1B]/15 bg-white/80 text-[#4A2E1B] transition hover:bg-white"
            aria-label="Close liner notes"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="orihour-scroll flex-1 overflow-y-auto p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            {activeCoverUrl && (
              <img
                src={activeCoverUrl}
                alt={activeVinyl.title}
                className="h-36 w-36 shrink-0 rounded-2xl border border-black/10 object-cover shadow-md"
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 font-mono text-[10.5px] font-semibold tracking-wider uppercase">
                <span className="rounded-full bg-[#4A2E1B] px-2.5 py-0.5 text-[#FAF5EC]">
                  {activeVinyl.releaseType || 'Song'}
                </span>
                <span className="rounded-full bg-[#4A2E1B]/10 px-2.5 py-0.5 text-[#4A2E1B]">
                  {activeVinyl.genre || activeVinyl.mood}
                </span>
                <span className="text-[#6E5B4B]">
                  {activeVinyl.releaseYear} ·{' '}
                  {isSong ? activeVinyl.duration : `${tracks.length} tracks`}
                </span>
              </div>

              <h2 className="mt-2 font-serif text-3xl leading-tight text-[#241A13]">
                {activeVinyl.title}
              </h2>
              <p className="mt-1 text-sm font-medium text-[#655040]">
                {activeVinyl.artist}
                {isSong && activeVinyl.album && (
                  <>
                    {' '}
                    - <span className="italic">{activeVinyl.album}</span>
                  </>
                )}
              </p>

              {/* Inline Turntable Play/Pause & Seek Bar */}
              <div className="mt-3.5 space-y-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={onTogglePlay}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#4A2E1B] px-3.5 py-1.5 font-mono text-[10.5px] font-semibold tracking-wider text-[#FAF5EC] uppercase transition hover:bg-[#3A2213]"
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="h-3 w-3" />
                        <span>Pause</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-3 w-3" />
                        <span>Play</span>
                      </>
                    )}
                  </button>

                  <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-wider text-[#5C4432] uppercase">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        isPlaying ? 'animate-pulse bg-emerald-600' : 'bg-[#B58A52]'
                      }`}
                    />
                    {activeTrack
                      ? `Track: ${activeTrack.title}`
                      : isPlaying
                      ? 'Now Spinning'
                      : 'On the Platter'}
                  </span>

                  {(activeTrack?.clipMode === 'snippet' ||
                    (!activeTrack && activeVinyl.clipMode === 'snippet')) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#B58A52]/20 px-2 py-0.5 font-mono text-[9.5px] font-semibold text-[#6E4D1B]">
                      <Scissors className="h-2.5 w-2.5" />
                      SNIPPET
                    </span>
                  )}
                </div>

                {/* Seekable Bar */}
                <div className="relative flex w-full max-w-xs items-center">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#4A2E1B]/15">
                    <div
                      className="h-full rounded-full bg-[#4A2E1B] transition-[width] duration-75"
                      style={{ width: `${Math.round(progressRatio * 100)}%` }}
                    />
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1000}
                    step={1}
                    value={Math.round(progressRatio * 1000)}
                    onChange={(e) => onSeekProgress(parseInt(e.target.value, 10) / 1000)}
                    aria-label="Seek audio"
                    className="absolute inset-0 h-4 w-full -translate-y-1 cursor-pointer opacity-0"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Highlight: Favorite Lyric (Song) OR Favorite Song (Album/EP/Single/Live/Cover) */}
          {isSong ? (
            activeVinyl.favoriteLyric && (
              <div className="mt-6 border-l-2 border-[#4A2E1B] pl-4">
                <p className="font-mono text-[10px] font-semibold tracking-[0.16em] text-[#7A624E] uppercase">
                  FAVORITE LYRIC
                </p>
                <p className="mt-1.5 font-serif text-xl italic leading-relaxed text-[#241A13]">
                  &ldquo;{activeVinyl.favoriteLyric}&rdquo;
                </p>
              </div>
            )
          ) : (
            <>
              {activeVinyl.favoriteSong && (
                <div className="mt-6 flex items-center gap-3 rounded-2xl border border-[#B58A52]/35 bg-[#F4E6CE]/55 px-4 py-3">
                  <Star className="h-4 w-4 shrink-0 text-[#8C6226]" />
                  <div>
                    <p className="font-mono text-[9.5px] font-semibold tracking-[0.16em] text-[#7A5230] uppercase">
                      FAVORITE SONG
                    </p>
                    <p className="font-serif text-xl text-[#241A13]">
                      {activeVinyl.favoriteSong}
                    </p>
                  </div>
                </div>
              )}

              {/* Interactive Album / EP / Single Tracklist */}
              <div className="mt-5 rounded-2xl border border-[#4A2E1B]/12 bg-white/75 p-4">
                <p className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-[0.16em] text-[#7A5230] uppercase">
                  <ListMusic className="h-3.5 w-3.5" />
                  TRACKLIST ({tracks.length})
                </p>

                {tracks.length === 0 ? (
                  <p className="mt-2 text-xs text-[#7A624E]">
                    Daftar lagu belum ditambahkan untuk rilisan ini.
                  </p>
                ) : (
                  <div className="mt-2.5 divide-y divide-[#4A2E1B]/10">
                    {tracks.map((trk, idx) => {
                      const isSelected = activeTrack?.id === trk.id;
                      const isThisPlaying = isSelected && isPlaying;
                      const isFav =
                        activeVinyl.favoriteSong &&
                        activeVinyl.favoriteSong.trim().toLowerCase() ===
                          trk.title.trim().toLowerCase();

                      return (
                        <button
                          key={trk.id}
                          type="button"
                          onClick={() => onSelectTrack(trk)}
                          className={`flex w-full cursor-pointer items-center justify-between gap-3 px-2.5 py-2 text-left transition ${
                            isSelected
                              ? 'rounded-xl bg-[#4A2E1B]/10 text-[#241A13]'
                              : 'hover:bg-[#FAF5EC]'
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-semibold ${
                                isThisPlaying
                                  ? 'bg-[#4A2E1B] text-[#FAF5EC]'
                                  : 'bg-[#4A2E1B]/10 text-[#4A2E1B]'
                              }`}
                            >
                              {isThisPlaying ? (
                                <Pause className="h-2.5 w-2.5" />
                              ) : isSelected ? (
                                <Play className="ml-0.5 h-2.5 w-2.5" />
                              ) : (
                                idx + 1
                              )}
                            </span>
                            <span className="truncate text-sm font-medium text-[#241A13]">
                              {trk.title}
                            </span>
                            {isFav && (
                              <span className="shrink-0 rounded-full bg-[#B58A52]/20 px-2 py-0.5 font-mono text-[9px] font-semibold text-[#6E4D1B]">
                                ★ FAV
                              </span>
                            )}
                            {trk.clipMode === 'snippet' && (
                              <span className="shrink-0 rounded-full bg-[#4A2E1B]/8 px-1.5 py-0.5 font-mono text-[8.5px] text-[#655040]">
                                CLIP
                              </span>
                            )}
                          </div>
                          <span className="shrink-0 font-mono text-[11px] text-[#7A624E]">
                            {trk.duration}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          <div className="mt-5 rounded-2xl border border-[#4A2E1B]/10 bg-white/70 p-4">
            <p className="font-mono text-[10px] font-semibold tracking-[0.16em] text-[#7A624E] uppercase">
              CURATOR NOTES
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-[#3E3127]">
              {activeVinyl.linerNotes || 'No curator notes added yet.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}