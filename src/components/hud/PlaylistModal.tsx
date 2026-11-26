'use client';

import React, { useMemo, useState } from 'react';
import { X, Search, Library, ArrowUpRight, Disc3, Music2 } from 'lucide-react';
import { extractUniqueGenres } from '@/lib/genreUtils';
import { GenreItem, RELEASE_TYPES, VinylRecord } from '@/types/orihour';
import { getSleeveDataUrl } from '@/components/room-3d/textures';
import ThemedDropdown from '@/components/ui/ThemedDropdown';

interface PlaylistModalProps {
  open: boolean;
  vinyls: VinylRecord[];
  genres: GenreItem[];
  onClose: () => void;
  onViewTrackDetails: (vinyl: VinylRecord) => void;
}

export default function PlaylistModal({
  open,
  vinyls,
  genres,
  onClose,
  onViewTrackDetails,
}: PlaylistModalProps) {
  const [query, setQuery] = useState('');
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
    const q = query.trim().toLowerCase();
    return vinyls.filter((v) => {
      const matchType = typeFilter === 'ALL' || v.releaseType === typeFilter;
      const trackGenre = (v.genre || v.mood || '').toLowerCase();
      const matchGenre =
        genreFilter === 'ALL' || trackGenre === genreFilter.toLowerCase();
      const matchQuery =
        !q ||
        v.title.toLowerCase().includes(q) ||
        v.artist.toLowerCase().includes(q) ||
        v.album.toLowerCase().includes(q) ||
        trackGenre.includes(q) ||
        (v.tracks || []).some((t) => t.title.toLowerCase().includes(q));
      return matchType && matchGenre && matchQuery;
    });
  }, [vinyls, query, typeFilter, genreFilter]);

  if (!open) return null;

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
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#4A2E1B]/12 text-[#4A2E1B]">
              <Library className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-serif text-2xl leading-none text-[#241A13]">
                Music Collection
              </h2>
              <p className="mt-0.5 font-mono text-[10px] tracking-[0.14em] text-[#7A624E] uppercase">
                SONGS, ALBUMS &amp; PRESSINGS · {vinyls.length} ITEMS
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[#4A2E1B]/15 bg-white/80 text-[#4A2E1B] transition hover:bg-white"
            aria-label="Close collection"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="orihour-scroll flex-1 overflow-y-auto p-6">
          {/* Search Input + Themed Genre Dropdown */}
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#7A624E]" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search title, artist, album, or track..."
                className="w-full rounded-xl border border-[#4A2E1B]/18 bg-[#FFFCF7] py-2.5 pr-3 pl-10 text-sm text-[#241A13] placeholder-[#9B8776] outline-none transition focus:border-[#4A2E1B]"
              />
            </div>

            <ThemedDropdown
              value={genreFilter}
              options={genreDropdownOptions}
              onChange={setGenreFilter}
              ariaLabel="Filter by genre"
              size="md"
              className="shrink-0 sm:w-44"
            />
          </div>

          {/* Release Category Tabs */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(['ALL', ...RELEASE_TYPES] as const).map((rt) => (
              <button
                key={rt}
                type="button"
                onClick={() => setTypeFilter(rt)}
                className={`cursor-pointer rounded-full border px-3 py-1 font-mono text-[10px] font-semibold tracking-wider uppercase transition ${
                  typeFilter === rt
                    ? 'border-[#4A2E1B] bg-[#4A2E1B] text-[#FAF5EC]'
                    : 'border-[#4A2E1B]/15 bg-white/75 text-[#5C4432] hover:bg-white'
                }`}
              >
                {rt === 'ALL' ? 'ALL' : rt === 'Song' ? 'SONGS' : rt}
              </button>
            ))}
          </div>

          {/* Collection List */}
          <div className="mt-4 divide-y divide-[#4A2E1B]/10 rounded-2xl border border-[#4A2E1B]/12 bg-white/75">
            {filteredVinyls.length === 0 ? (
              <div className="p-8 text-center font-mono text-xs text-[#7A624E]">
                No items match your filter.
              </div>
            ) : (
              filteredVinyls.map((v) => {
                const thumb =
                  typeof window !== 'undefined' ? v.coverUrl || getSleeveDataUrl(v) : '';
                const isSong = v.releaseType === 'Song';

                return (
                  <div
                    key={v.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-[#FAF5EC]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {thumb && (
                        <img
                          src={thumb}
                          alt={v.title}
                          className="h-12 w-12 shrink-0 rounded-lg border border-black/10 object-cover"
                        />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#4A2E1B]/10 px-2 py-0.5 font-mono text-[8.5px] font-semibold text-[#4A2E1B] uppercase">
                            {isSong ? (
                              <Music2 className="h-2.5 w-2.5" />
                            ) : (
                              <Disc3 className="h-2.5 w-2.5" />
                            )}
                            {v.releaseType}
                          </span>
                          <span className="font-mono text-[9.5px] text-[#7A624E]">
                            {v.genre || v.mood}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate font-serif text-lg leading-tight text-[#241A13]">
                          {v.title}
                        </p>
                        <p className="truncate font-mono text-[10px] text-[#6E5B4B]">
                          {v.artist} · {v.releaseYear} ·{' '}
                          {isSong ? v.duration : `${v.tracks?.length || 0} tracks`}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onViewTrackDetails(v)}
                      className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full border border-[#4A2E1B]/20 bg-white px-3.5 py-1.5 font-mono text-[10.5px] font-semibold tracking-wider text-[#3A2213] uppercase transition hover:border-[#4A2E1B] hover:bg-[#4A2E1B] hover:text-[#FAF5EC]"
                    >
                      <span>{isSong ? 'Details' : 'Tracklist'}</span>
                      <ArrowUpRight className="h-3 w-3" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}