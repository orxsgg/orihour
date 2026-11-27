'use client';

import React from 'react';
import {
  X,
  ArrowLeft,
  Play,
  Pause,
  Star,
  Quote,
  BookOpen,
  ListMusic,
  Scissors,
} from 'lucide-react';
import { TrackItem, VinylRecord } from '@/types/orihour';
import {
  hasMultipleTracks,
  isSingleSongRelease,
  parseGenres,
} from '@/lib/genreUtils';
import { getSleeveDataUrl } from '@/components/room-3d/textures';

interface PlaylistTrackModalProps {
  track: VinylRecord | null;
  activeSubTrack: TrackItem | null;
  isCardPlaying: boolean;
  cardProgressRatio: number;
  onToggleCardPlay: (vinyl: VinylRecord, subTrack?: TrackItem | null) => void;
  onSeekCardProgress: (ratio: number) => void;
  onBackToCollection: () => void;
  onCloseAll: () => void;
}

function formatSec(sec: number): string {
  const safe = Math.max(0, Math.round(sec));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function PlaylistTrackModal({
  track,
  activeSubTrack,
  isCardPlaying,
  cardProgressRatio,
  onToggleCardPlay,
  onSeekCardProgress,
  onBackToCollection,
  onCloseAll,
}: PlaylistTrackModalProps) {
  if (!track) return null;

  const isMulti = hasMultipleTracks(track);
  const isSingle = isSingleSongRelease(track);
  const genreList = parseGenres(track.genre || track.mood);
  const trackList = Array.isArray(track.tracks) ? track.tracks : [];

  const favLyric = isSingle ? (track.favoriteLyric || '').trim() : '';
  const favSong = !isSingle ? (track.favoriteSong || '').trim() : '';
  const notes = (track.linerNotes || '').trim();

  const coverSrc =
    track.coverUrl || (typeof window !== 'undefined' ? getSleeveDataUrl(track) : '');

  const currentClipMode = activeSubTrack?.clipMode || track.clipMode || 'full';
  const currentStartSec = activeSubTrack?.clipStartSec ?? track.clipStartSec ?? 0;
  const currentEndSec = activeSubTrack?.clipEndSec ?? track.clipEndSec ?? 30;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#150E09]/62 p-4 backdrop-blur-md"
      onClick={onCloseAll}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-[#E5D7C3] bg-[#FAF5EC] text-[#241A13] shadow-[0_32px_80px_-18px_rgba(12,8,4,0.7)]"
      >
        {/* Header */}
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#4A2E1B]/12 bg-[#F3E9DB] px-5 py-3.5">
          <button
            type="button"
            onClick={onBackToCollection}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#4A2E1B]/18 bg-[#FAF5EC] px-3 py-1.5 text-xs font-semibold text-[#4A2E1B] transition hover:bg-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Collection</span>
          </button>

          <span className="font-mono text-[10px] font-semibold tracking-[0.16em] text-[#7A5230] uppercase">
            {isMulti ? 'RELEASE TRACKLIST' : 'TRACK DETAILS'}
          </span>

          <button
            type="button"
            onClick={onCloseAll}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[#4A2E1B]/18 bg-[#FAF5EC] text-[#4A2E1B] transition hover:bg-white"
            aria-label="Close details"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Scrollable Body */}
        <div className="orihour-scroll flex-1 space-y-5 overflow-y-auto p-6">
          {/* Top Summary + Cover */}
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <img
              src={coverSrc}
              alt={track.title}
              className="h-36 w-36 shrink-0 rounded-2xl border border-black/12 object-cover shadow-md"
            />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-[#4A2E1B] px-2.5 py-0.5 font-mono text-[9.5px] font-semibold text-[#FAF5EC] uppercase">
                  {track.releaseType}
                </span>
                {genreList.map((g) => (
                  <span
                    key={g}
                    className="rounded-full bg-[#4A2E1B]/10 px-2.5 py-0.5 font-mono text-[9.5px] font-semibold text-[#5C3B24] uppercase"
                  >
                    {g}
                  </span>
                ))}
              </div>

              <h2 className="mt-2 font-serif text-3xl leading-tight text-[#241A13]">
                {track.title}
              </h2>
              <p className="mt-0.5 text-sm font-medium text-[#655040]">
                {track.artist}
                {isSingle && track.album?.trim() ? ` · ${track.album}` : ''}
              </p>
              <p className="mt-1 font-mono text-[11px] text-[#8A7360]">
                {track.releaseYear} ·{' '}
                {isMulti ? `${trackList.length} tracks` : track.duration}
              </p>
            </div>
          </div>

          {/* Preview Audio Bar */}
          <div className="rounded-2xl border border-[#4A2E1B]/14 bg-white/90 p-4 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-mono text-[9.5px] font-semibold tracking-wider text-[#7A5230] uppercase">
                  {isCardPlaying ? 'NOW PREVIEWING' : 'AUDIO PREVIEW'}
                </p>
                <p className="truncate text-sm font-semibold text-[#241A13]">
                  {activeSubTrack ? activeSubTrack.title : track.title}
                </p>
              </div>

              {currentClipMode === 'snippet' && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#C89B54]/20 px-2.5 py-0.5 font-mono text-[9.5px] font-semibold text-[#6E4D1B]">
                  <Scissors className="h-3 w-3" />
                  Snippet {formatSec(currentStartSec)}-{formatSec(currentEndSec)}
                </span>
              )}
            </div>

            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={() => onToggleCardPlay(track, activeSubTrack)}
                className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#4A2E1B] text-[#FAF5EC] shadow-sm transition hover:bg-[#3A2213]"
                aria-label={isCardPlaying ? 'Pause preview' : 'Play preview'}
              >
                {isCardPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="ml-0.5 h-4 w-4" />
                )}
              </button>

              <div className="relative flex flex-1 items-center">
                <div className="pointer-events-none h-1.5 w-full overflow-hidden rounded-full bg-[#4A2E1B]/15">
                  <div
                    className="h-full rounded-full bg-[#4A2E1B] transition-[width] duration-150"
                    style={{ width: `${Math.round(cardProgressRatio * 100)}%` }}
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.005}
                  value={cardProgressRatio}
                  onChange={(e) => onSeekCardProgress(parseFloat(e.target.value))}
                  aria-label="Seek preview"
                  className="absolute inset-0 h-5 w-full -translate-y-1.5 cursor-pointer opacity-0"
                />
              </div>
            </div>
          </div>

          {/* Favorite Lyric (Only shown for 1-song releases when filled) */}
          {favLyric && (
            <section className="rounded-2xl border border-[#4A2E1B]/14 bg-[#F5EDE0] p-4">
              <p className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-[0.14em] text-[#7A5230] uppercase">
                <Quote className="h-3 w-3" />
                Favorite Lyric
              </p>
              <blockquote className="mt-2 border-l-2 border-[#4A2E1B] pl-3.5 font-serif text-lg leading-relaxed text-[#241A13] italic">
                &ldquo;{favLyric}&rdquo;
              </blockquote>
            </section>
          )}

          {/* Favorite Track (Only shown for multi-track releases when filled) */}
          {favSong && (
            <section className="rounded-2xl border border-[#4A2E1B]/14 bg-[#F5EDE0] p-4">
              <p className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-[0.14em] text-[#7A5230] uppercase">
                <Star className="h-3 w-3 fill-[#C89B54] text-[#C89B54]" />
                Favorite Track
              </p>
              <p className="mt-1.5 font-serif text-xl text-[#241A13]">{favSong}</p>
            </section>
          )}

          {/* Curator Notes (Only shown when filled) */}
          {notes && (
            <section className="rounded-2xl border border-[#4A2E1B]/12 bg-white/85 p-4">
              <p className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-[0.14em] text-[#7A5230] uppercase">
                <BookOpen className="h-3 w-3" />
                Curator Notes
              </p>
              <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-[#3A2E25]">
                {notes}
              </p>
            </section>
          )}

          {/* Tracklist (Only shown for multi-track releases) */}
          {isMulti && trackList.length > 0 && (
            <section className="rounded-2xl border border-[#4A2E1B]/12 bg-white/88 p-4">
              <p className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-[0.14em] text-[#7A5230] uppercase">
                <ListMusic className="h-3.5 w-3.5" />
                Tracklist ({trackList.length} Tracks)
              </p>

              <div className="mt-3 divide-y divide-[#4A2E1B]/10">
                {trackList.map((trk, idx) => {
                  const isActive = activeSubTrack?.id === trk.id;
                  const isActivePlaying = isActive && isCardPlaying;
                  const isFav =
                    favSong && trk.title.trim().toLowerCase() === favSong.toLowerCase();

                  return (
                    <button
                      key={trk.id}
                      type="button"
                      onClick={() => onToggleCardPlay(track, trk)}
                      className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-xs transition ${
                        isActive
                          ? 'bg-[#EFE4D3] font-semibold text-[#241A13]'
                          : 'hover:bg-[#FAF5EC]'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#4A2E1B]/12 font-mono text-[10px] font-bold text-[#4A2E1B]">
                          {isActivePlaying ? (
                            <Pause className="h-3 w-3" />
                          ) : (
                            idx + 1
                          )}
                        </span>
                        <span className="truncate">{trk.title}</span>
                        {isFav && (
                          <Star className="h-3.5 w-3.5 shrink-0 fill-[#C89B54] text-[#C89B54]" />
                        )}
                      </div>

                      <span className="shrink-0 font-mono text-[10.5px] text-[#7A624E]">
                        {trk.clipMode === 'snippet'
                          ? `${formatSec(trk.clipStartSec ?? 0)}-${formatSec(
                              trk.clipEndSec ?? 30
                            )}`
                          : trk.duration}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}