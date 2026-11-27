'use client';

import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Disc3,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Search,
  Star,
  Quote,
  ListMusic,
  Info,
  ChevronDown,
  ChevronUp,
  Music2,
  BookOpen,
  Scissors,
} from 'lucide-react';
import {
  GenreItem,
  RELEASE_TYPES,
  RoomConfig,
  TrackItem,
  VinylRecord,
} from '@/types/orihour';
import {
  hasMultipleTracks,
  isSingleSongRelease,
  parseGenres,
  vinylMatchesGenre,
} from '@/lib/genreUtils';
import { getSleeveDataUrl } from '@/components/room-3d/textures';
import MarqueeText from '@/components/ui/MarqueeText';

interface LofiCatalogViewProps {
  config: RoomConfig;
  vinyls: VinylRecord[];
  genres: GenreItem[];
  activeVinyl: VinylRecord | null;
  activeTrack: TrackItem | null;
  isPlaying: boolean;
  progressRatio: number;
  returnTarget?: 'ENTRY' | 'ROOM';
  onSelectAndPlay: (vinyl: VinylRecord, subTrack?: TrackItem | null) => void;
  onPrevTrack?: () => void;
  onNextTrack?: () => void;
  onSeekProgress: (ratio: number) => void;
  onReturnTo3D: () => void;
}

