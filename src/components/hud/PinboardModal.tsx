'use client';

import React, { useEffect, useState } from 'react';
import { X, Pin, Send, Sparkles, AlertCircle } from 'lucide-react';
import {
  GuestbookPostcard,
  MAX_PINBOARD_VISIBLE,
  POSTCARD_LIMITS,
} from '@/types/orihour';

export interface PostcardSubmissionPayload
  extends Omit<GuestbookPostcard, 'id' | 'dateLabel'> {
  website?: string;
  formLoadedAt?: number;
}

interface PinboardModalProps {
  open: boolean;
  postcards: GuestbookPostcard[];
  onAddPostcard: (entry: PostcardSubmissionPayload) => Promise<void> | void;
  onClose: () => void;
}

const PIN_COLORS = [
  { hex: '#4A2E1B', name: 'Espresso' },
  { hex: '#7A5230', name: 'Walnut' },
  { hex: '#C89B54', name: 'Brass' },
  { hex: '#0D9488', name: 'Teal' },
  { hex: '#2563EB', name: 'Cobalt' },
];

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
  const [pinColor, setPinColor] = useState(PIN_COLORS[0].hex);
  const [honeypot, setHoneypot] = useState('');
  const [formLoadedAt, setFormLoadedAt] = useState<number>(() => Date.now());

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [justPinned, setJustPinned] = useState(false);

  useEffect(() => {
    if (open) {
      setFormLoadedAt(Date.now());
      setErrorMsg(null);
    }
  }, [open]);

  if (!open) return null;

  const visiblePostcards = postcards.slice(0, MAX_PINBOARD_VISIBLE);

  const canSubmit =
    !submitting &&
    songTitle.trim().length > 0 &&
    artist.trim().length > 0 &&
    senderName.trim().length > 0 &&
    reason.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setErrorMsg(null);
    try {
      await onAddPostcard({
        songTitle: songTitle.trim().slice(0, POSTCARD_LIMITS.songTitle),
        artist: artist.trim().slice(0, POSTCARD_LIMITS.artist),
        senderName: senderName.trim().slice(0, POSTCARD_LIMITS.senderName),
        reason: reason.trim().slice(0, POSTCARD_LIMITS.reason),
        pinColor,
        website: honeypot,
        formLoadedAt,
      });

      setSongTitle('');
      setArtist('');
      setSenderName('');
      setReason('');
      setHoneypot('');
      setFormLoadedAt(Date.now());
      setJustPinned(true);
      setTimeout(() => setJustPinned(false), 2800);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal mengirim kartu pos.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#18110C]/58 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-[26px] border border-[#E5D7C3] bg-[#FAF5EC]/95 text-[#241A13] shadow-[0_32px_90px_-20px_rgba(12,8,6,0.58),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#4A2E1B]/12 bg-[#F4ECE0]/85 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#4A2E1B]/12 text-[#4A2E1B]">
              <Pin className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-serif text-2xl leading-none text-[#241A13]">
                Visitor Pinboard
              </h2>
              <p className="mt-0.5 font-mono text-[10px] tracking-[0.14em] text-[#7A624E] uppercase">
                SONG RECOMMENDATIONS · {visiblePostcards.length}/{MAX_PINBOARD_VISIBLE} ACTIVE POSTCARDS ON BOARD
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[#4A2E1B]/15 bg-white/80 text-[#4A2E1B] transition hover:bg-white"
            aria-label="Close pinboard"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="orihour-scroll grid flex-1 grid-cols-1 gap-6 overflow-x-hidden overflow-y-auto p-5 sm:p-6 lg:grid-cols-12">
          {/* Left: Submission Form */}
          <form
            onSubmit={handleSubmit}
            className="flex min-w-0 flex-col gap-3.5 rounded-2xl border border-[#4A2E1B]/12 bg-white/85 p-5 lg:col-span-5"
          >
            <div>
              <p className="font-mono text-[10px] font-semibold tracking-[0.16em] text-[#7A5230] uppercase">
                LEAVE A POSTCARD
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[#655040]">
                Recommend a track for this room. Up to {MAX_PINBOARD_VISIBLE} latest or pinned postcards are displayed on the wall.
              </p>
            </div>

            {/* Invisible anti-bot honeypot field */}
            <div aria-hidden="true" className="hidden">
              <label>
                Website
                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </label>
            </div>

            {errorMsg && (
              <div className="flex items-center gap-2 rounded-xl border border-[#4A2E1B]/25 bg-[#4A2E1B]/10 px-3 py-2 text-xs text-[#3A2213]">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <label className="block">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-semibold tracking-wider text-[#5C4432] uppercase">
                  Song Title *
                </span>
                <span className="font-mono text-[9.5px] text-[#8C7765]">
                  {songTitle.length}/{POSTCARD_LIMITS.songTitle}
                </span>
              </div>
              <input
                type="text"
                required
                maxLength={POSTCARD_LIMITS.songTitle}
                value={songTitle}
                onChange={(e) => setSongTitle(e.target.value)}
                placeholder="e.g. Apocalypse"
                className="mt-1 w-full rounded-xl border border-[#4A2E1B]/18 bg-white px-3.5 py-2 text-sm text-[#241A13] placeholder-[#9B8776] outline-none transition focus:border-[#4A2E1B]"
              />
            </label>

            <label className="block">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-semibold tracking-wider text-[#5C4432] uppercase">
                  Artist *
                </span>
                <span className="font-mono text-[9.5px] text-[#8C7765]">
                  {artist.length}/{POSTCARD_LIMITS.artist}
                </span>
              </div>
              <input
                type="text"
                required
                maxLength={POSTCARD_LIMITS.artist}
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="e.g. Cigarettes After Sex"
                className="mt-1 w-full rounded-xl border border-[#4A2E1B]/18 bg-white px-3.5 py-2 text-sm text-[#241A13] placeholder-[#9B8776] outline-none transition focus:border-[#4A2E1B]"
              />
            </label>

            <label className="block">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-semibold tracking-wider text-[#5C4432] uppercase">
                  Your Name *
                </span>
                <span className="font-mono text-[9.5px] text-[#8C7765]">
                  {senderName.length}/{POSTCARD_LIMITS.senderName}
                </span>
              </div>
              <input
                type="text"
                required
                maxLength={POSTCARD_LIMITS.senderName}
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="e.g. Alex"
                className="mt-1 w-full rounded-xl border border-[#4A2E1B]/18 bg-white px-3.5 py-2 text-sm text-[#241A13] placeholder-[#9B8776] outline-none transition focus:border-[#4A2E1B]"
              />
            </label>

            <label className="block">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-semibold tracking-wider text-[#5C4432] uppercase">
                  Why this song? *
                </span>
                <span
                  className={`font-mono text-[9.5px] ${
                    reason.length >= POSTCARD_LIMITS.reason - 12
                      ? 'font-semibold text-[#7A5230]'
                      : 'text-[#8C7765]'
                  }`}
                >
                  {reason.length}/{POSTCARD_LIMITS.reason}
                </span>
              </div>
              <textarea
                required
                rows={3}
                maxLength={POSTCARD_LIMITS.reason}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Short note on the mood or memory (max 110 chars)..."
                className="orihour-scroll mt-1 w-full resize-none rounded-xl border border-[#4A2E1B]/18 bg-white px-3.5 py-2 text-sm text-[#241A13] placeholder-[#9B8776] outline-none transition focus:border-[#4A2E1B]"
              />
            </label>

            <div>
              <span className="font-mono text-[10px] font-semibold tracking-wider text-[#5C4432] uppercase">
                Pushpin Color
              </span>
              <div className="mt-1.5 flex items-center gap-2">
                {PIN_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setPinColor(c.hex)}
                    aria-label={c.name}
                    className={`h-6 w-6 cursor-pointer rounded-full border-2 transition ${
                      pinColor === c.hex ? 'scale-115 border-[#241A13]' : 'border-white shadow-xs'
                    }`}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="mt-1 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#4A2E1B] px-4 py-2.5 font-sans text-sm font-semibold text-[#FAF5EC] shadow-md transition hover:bg-[#3A2213] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{submitting ? 'Pinning...' : 'Pin Postcard to Wall'}</span>
            </button>

            {justPinned && (
              <p className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-emerald-700">
                <Sparkles className="h-3.5 w-3.5" />
                Pinned to the 3D corkboard!
              </p>
            )}
          </form>

          {/* Right: Corkboard Display Grid (Cleanly padded & boxed so right-edge cards never clip) */}
          <div className="min-w-0 rounded-2xl border border-[#7A5634]/25 bg-[#C29768]/22 p-5 lg:col-span-7">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {visiblePostcards.map((pc) => {
                const resolvedPinColor =
                  pc.pinColor && pc.pinColor.toUpperCase() !== '#D94E28'
                    ? pc.pinColor
                    : '#4A2E1B';

                return (
                  <article
                    key={pc.id}
                    className="relative flex min-w-0 flex-col justify-between rounded-xl border border-[#6E462C]/22 bg-[#FAF3E3] p-4 pt-5 shadow-[0_10px_24px_-12px_rgba(32,20,10,0.45)] transition hover:-translate-y-0.5"
                  >
                    <span
                      className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-white/85 shadow-sm"
                      style={{ backgroundColor: resolvedPinColor }}
                    />

                    <div className="min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate font-serif text-lg leading-tight text-[#241A13]">
                            {pc.songTitle}
                          </h3>
                          <p className="truncate text-xs font-medium text-[#6E462C] italic">
                            by {pc.artist}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[8.5px] font-semibold ${
                            pc.isPinned
                              ? 'border-[#4A2E1B]/40 bg-[#4A2E1B]/10 text-[#4A2E1B]'
                              : 'border-[#6E462C]/25 text-[#7A624E]'
                          }`}
                        >
                          {pc.isPinned ? 'PINNED' : 'POST'}
                        </span>
                      </div>

                      <p className="mt-2.5 line-clamp-4 break-words border-t border-dashed border-[#6E462C]/20 pt-2.5 text-xs leading-relaxed text-[#352E28] [overflow-wrap:anywhere]">
                        &ldquo;{pc.reason}&rdquo;
                      </p>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2 font-mono text-[9.5px] font-semibold tracking-wider text-[#7A6858] uppercase">
                      <span className="truncate">FROM {pc.senderName}</span>
                      <span className="shrink-0">{pc.dateLabel}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}