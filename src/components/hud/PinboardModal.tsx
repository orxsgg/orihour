'use client';

import React, { useState } from 'react';
import { X, Pin, Send, Sparkles, Calendar } from 'lucide-react';
import {
  GuestbookPostcard,
  MAX_PINBOARD_VISIBLE,
  POSTCARD_LIMITS,
} from '@/types/orihour';

export interface PostcardSubmissionPayload {
  songTitle: string;
  artist: string;
  senderName: string;
  reason: string;
  pinColor: string;
}

interface PinboardModalProps {
  open: boolean;
  postcards: GuestbookPostcard[];
  onAddPostcard: (entry: PostcardSubmissionPayload) => Promise<void>;
  onClose: () => void;
}

// Warm cohesive Orihour palette (walnut, burgundy, brass, sienna, olive, charcoal — zero teal/blue)
const PIN_COLOR_OPTIONS = [
  { hex: '#4A2E1B', label: 'Espresso' },
  { hex: '#6E1D2C', label: 'Burgundy' },
  { hex: '#B88F52', label: 'Antique Brass' },
  { hex: '#8C4A27', label: 'Sienna Clay' },
  { hex: '#5B633A', label: 'Vintage Olive' },
  { hex: '#3D352E', label: 'Smoked Charcoal' },
];

function formatDateOnly(card: GuestbookPostcard): string {
  if (card.createdAt) {
    const d = new Date(card.createdAt);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    }
  }
  return card.dateLabel || '-';
}