function formatSec(sec: number): string {
  const safe = Math.max(0, Math.round(sec));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function LofiCatalogView({
  config,
  vinyls,
  genres,
  activeVinyl,
  activeTrack,
  isPlaying,
  progressRatio,
  returnTarget = 'ROOM',
  onSelectAndPlay,
  onPrevTrack,
  onNextTrack,
  onSeekProgress,
  onReturnTo3D,
}: LofiCatalogViewProps) {
  const [search, setSearch] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const genreOptions = useMemo(() => {
    const map = new Map<string, string>();
    genres.forEach((g) => {
      parseGenres(g.name).forEach((name) => {
        const key = name.toLowerCase();
        if (!map.has(key)) map.set(key, name);
      });
    });
    vinyls.forEach((v) => {
      parseGenres(v.genre || v.mood).forEach((name) => {
        const key = name.toLowerCase();
        if (!map.has(key)) map.set(key, name);
      });
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [genres, vinyls]);

  const filteredVinyls = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vinyls.filter((v) => {
      const matchType = selectedType === 'ALL' || v.releaseType === selectedType;
      const matchGenre =
        selectedGenre === 'ALL' || vinylMatchesGenre(v, selectedGenre);
      const genreList = parseGenres(v.genre || v.mood);
      const matchQuery =
        !q ||
        v.title.toLowerCase().includes(q) ||
        v.artist.toLowerCase().includes(q) ||
        v.album.toLowerCase().includes(q) ||
        genreList.some((g) => g.toLowerCase().includes(q)) ||
        (v.tracks || []).some((t) => t.title.toLowerCase().includes(q));

      return matchType && matchGenre && matchQuery;
    });
  }, [vinyls, search, selectedType, selectedGenre]);

  const getThumb = (v: VinylRecord) =>
    v.coverUrl || (typeof window !== 'undefined' ? getSleeveDataUrl(v) : '');

  const returnLabel =
    returnTarget === 'ENTRY' ? 'Back to Welcome' : 'Return to 3D Room';

  const activeHasMultiTracks = Boolean(activeVinyl && hasMultipleTracks(activeVinyl));
  const canStepTracks = Boolean(activeHasMultiTracks && onPrevTrack && onNextTrack);
  const activeTitleText = activeTrack
    ? activeTrack.title
    : activeVinyl?.title ?? '';
  const activeSubText = activeVinyl
    ? `${activeVinyl.artist}${activeTrack ? ` · ${activeVinyl.title}` : ''}`
    : '';

  return (
    <div
      className="flex h-[100dvh] flex-col overflow-hidden bg-[#F3ECE0] text-[#241A13]"
      style={{
        backgroundImage:
          'radial-gradient(circle at 12% 10%, rgba(200, 155, 84, 0.2), transparent 44%), radial-gradient(circle at 88% 85%, rgba(74, 46, 27, 0.12), transparent 46%)',
      }}
    >
      {/* Fixed Top Header — Never Scrolls */}
      <header className="z-30 shrink-0 border-b border-[#E5D7C3] bg-[#FAF5EC]/92 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#4A2E1B] text-[#FAF5EC] shadow-xs sm:h-10 sm:w-10">
              <Disc3 className={`h-4 w-4 sm:h-5 sm:w-5 ${isPlaying ? 'animate-spin' : ''}`} />
            </div>
            <div className="min-w-0">
              <p className="truncate font-mono text-[9.5px] font-semibold tracking-[0.2em] text-[#7A5230] uppercase sm:text-[10px]">
                LO-FI LISTENING CATALOG
              </p>
              <h1 className="truncate font-serif text-xl leading-tight text-[#241A13] sm:text-2xl">
                {config.siteName}
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={onReturnTo3D}
            className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#4A2E1B] px-3.5 py-2 text-xs font-semibold text-[#FAF5EC] shadow-sm transition hover:bg-[#3A2213] sm:gap-2 sm:px-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>{returnLabel}</span>
          </button>
        </div>
      </header>

      {/* Scrollable Middle Catalog Area ONLY (Header & Bottom Player stay locked) */}
      <div className="orihour-scroll flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        <main className="mx-auto max-w-6xl space-y-5 px-4 py-5 sm:space-y-6 sm:px-6 sm:py-6">
          {/* Search & Filter Panel */}
          <section className="space-y-3 rounded-[22px] border border-[#E5D7C3] bg-[#FAF5EC]/88 p-4 shadow-xs backdrop-blur-xl sm:space-y-3.5 sm:rounded-[24px] sm:p-5">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-md">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#8A7360]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search title, artist, album, track, or genre..."
                  className="w-full rounded-xl border border-[#4A2E1B]/18 bg-white py-2 pr-4 pl-10 text-xs text-[#241A13] placeholder-[#9B8776] outline-none focus:border-[#4A2E1B] sm:py-2.5"
                />
              </div>

              <p className="font-mono text-[10px] font-semibold tracking-wider text-[#7A5230] uppercase sm:text-[10.5px]">
                SHOWING {filteredVinyls.length} OF {vinyls.length} RELEASES
              </p>
            </div>

            {/* Release Type Filter Pills */}
            <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto border-t border-[#4A2E1B]/10 pt-3 sm:flex-wrap sm:overflow-visible">
              {(['ALL', ...RELEASE_TYPES] as const).map((rt) => (
                <button
                  key={rt}
                  type="button"
                  onClick={() => setSelectedType(rt)}
                  className={`shrink-0 cursor-pointer whitespace-nowrap rounded-full border px-3 py-1 font-mono text-[10px] font-semibold uppercase transition ${
                    selectedType === rt
                      ? 'border-[#4A2E1B] bg-[#4A2E1B] text-[#FAF5EC]'
                      : 'border-[#4A2E1B]/16 bg-white/85 text-[#5C4432] hover:bg-white'
                  }`}
                >
                  {rt === 'ALL' ? 'All Releases' : rt}
                </button>
              ))}
            </div>

            {/* Multi-Genre Filter Pills */}
            {genreOptions.length > 0 && (
              <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto sm:flex-wrap sm:overflow-visible">
                <button
                  type="button"
                  onClick={() => setSelectedGenre('ALL')}
                  className={`shrink-0 cursor-pointer whitespace-nowrap rounded-full border px-2.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase transition ${
                    selectedGenre === 'ALL'
                      ? 'border-[#7A5230] bg-[#7A5230] text-[#FAF5EC]'
                      : 'border-[#4A2E1B]/14 bg-[#FAF5EC] text-[#6E5643] hover:bg-white'
                  }`}
                >
                  All Genres
                </button>
                {genreOptions.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setSelectedGenre(g)}
                    className={`shrink-0 cursor-pointer whitespace-nowrap rounded-full border px-2.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase transition ${
                      selectedGenre.toLowerCase() === g.toLowerCase()
                        ? 'border-[#7A5230] bg-[#7A5230] text-[#FAF5EC]'
                        : 'border-[#4A2E1B]/14 bg-[#FAF5EC] text-[#6E5643] hover:bg-white'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Catalog Grid */}
          {filteredVinyls.length === 0 ? (
            <div className="rounded-[24px] border border-[#E5D7C3] bg-[#FAF5EC]/85 py-16 text-center font-mono text-xs text-[#7A624E]">
              No releases match your current search or filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
              {filteredVinyls.map((v) => {
                const isCurrent = activeVinyl?.id === v.id;
                const isCurrentPlaying = isCurrent && isPlaying;
                const isMulti = hasMultipleTracks(v);
                const isSingle = isSingleSongRelease(v);
                const genreList = parseGenres(v.genre || v.mood);
                const favLyric = isSingle ? (v.favoriteLyric || '').trim() : '';
                const favSong = !isSingle ? (v.favoriteSong || '').trim() : '';
                const notes = (v.linerNotes || '').trim();
                const trackList = Array.isArray(v.tracks) ? v.tracks : [];
                const hasTracklist = isMulti && trackList.length > 0;
                const hasDetailsContent =
                  Boolean(favLyric) ||
                  Boolean(favSong) ||
                  Boolean(notes) ||
                  hasTracklist;
                const isExpanded = expandedId === v.id && hasDetailsContent;

                return (
                  <article
                    key={v.id}
                    className={`flex flex-col rounded-[22px] border p-4 shadow-xs backdrop-blur-xl transition sm:rounded-[24px] ${
                      isCurrent
                        ? 'border-[#4A2E1B] bg-[#FFFDF8] ring-1 ring-[#4A2E1B]/20'
                        : 'border-[#E5D7C3] bg-[#FAF5EC]/88 hover:bg-white/95'
                    }`}
                  >
                    <div className="flex gap-3.5 sm:gap-4">
                      <button
                        type="button"
                        onClick={() => onSelectAndPlay(v)}
                        className="group relative h-20 w-20 shrink-0 cursor-pointer overflow-hidden rounded-2xl border border-black/10 bg-[#1A130E] shadow-sm sm:h-24 sm:w-24"
                        aria-label={isCurrentPlaying ? `Pause ${v.title}` : `Play ${v.title}`}
                      >
                        <img
                          src={getThumb(v)}
                          alt={v.title}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        />
                        <span
                          className={`absolute inset-0 flex items-center justify-center bg-[#18110C]/45 text-[#FAF5EC] transition ${
                            isCurrentPlaying
                              ? 'opacity-100'
                              : 'opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          {isCurrentPlaying ? (
                            <Pause className="h-6 w-6 fill-current" />
                          ) : (
                            <Play className="ml-0.5 h-6 w-6 fill-current" />
                          )}
                        </span>
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full bg-[#4A2E1B] px-2 py-0.5 font-mono text-[9px] font-semibold text-[#FAF5EC] uppercase">
                            {v.releaseType}
                          </span>
                          {genreList.map((g) => (
                            <span
                              key={g}
                              className="rounded-full bg-[#4A2E1B]/10 px-2 py-0.5 font-mono text-[9px] font-semibold text-[#5C3B24] uppercase"
                            >
                              {g}
                            </span>
                          ))}
                          {v.clipMode === 'snippet' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#C89B54]/20 px-2 py-0.5 font-mono text-[9px] font-semibold text-[#6E4D1B] uppercase">
                              <Scissors className="h-2.5 w-2.5" />
                              Snippet
                            </span>
                          )}
                        </div>

                        <h2 className="mt-1.5 truncate font-serif text-xl leading-tight text-[#241A13] sm:text-2xl">
                          {v.title}
                        </h2>
                        <p className="truncate text-xs font-medium text-[#655040]">
                          {v.artist}
                          {isSingle && v.album?.trim() ? ` · ${v.album}` : ''}
                        </p>
                        <p className="mt-0.5 font-mono text-[10px] text-[#8A7360]">
                          {v.releaseYear} ·{' '}
                          {hasTracklist ? `${trackList.length} tracks` : v.duration}
                        </p>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-[#4A2E1B]/10 pt-3">
                      <button
                        type="button"
                        onClick={() => onSelectAndPlay(v)}
                        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
                          isCurrentPlaying
                            ? 'bg-[#6E1D2C] text-[#FAF5EC] hover:bg-[#571622]'
                            : 'bg-[#4A2E1B] text-[#FAF5EC] hover:bg-[#3A2213]'
                        }`}
                      >
                        {isCurrentPlaying ? (
                          <>
                            <Pause className="h-3.5 w-3.5" />
                            <span>Pause</span>
                          </>
                        ) : (
                          <>
                            <Play className="h-3.5 w-3.5" />
                            <span>{isCurrent ? 'Resume' : 'Play'}</span>
                          </>
                        )}
                      </button>

                      {hasDetailsContent && (
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : v.id)}
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#4A2E1B]/18 bg-white px-3 py-1.5 text-xs font-semibold text-[#4A2E1B] transition hover:bg-[#EFE4D3]"
                        >
                          {hasTracklist ? (
                            <ListMusic className="h-3.5 w-3.5" />
                          ) : (
                            <Info className="h-3.5 w-3.5" />
                          )}
                          <span>{hasTracklist ? 'Tracklist' : 'Details'}</span>
                          {isExpanded ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="mt-3 space-y-3 border-t border-[#4A2E1B]/10 pt-3">
                        {favLyric && (
                          <div className="rounded-xl border border-[#4A2E1B]/12 bg-[#F6EFE3]/85 px-3.5 py-2.5">
                            <p className="inline-flex items-center gap-1 font-mono text-[9.5px] font-semibold tracking-wider text-[#7A5230] uppercase">
                              <Quote className="h-2.5 w-2.5" />
                              Favorite Lyric
                            </p>
                            <p className="mt-1 font-serif text-sm leading-snug text-[#2E231B] italic">
                              &ldquo;{favLyric}&rdquo;
                            </p>
                          </div>
                        )}

                        {favSong && (
                          <div className="rounded-xl border border-[#4A2E1B]/12 bg-[#F6EFE3]/85 px-3.5 py-2.5">
                            <p className="inline-flex items-center gap-1 font-mono text-[9.5px] font-semibold tracking-wider text-[#7A5230] uppercase">
                              <Star className="h-2.5 w-2.5 fill-[#C89B54] text-[#C89B54]" />
                              Favorite Track
                            </p>
                            <p className="mt-0.5 text-xs font-semibold text-[#241A13]">
                              {favSong}
                            </p>
                          </div>
                        )}

                        {notes && (
                          <div className="rounded-xl border border-[#4A2E1B]/10 bg-white/85 p-3.5">
                            <p className="inline-flex items-center gap-1.5 font-mono text-[9.5px] font-semibold tracking-wider text-[#7A5230] uppercase">
                              <BookOpen className="h-3 w-3" />
                              Curator Notes
                            </p>
                            <p className="mt-1.5 text-xs leading-relaxed whitespace-pre-line text-[#3A2E25]">
                              {notes}
                            </p>
                          </div>
                        )}

                        {hasTracklist && (
                          <div className="space-y-1.5 rounded-xl border border-[#4A2E1B]/10 bg-white/85 p-3">
                            <p className="font-mono text-[9.5px] font-semibold tracking-wider text-[#7A5230] uppercase">
                              TRACKLIST ({trackList.length})
                            </p>
                            <div className="divide-y divide-[#4A2E1B]/8">
                              {trackList.map((trk, idx) => {
                                const isTrkActive =
                                  isCurrent && activeTrack?.id === trk.id;
                                const isTrkPlaying = isTrkActive && isPlaying;
                                const isFav =
                                  favSong &&
                                  trk.title.trim().toLowerCase() === favSong.toLowerCase();

                                return (
                                  <button
                                    key={trk.id}
                                    type="button"
                                    onClick={() => onSelectAndPlay(v, trk)}
                                    className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-xs transition ${
                                      isTrkActive
                                        ? 'bg-[#EFE4D3] font-semibold text-[#241A13]'
                                        : 'hover:bg-[#FAF5EC]'
                                    }`}
                                  >
                                    <div className="flex min-w-0 items-center gap-2.5">
                                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#4A2E1B]/10 font-mono text-[10px] text-[#4A2E1B]">
                                        {isTrkPlaying ? (
                                          <Pause className="h-2.5 w-2.5" />
                                        ) : (
                                          idx + 1
                                        )}
                                      </span>
                                      <span className="truncate">{trk.title}</span>
                                      {isFav && (
                                        <Star className="h-3 w-3 shrink-0 fill-[#C89B54] text-[#C89B54]" />
                                      )}
                                    </div>
                                    <span className="shrink-0 font-mono text-[10px] text-[#7A624E]">
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
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* In-Flow Flex Footer Player — Identical centered layout for both 1-track & multi-track releases */}
      {activeVinyl && (
        <footer className="z-30 shrink-0 border-t border-[#E5D7C3] bg-[#FAF5EC]/96 shadow-[0_-10px_30px_rgba(24,17,12,0.1)] backdrop-blur-xl">
          <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-2.5 px-4 py-2.5 sm:px-6 md:grid-cols-3 md:gap-4 md:py-3">
            {/* Left: Cover Art + Title + Artist */}
            <div className="flex min-w-0 items-center gap-3">
              <img
                src={getThumb(activeVinyl)}
                alt={activeVinyl.title}
                className="h-10 w-10 shrink-0 rounded-xl border border-black/10 object-cover sm:h-11 sm:w-11"
              />
              <div className="min-w-0 flex-1">
                <p className="inline-flex items-center gap-1 font-mono text-[8.5px] font-semibold tracking-wider text-[#7A5230] uppercase sm:text-[9px]">
                  <Music2 className="h-2.5 w-2.5" />
                  {isPlaying ? 'Now Playing' : 'Paused'}
                </p>
                <MarqueeText
                  measureKey={`lofi-title-${activeVinyl.id}-${activeTrack?.id ?? 'single'}-${activeTitleText}`}
                  className="font-serif text-base leading-tight text-[#241A13] sm:text-lg"
                >
                  {activeTitleText}
                </MarqueeText>
                <MarqueeText
                  measureKey={`lofi-sub-${activeVinyl.id}-${activeTrack?.id ?? 'single'}-${activeSubText}`}
                  className="text-[10.5px] leading-tight text-[#655040] sm:text-[11px]"
                >
                  {activeSubText}
                </MarqueeText>
              </div>
            </div>

            {/* Center: Unified [Prev] [Play/Pause] [Next] + Seek Bar Underneath (Prev/Next dimmed & disabled on 1-song releases) */}
            <div className="flex w-full justify-center">
              <div className="flex w-full max-w-md flex-col items-center gap-1.5">
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    disabled={!canStepTracks}
                    onClick={() => {
                      if (canStepTracks && onPrevTrack) onPrevTrack();
                    }}
                    className={`flex h-7 w-7 items-center justify-center rounded-full border transition ${
                      canStepTracks
                        ? 'cursor-pointer border-[#4A2E1B]/20 bg-white text-[#4A2E1B] shadow-xs hover:bg-[#EFE4D3]'
                        : 'cursor-not-allowed border-[#4A2E1B]/14 bg-[#241A13]/18 text-[#241A13]/38'
                    }`}
                    aria-label="Previous track"
                    title={canStepTracks ? 'Previous track' : 'Single track release'}
                  >
                    <SkipBack className="h-3.5 w-3.5 fill-current" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onSelectAndPlay(activeVinyl, activeTrack)}
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[#4A2E1B] text-[#FAF5EC] shadow-xs transition hover:bg-[#3A2213] sm:h-9 sm:w-9"
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? (
                      <Pause className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    ) : (
                      <Play className="ml-0.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={!canStepTracks}
                    onClick={() => {
                      if (canStepTracks && onNextTrack) onNextTrack();
                    }}
                    className={`flex h-7 w-7 items-center justify-center rounded-full border transition ${
                      canStepTracks
                        ? 'cursor-pointer border-[#4A2E1B]/20 bg-white text-[#4A2E1B] shadow-xs hover:bg-[#EFE4D3]'
                        : 'cursor-not-allowed border-[#4A2E1B]/14 bg-[#241A13]/18 text-[#241A13]/38'
                    }`}
                    aria-label="Next track"
                    title={canStepTracks ? 'Next track' : 'Single track release'}
                  >
                    <SkipForward className="h-3.5 w-3.5 fill-current" />
                  </button>
                </div>

                <div className="relative flex w-full items-center">
                  <div className="pointer-events-none h-1.5 w-full overflow-hidden rounded-full bg-[#4A2E1B]/15">
                    <div
                      className="h-full rounded-full bg-[#4A2E1B] transition-[width] duration-150"
                      style={{ width: `${Math.round(progressRatio * 100)}%` }}
                    />
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.005}
                    value={progressRatio}
                    onChange={(e) => onSeekProgress(parseFloat(e.target.value))}
                    aria-label="Seek playback position"
                    className="absolute inset-0 h-5 w-full -translate-y-1.5 cursor-pointer opacity-0"
                  />
                </div>
              </div>
            </div>

            {/* Right: Desktop Balancing Column */}
            <div className="hidden justify-end md:flex">
              <span className="rounded-full border border-[#4A2E1B]/14 bg-[#F3E9DB]/80 px-2.5 py-1 font-mono text-[9.5px] font-semibold text-[#6E5643] uppercase">
                {activeVinyl.releaseType}
                {activeHasMultiTracks && activeVinyl.tracks
                  ? ` · ${activeVinyl.tracks.length} tracks`
                  : ''}
              </span>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}