'use client';

import React, { useMemo, useState } from 'react';
import { ArrowLeft, Disc3, Play, Pause, Music2, Star } from 'lucide-react';
import { extractUniqueGenres } from '@/lib/genreUtils';
import {
  GenreItem,
  RELEASE_TYPES,
  RoomConfig,
  TrackItem,
  VinylRecord,
} from '@/types/orihour';
import { getSleeveDataUrl } from '@/components/room-3d/textures';
import ThemedDropdown from '@/components/ui/ThemedDropdown';

interface LofiCatalogViewProps {
  config: RoomConfig;
  vinyls: VinylRecord[];
  genres: GenreItem[];
  activeVinyl: VinylRecord | null;
  activeTrack: TrackItem | null;
  isPlaying: boolean;
  progressRatio: number;
  onSelectAndPlay: (vinyl: VinylRecord, subTrack?: TrackItem | null) => void;
  onSeekProgress: (ratio: number) => void;
  onReturnTo3D: () => void;
}

export default function LofiCatalogView({
  config,
  vinyls,
  genres,
  activeVinyl,
  activeTrack,
  isPlaying,
  progressRatio,
  onSelectAndPlay,
  onSeekProgress,
  onReturnTo3D,
}: LofiCatalogViewProps) {
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [genreFilter, setGenreFilter] = useState<string>('ALL');

  const genreDropdownOptions = useMemo(() => {
    const merged = new Set<string>(extractUniqueGenres(vinyls));
    genres.forEach((g) => {
      if (g.name) merged.add(g.name);
    });
    const sorted = Array.from(merged).sort((a, b) => a.localeCompare(b));
    return [
      { value: 'ALL', label: 'All Genres' },
      ...sorted.map((g) => ({ value: g, label: g })),
    ];
  }, [vinyls, genres]);

  const filteredVinyls = useMemo(() => {
    return vinyls.filter((v) => {
      const matchType = typeFilter === 'ALL' || v.releaseType === typeFilter;
      const g = (v.genre || v.mood || '').toLowerCase();
      const matchGenre = genreFilter === 'ALL' || g === genreFilter.toLowerCase();
      return matchType && matchGenre;
    });
  }, [vinyls, typeFilter, genreFilter]);

  const covers = useMemo(() => {
    const map = new Map<string, string>();
    if (typeof window !== 'undefined') {
      vinyls.forEach((v) => map.set(v.id, v.coverUrl || getSleeveDataUrl(v)));
    }
    return map;
  }, [vinyls]);

  return (
    <div className="min-h-screen bg-[#FAF5EC] text-[#241A13]">
      <header className="sticky top-0 z-20 border-b border-[#4A2E1B]/12 bg-[#FAF5EC]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-3">
            <Disc3 className="h-5 w-5 text-[#4A2E1B]" />
            <span className="font-serif text-2xl tracking-[0.14em] uppercase">
              {config.siteName}
            </span>
            <span className="rounded-full bg-[#4A2E1B]/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-[#5C4432]">
              LO-FI COLLECTION
            </span>
          </div>

          <button
            type="button"
            onClick={onReturnTo3D}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-[#4A2E1B] px-4 py-2 font-mono text-[11px] font-semibold tracking-wider text-[#FAF5EC] transition hover:bg-[#3A2213]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>RETURN TO 3D ROOM</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="max-w-xl">
          <p className="font-mono text-[11px] font-semibold tracking-[0.16em] text-[#7A5230] uppercase">
            CURATED COLLECTION · {vinyls.length} ITEMS
          </p>
          <h1 className="mt-2 font-serif text-4xl text-[#241A13] sm:text-5xl">
            Music Collection
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[#655040]">{config.bio}</p>
        </div>

        {/* Category Tabs + Themed Genre Dropdown */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {(['ALL', ...RELEASE_TYPES] as const).map((rt) => (
              <button
                key={rt}
                type="button"
                onClick={() => setTypeFilter(rt)}
                className={`cursor-pointer rounded-full border px-3 py-1 font-mono text-[10px] font-semibold uppercase transition ${
                  typeFilter === rt
                    ? 'border-[#4A2E1B] bg-[#4A2E1B] text-[#FAF5EC]'
                    : 'border-[#4A2E1B]/18 bg-white text-[#5C4432] hover:bg-[#F4ECE0]'
                }`}
              >
                {rt === 'ALL' ? 'ALL' : rt === 'Song' ? 'SONGS' : rt}
              </button>
            ))}
          </div>

          <ThemedDropdown
            value={genreFilter}
            options={genreDropdownOptions}
            onChange={setGenreFilter}
            ariaLabel="Filter by genre"
            size="sm"
            className="w-44 shrink-0"
          />
        </div>

        {/* Interactive Now-Playing Seek Bar */}
        {activeVinyl && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#4A2E1B]/15 bg-white/85 px-5 py-3.5 shadow-xs">
            <div className="min-w-0">
              <p className="font-mono text-[9.5px] font-semibold tracking-wider text-[#7A5230] uppercase">
                {isPlaying ? 'NOW PLAYING' : 'PAUSED'}
              </p>
              <p className="truncate font-serif text-lg text-[#241A13]">
                {activeTrack ? `${activeTrack.title} (${activeVinyl.title})` : activeVinyl.title} -{' '}
                <span className="font-sans text-xs text-[#655040]">{activeVinyl.artist}</span>
              </p>
            </div>
            <div className="relative flex w-full max-w-xs items-center">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#4A2E1B]/15">
                <div
                  className="h-full rounded-full bg-[#4A2E1B]"
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
        )}

        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredVinyls.map((vinyl) => {
            const isCurrent = activeVinyl?.id === vinyl.id;
            const thumb = covers.get(vinyl.id) || '';
            const isSong = vinyl.releaseType === 'Song';
            const subTracks = vinyl.tracks || [];

            return (
              <article
                key={vinyl.id}
                className={`flex flex-col overflow-hidden rounded-2xl border bg-white/85 p-4 shadow-xs transition hover:shadow-md ${
                  isCurrent
                    ? 'border-[#4A2E1B]/60 ring-1 ring-[#4A2E1B]/25'
                    : 'border-[#4A2E1B]/12'
                }`}
              >
                {thumb && (
                  <img
                    src={thumb}
                    alt={vinyl.title}
                    className="aspect-square w-full rounded-xl border border-black/10 object-cover"
                  />
                )}

                <div className="mt-3.5 flex items-center justify-between font-mono text-[10px] font-semibold tracking-wider text-[#7A624E] uppercase">
                  <span className="inline-flex items-center gap-1 text-[#4A2E1B]">
                    {isSong ? <Music2 className="h-3 w-3" /> : <Disc3 className="h-3 w-3" />}
                    {vinyl.releaseType} · {vinyl.genre || vinyl.mood}
                  </span>
                  <span>
                    {vinyl.releaseYear} · {isSong ? vinyl.duration : `${subTracks.length} trk`}
                  </span>
                </div>

                <h2 className="mt-1.5 font-serif text-2xl leading-snug text-[#241A13]">
                  {vinyl.title}
                </h2>
                <p className="text-xs font-medium text-[#655040]">{vinyl.artist}</p>

                {!isSong && vinyl.favoriteSong && (
                  <p className="mt-2 inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-[#7A5230]">
                    <Star className="h-3 w-3 text-[#B58A52]" />
                    Fav: {vinyl.favoriteSong}
                  </p>
                )}

                <p className="mt-2 line-clamp-3 flex-1 text-xs leading-relaxed text-[#4C3D31]">
                  {vinyl.linerNotes}
                </p>

                {!isSong && subTracks.length > 0 && (
                  <div className="mt-3 max-h-32 space-y-1 overflow-y-auto rounded-xl border border-[#4A2E1B]/10 bg-[#FAF5EC] p-2">
                    {subTracks.map((sub, i) => {
                      const isSubPlaying = isCurrent && activeTrack?.id === sub.id && isPlaying;
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => onSelectAndPlay(vinyl, sub)}
                          className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1 text-left text-[11px] transition ${
                            isSubPlaying
                              ? 'bg-[#4A2E1B] text-[#FAF5EC]'
                              : 'text-[#3A2213] hover:bg-white'
                          }`}
                        >
                          <span className="truncate">
                            {i + 1}. {sub.title}
                          </span>
                          <span className="shrink-0 font-mono text-[10px] opacity-75">
                            {sub.duration}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => onSelectAndPlay(vinyl, null)}
                  className={`mt-4 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-mono text-[11px] font-semibold tracking-wider uppercase transition ${
                    isCurrent && isPlaying
                      ? 'bg-[#241A13] text-[#FAF5EC] hover:bg-[#3A2B20]'
                      : 'bg-[#4A2E1B] text-[#FAF5EC] hover:bg-[#3A2213]'
                  }`}
                >
                  {isCurrent && isPlaying ? (
                    <>
                      <Pause className="h-3.5 w-3.5" />
                      <span>PAUSE</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5" />
                      <span>{isSong ? 'PLAY SONG' : `PLAY ${vinyl.releaseType}`}</span>
                    </>
                  )}
                </button>
              </article>
            );
          })}
        </div>
      </main>
    </div>
  );
}