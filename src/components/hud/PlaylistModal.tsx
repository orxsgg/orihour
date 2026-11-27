'use client';

import React, { useMemo, useState } from 'react';
import {
  X,
  Search,
  Disc3,
  ListMusic,
  Info,
  Star,
  Quote,
} from 'lucide-react';
import {
  GenreItem,
  RELEASE_TYPES,
  VinylRecord,
} from '@/types/orihour';
import {
  hasMultipleTracks,
  isSingleSongRelease,
  parseGenres,
  vinylMatchesGenre,
} from '@/lib/genreUtils';
import { getSleeveDataUrl } from '@/components/room-3d/textures';

interface PlaylistModalProps {
  open: boolean;
  vinyls: VinylRecord[];
  genres: GenreItem[];
  onClose: () => void;
  onViewTrackDetails: (track: VinylRecord) => void;
}

export default function PlaylistModal({
  open,
  vinyls,
  genres,
  onClose,
  onViewTrackDetails,
}: PlaylistModalProps) {
  const [search, setSearch] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');

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

  if (!open) return null;

  const getThumb = (v: VinylRecord) =>
    v.coverUrl || (typeof window !== 'undefined' ? getSleeveDataUrl(v) : '');

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#150E09]/60 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-[#E5D7C3] bg-[#FAF5EC] text-[#241A13] shadow-[0_32px_80px_-18px_rgba(12,8,4,0.68)]"
      >
        {/* Header */}
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#4A2E1B]/12 bg-[#F3E9DB] px-6 py-4">
          <div>
            <p className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-[0.16em] text-[#7A5230] uppercase">
              <Disc3 className="h-3.5 w-3.5" />
              MUSIC COLLECTION · {vinyls.length} RELEASES
            </p>
            <h2 className="mt-0.5 font-serif text-2xl text-[#241A13]">
              Curated Vinyl Archive
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-[#4A2E1B]/18 bg-[#FAF5EC] text-[#4A2E1B] transition hover:bg-white"
            aria-label="Close collection"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Search & Filters */}
        <div className="shrink-0 space-y-2.5 border-b border-[#4A2E1B]/10 bg-[#FAF5EC] px-6 py-3.5">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-3.5 w-3.5 -translate-y-1/2 text-[#8A7360]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, artist, album, track, or genre..."
              className="w-full rounded-xl border border-[#4A2E1B]/18 bg-white py-2 pr-3.5 pl-9 text-xs text-[#241A13] placeholder-[#9B8776] outline-none focus:border-[#4A2E1B]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(['ALL', ...RELEASE_TYPES] as const).map((rt) => (
              <button
                key={rt}
                type="button"
                onClick={() => setSelectedType(rt)}
                className={`cursor-pointer rounded-full border px-2.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase transition ${
                  selectedType === rt
                    ? 'border-[#4A2E1B] bg-[#4A2E1B] text-[#FAF5EC]'
                    : 'border-[#4A2E1B]/16 bg-white text-[#5C4432] hover:bg-[#EFE4D3]'
                }`}
              >
                {rt === 'ALL' ? 'All' : rt}
              </button>
            ))}
          </div>

          {genreOptions.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedGenre('ALL')}
                className={`cursor-pointer rounded-full border px-2.5 py-0.5 font-mono text-[9px] font-semibold uppercase transition ${
                  selectedGenre === 'ALL'
                    ? 'border-[#7A5230] bg-[#7A5230] text-[#FAF5EC]'
                    : 'border-[#4A2E1B]/14 bg-[#F5ECE0] text-[#6E5643] hover:bg-white'
                }`}
              >
                All Genres
              </button>
              {genreOptions.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setSelectedGenre(g)}
                  className={`cursor-pointer rounded-full border px-2.5 py-0.5 font-mono text-[9px] font-semibold uppercase transition ${
                    selectedGenre.toLowerCase() === g.toLowerCase()
                      ? 'border-[#7A5230] bg-[#7A5230] text-[#FAF5EC]'
                      : 'border-[#4A2E1B]/14 bg-[#F5ECE0] text-[#6E5643] hover:bg-white'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Collection List */}
        <div className="orihour-scroll flex-1 overflow-y-auto p-6">
          {filteredVinyls.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#4A2E1B]/20 bg-white/60 py-14 text-center font-mono text-xs text-[#8A7360]">
              No matching records found in the collection.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              {filteredVinyls.map((v) => {
                const isMulti = hasMultipleTracks(v);
                const isSingle = isSingleSongRelease(v);
                const genreList = parseGenres(v.genre || v.mood);
                const favLyric = isSingle ? (v.favoriteLyric || '').trim() : '';
                const favSong = !isSingle ? (v.favoriteSong || '').trim() : '';

                return (
                  <article
                    key={v.id}
                    className="flex flex-col justify-between gap-3 rounded-2xl border border-[#E5D7C3] bg-[#FFFDF8] p-4 shadow-xs transition hover:border-[#4A2E1B]/35 hover:shadow-sm"
                  >
                    <div className="flex gap-3.5">
                      <img
                        src={getThumb(v)}
                        alt={v.title}
                        className="h-20 w-20 shrink-0 rounded-xl border border-black/10 object-cover shadow-xs"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="rounded-full bg-[#4A2E1B] px-2 py-0.5 font-mono text-[8.5px] font-semibold text-[#FAF5EC] uppercase">
                            {v.releaseType}
                          </span>
                          {genreList.map((g) => (
                            <span
                              key={g}
                              className="rounded-full bg-[#4A2E1B]/10 px-2 py-0.5 font-mono text-[8.5px] font-semibold text-[#5C3B24] uppercase"
                            >
                              {g}
                            </span>
                          ))}
                        </div>

                        <h3 className="mt-1 truncate font-serif text-xl leading-snug text-[#241A13]">
                          {v.title}
                        </h3>
                        <p className="truncate text-xs text-[#655040]">
                          {v.artist} · {v.releaseYear} ·{' '}
                          {isMulti ? `${v.tracks?.length || 0} tracks` : v.duration}
                        </p>

                        {favLyric && (
                          <p className="mt-1.5 inline-flex max-w-full items-center gap-1 truncate font-serif text-[11.5px] text-[#5C4432] italic">
                            <Quote className="h-2.5 w-2.5 shrink-0 text-[#9A7A5A]" />
                            <span className="truncate">&ldquo;{favLyric}&rdquo;</span>
                          </p>
                        )}

                        {favSong && (
                          <p className="mt-1.5 inline-flex max-w-full items-center gap-1 truncate font-mono text-[10px] text-[#6E4D1B]">
                            <Star className="h-2.5 w-2.5 shrink-0 fill-[#C89B54] text-[#C89B54]" />
                            <span className="truncate">Fav: {favSong}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end border-t border-[#4A2E1B]/10 pt-2.5">
                      <button
                        type="button"
                        onClick={() => onViewTrackDetails(v)}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#4A2E1B] px-3.5 py-1.5 text-xs font-semibold text-[#FAF5EC] shadow-xs transition hover:bg-[#3A2213]"
                      >
                        {isMulti ? (
                          <ListMusic className="h-3.5 w-3.5" />
                        ) : (
                          <Info className="h-3.5 w-3.5" />
                        )}
                        <span>{isMulti ? 'Tracklist' : 'Details'}</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}