export default function PinboardModal({
  open,
  postcards,
  onAddPostcard,
  onClose,
}: PinboardModalProps) {
  const [songTitle, setSongTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [senderName, setSenderName] = useState('');
  const [reason, setReason] = useState('');
  const [pinColor, setPinColor] = useState(PIN_COLOR_OPTIONS[0].hex);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanSong = songTitle.trim();
    const cleanArtist = artist.trim();
    const cleanSender = senderName.trim();
    const cleanReason = reason.trim();

    if (!cleanSong || !cleanArtist || !cleanSender || !cleanReason) {
      setErrorMsg('Lengkapi judul lagu, artis, nama pengirim, dan pesan singkatmu.');
      return;
    }

    setSubmitting(true);
    try {
      await onAddPostcard({
        songTitle: cleanSong.slice(0, POSTCARD_LIMITS.songTitle),
        artist: cleanArtist.slice(0, POSTCARD_LIMITS.artist),
        senderName: cleanSender.slice(0, POSTCARD_LIMITS.senderName),
        reason: cleanReason.slice(0, POSTCARD_LIMITS.reason),
        pinColor,
      });

      setSongTitle('');
      setArtist('');
      setSenderName('');
      setReason('');
      setSuccessMsg('Kartu pos berhasil ditempel ke papan gabus ruangan!');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal mengirim kartu pos. Coba lagi.'
      );
    } finally {
      setSubmitting(false);
    }
  };

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
              <Pin className="h-3.5 w-3.5" />
              VISITOR SONG PINBOARD · {postcards.length}/{MAX_PINBOARD_VISIBLE} ON BOARD
            </p>
            <h2 className="mt-0.5 font-serif text-2xl text-[#241A13]">
              Pin a Song Postcard
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-[#4A2E1B]/18 bg-[#FAF5EC] text-[#4A2E1B] transition hover:bg-white"
            aria-label="Close pinboard"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Body */}
        <div className="orihour-scroll grid flex-1 grid-cols-1 gap-6 overflow-y-auto p-6 lg:grid-cols-12">
          {/* Left: Submission Form */}
          <form
            onSubmit={handleSubmit}
            className="space-y-3.5 rounded-[22px] border border-[#4A2E1B]/14 bg-white/85 p-5 lg:col-span-5"
          >
            <div>
              <p className="font-mono text-[10px] font-semibold tracking-[0.14em] text-[#7A5230] uppercase">
                LEAVE A RECOMMENDATION
              </p>
              <p className="mt-1 text-xs text-[#655040]">
                Rekomendasikan satu lagu favoritmu untuk ditempel langsung di papan gabus 3D Orihour.
              </p>
            </div>

            {errorMsg && (
              <div className="rounded-xl border border-[#6E1D2C]/25 bg-[#6E1D2C]/10 px-3 py-2 text-xs font-medium text-[#571622]">
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="inline-flex w-full items-center gap-1.5 rounded-xl border border-emerald-700/25 bg-emerald-500/12 px-3 py-2 text-xs font-medium text-emerald-950">
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-emerald-700" />
                <span>{successMsg}</span>
              </div>
            )}

            <label className="block">
              <span className="font-mono text-[10px] font-semibold tracking-wider text-[#5C4432] uppercase">
                Song Title *
              </span>
              <input
                type="text"
                required
                maxLength={POSTCARD_LIMITS.songTitle}
                value={songTitle}
                onChange={(e) => setSongTitle(e.target.value)}
                placeholder="e.g. Apocalypse"
                className="mt-1 w-full rounded-xl border border-[#4A2E1B]/18 bg-[#FAF5EC]/70 px-3 py-2 text-sm text-[#241A13] placeholder-[#9B8776] outline-none focus:border-[#4A2E1B] focus:bg-white"
              />
            </label>

            <label className="block">
              <span className="font-mono text-[10px] font-semibold tracking-wider text-[#5C4432] uppercase">
                Artist *
              </span>
              <input
                type="text"
                required
                maxLength={POSTCARD_LIMITS.artist}
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="e.g. Cigarettes After Sex"
                className="mt-1 w-full rounded-xl border border-[#4A2E1B]/18 bg-[#FAF5EC]/70 px-3 py-2 text-sm text-[#241A13] placeholder-[#9B8776] outline-none focus:border-[#4A2E1B] focus:bg-white"
              />
            </label>

            <label className="block">
              <span className="font-mono text-[10px] font-semibold tracking-wider text-[#5C4432] uppercase">
                Your Name *
              </span>
              <input
                type="text"
                required
                maxLength={POSTCARD_LIMITS.senderName}
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="e.g. Naya"
                className="mt-1 w-full rounded-xl border border-[#4A2E1B]/18 bg-[#FAF5EC]/70 px-3 py-2 text-sm text-[#241A13] placeholder-[#9B8776] outline-none focus:border-[#4A2E1B] focus:bg-white"
              />
            </label>

            <label className="block">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-semibold tracking-wider text-[#5C4432] uppercase">
                  Short Note *
                </span>
                <span className="font-mono text-[9.5px] text-[#8A7360]">
                  {reason.length}/{POSTCARD_LIMITS.reason}
                </span>
              </div>
              <textarea
                rows={3}
                required
                maxLength={POSTCARD_LIMITS.reason}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Kenapa lagu ini cocok diputar di ruangan ini?"
                className="mt-1 w-full resize-none rounded-xl border border-[#4A2E1B]/18 bg-[#FAF5EC]/70 px-3 py-2 text-xs leading-relaxed text-[#241A13] placeholder-[#9B8776] outline-none focus:border-[#4A2E1B] focus:bg-white"
              />
            </label>

            {/* Cohesive Warm Orihour Pushpin Swatches */}
            <div>
              <span className="font-mono text-[10px] font-semibold tracking-wider text-[#5C4432] uppercase">
                Pushpin Color
              </span>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {PIN_COLOR_OPTIONS.map((opt) => {
                  const active = pinColor === opt.hex;
                  return (
                    <button
                      key={opt.hex}
                      type="button"
                      onClick={() => setPinColor(opt.hex)}
                      title={opt.label}
                      className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-2 transition ${
                        active
                          ? 'scale-110 border-[#241A13] ring-2 ring-[#C89B54]/45'
                          : 'border-white shadow-xs hover:scale-105'
                      }`}
                      style={{ backgroundColor: opt.hex }}
                    >
                      {active && <span className="h-2 w-2 rounded-full bg-[#FAF5EC]" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#4A2E1B] px-4 py-2.5 text-xs font-semibold text-[#FAF5EC] shadow-md transition hover:bg-[#3A2213] disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{submitting ? 'Pinning...' : 'Pin Postcard to Board'}</span>
            </button>
          </form>

          {/* Right: Pinned Postcards Feed (Date Only — No Clock Timestamp) */}
          <div className="space-y-3 lg:col-span-7">
            <p className="font-mono text-[10px] font-semibold tracking-[0.14em] text-[#7A5230] uppercase">
              CURRENTLY ON THE CORKBOARD ({postcards.length})
            </p>

            {postcards.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#4A2E1B]/20 bg-white/60 py-14 text-center font-mono text-xs text-[#8A7360]">
                Belum ada kartu pos yang tertempel. Jadilah yang pertama!
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {postcards.map((card) => {
                  const resolvedColor =
                    card.pinColor && card.pinColor.toUpperCase() !== '#D94E28'
                      ? card.pinColor
                      : '#4A2E1B';

                  return (
                    <article
                      key={card.id}
                      className="relative flex flex-col justify-between rounded-2xl border border-[#E5D7C3] bg-[#FFFDF8] p-4 shadow-xs"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full shadow-xs"
                              style={{ backgroundColor: resolvedColor }}
                            />
                            <h3 className="truncate font-serif text-lg leading-tight text-[#241A13]">
                              {card.songTitle}
                            </h3>
                          </div>
                          {card.isPinned && (
                            <span className="shrink-0 rounded-full bg-[#4A2E1B] px-2 py-0.5 font-mono text-[8.5px] font-semibold text-[#FAF5EC] uppercase">
                              PINNED
                            </span>
                          )}
                        </div>

                        <p className="mt-0.5 truncate text-xs font-medium text-[#6E462C] italic">
                          by {card.artist}
                        </p>

                        <p className="mt-2.5 text-xs leading-relaxed text-[#3A2E25] break-words">
                          &ldquo;{card.reason}&rdquo;
                        </p>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#4A2E1B]/10 pt-2.5 font-mono text-[9.5px] text-[#7A624E]">
                        <span className="truncate font-semibold text-[#4A2E1B] uppercase">
                          {card.senderName}
                        </span>
                        <span className="inline-flex shrink-0 items-center gap-1 uppercase">
                          <Calendar className="h-2.5 w-2.5 text-[#9A7A5A]" />
                          {formatDateOnly(card)}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}