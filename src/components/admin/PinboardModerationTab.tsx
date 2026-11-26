'use client';

import React, { useMemo, useState } from 'react';
import {
  Pin,
  PinOff,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Trash2,
  CheckCircle2,
  MessageSquareHeart,
} from 'lucide-react';
import { GuestbookPostcard, MAX_PINBOARD_VISIBLE } from '@/types/orihour';

interface PinboardModerationTabProps {
  postcards: GuestbookPostcard[];
  onTogglePin: (id: string, nextPinned: boolean) => Promise<void>;
  onReorderPinned: (orderedIds: string[]) => Promise<void>;
  onToggleHidden: (id: string, nextHidden: boolean) => Promise<void>;
  onDeletePostcard: (id: string) => Promise<void>;
}

export default function PinboardModerationTab({
  postcards,
  onTogglePin,
  onReorderPinned,
  onToggleHidden,
  onDeletePostcard,
}: PinboardModerationTabProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const visiblePostcards = useMemo(
    () => postcards.filter((p) => !p.isHidden),
    [postcards]
  );

  const pinnedPostcards = useMemo(
    () => visiblePostcards.filter((p) => p.isPinned),
    [visiblePostcards]
  );

  const onBoardIds = useMemo(
    () => new Set(visiblePostcards.slice(0, MAX_PINBOARD_VISIBLE).map((p) => p.id)),
    [visiblePostcards]
  );

  const showToast = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(null), 2800);
  };

  const handleMovePinned = async (id: string, dir: -1 | 1) => {
    const idx = pinnedPostcards.findIndex((p) => p.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= pinnedPostcards.length) return;

    const nextIds = pinnedPostcards.map((p) => p.id);
    const temp = nextIds[idx];
    nextIds[idx] = nextIds[target];
    nextIds[target] = temp;

    setBusyId(id);
    try {
      await onReorderPinned(nextIds);
      showToast('Urutan kartu pos yang di-pin berhasil diperbarui.');
    } finally {
      setBusyId(null);
    }
  };

  const handlePinToggle = async (pc: GuestbookPostcard) => {
    setBusyId(pc.id);
    try {
      await onTogglePin(pc.id, !pc.isPinned);
      showToast(
        !pc.isPinned
          ? `"${pc.songTitle}" dikunci (Pinned) agar tidak tergeser pesan baru.`
          : `"${pc.songTitle}" dilepas dari pin dan kembali mengikuti urutan terbaru.`
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleHideToggle = async (pc: GuestbookPostcard) => {
    setBusyId(pc.id);
    try {
      await onToggleHidden(pc.id, !pc.isHidden);
      showToast(
        !pc.isHidden
          ? `Pesan dari ${pc.senderName} disembunyikan dari publik.`
          : `Pesan dari ${pc.senderName} ditampilkan kembali.`
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (pc: GuestbookPostcard) => {
    if (!window.confirm(`Hapus permanen catatan "${pc.songTitle}" dari ${pc.senderName}?`)) {
      return;
    }
    setBusyId(pc.id);
    try {
      await onDeletePostcard(pc.id);
      showToast(`Catatan dari ${pc.senderName} telah dihapus.`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      {statusMsg && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-700/25 bg-emerald-500/12 px-4 py-3 text-xs font-semibold text-emerald-950">
          <CheckCircle2 className="h-4 w-4 text-emerald-700" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Header & Board Rule Explanation */}
      <div className="rounded-[22px] border border-[#E5D7C3] bg-[#FAF5EC]/85 p-5 shadow-sm backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-[0.16em] text-[#7A5230] uppercase">
              <MessageSquareHeart className="h-3.5 w-3.5" />
              VISITOR PINBOARD MODERATION
            </p>
            <h2 className="mt-1 font-serif text-2xl text-[#241A13]">
              Catatan &amp; Rekomendasi Pengunjung
            </h2>
            <p className="mt-1 text-xs text-[#655040]">
              Maksimal <strong>{MAX_PINBOARD_VISIBLE} catatan teratas</strong> tampil di papan gabus 3D maupun modal Visitor Pinboard. Pesan baru menggeser yang lama kecuali catatan yang di-<strong>Pin</strong> oleh admin.
            </p>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] font-semibold">
            <span className="rounded-full bg-[#4A2E1B]/12 px-3 py-1 text-[#4A2E1B]">
              {pinnedPostcards.length} DI-PIN ADMIN
            </span>
            <span className="rounded-full bg-[#4A2E1B]/8 px-3 py-1 text-[#5C4432]">
              {postcards.length} TOTAL PESAN
            </span>
          </div>
        </div>
      </div>

      {/* Postcards List */}
      {postcards.length === 0 ? (
        <div className="rounded-[22px] border border-[#E5D7C3] bg-[#FAF5EC]/75 p-10 text-center text-sm text-[#735D4B]">
          Belum ada catatan pengunjung yang masuk.
        </div>
      ) : (
        <div className="space-y-3">
          {postcards.map((pc) => {
            const isOnWall = !pc.isHidden && onBoardIds.has(pc.id);
            const pinnedIdx = pinnedPostcards.findIndex((p) => p.id === pc.id);
            const isBusy = busyId === pc.id;

            return (
              <article
                key={pc.id}
                className={`flex flex-col justify-between gap-4 rounded-[22px] border p-4 shadow-xs backdrop-blur-lg transition sm:flex-row sm:items-center ${
                  pc.isHidden
                    ? 'border-[#4A2E1B]/10 bg-white/45 opacity-60'
                    : pc.isPinned
                    ? 'border-[#4A2E1B]/40 bg-white/95'
                    : 'border-[#E5D7C3] bg-[#FAF5EC]/85'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <span
                    className="mt-1 h-4 w-4 shrink-0 rounded-full border-2 border-white shadow-sm"
                    style={{ backgroundColor: pc.pinColor || '#4A2E1B' }}
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {isOnWall && (
                        <span className="rounded-full bg-emerald-600/14 px-2 py-0.5 font-mono text-[9px] font-semibold text-emerald-900 uppercase">
                          TAMPIL DI PAPAN (TOP {MAX_PINBOARD_VISIBLE})
                        </span>
                      )}
                      {pc.isPinned && (
                        <span className="rounded-full bg-[#4A2E1B] px-2 py-0.5 font-mono text-[9px] font-semibold text-[#FAF5EC] uppercase">
                          PINNED #{pinnedIdx + 1}
                        </span>
                      )}
                      {pc.isHidden && (
                        <span className="rounded-full bg-[#4A2E1B]/12 px-2 py-0.5 font-mono text-[9px] font-semibold text-[#5C4432] uppercase">
                          DISEMBUNYIKAN
                        </span>
                      )}
                      <span className="font-mono text-[9.5px] text-[#7D6654]">
                        FROM {pc.senderName.toUpperCase()} · {pc.dateLabel}
                      </span>
                    </div>

                    <h3 className="mt-1 font-serif text-xl leading-tight text-[#241A13]">
                      {pc.songTitle}{' '}
                      <span className="font-sans text-xs font-medium text-[#6E462C] italic">
                        - {pc.artist}
                      </span>
                    </h3>
                    <p className="mt-1 break-words text-xs leading-relaxed text-[#3E3127]">
                      &ldquo;{pc.reason}&rdquo;
                    </p>
                  </div>
                </div>

                {/* Moderation & Manual Reorder Actions */}
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  {pc.isPinned && !pc.isHidden && (
                    <>
                      <button
                        type="button"
                        disabled={isBusy || pinnedIdx <= 0}
                        onClick={() => handleMovePinned(pc.id, -1)}
                        className="cursor-pointer rounded-lg border border-[#4A2E1B]/18 bg-white p-1.5 text-[#4A2E1B] hover:bg-[#F3E9DA] disabled:opacity-30"
                        title="Naikkan urutan pin"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={isBusy || pinnedIdx >= pinnedPostcards.length - 1}
                        onClick={() => handleMovePinned(pc.id, 1)}
                        className="cursor-pointer rounded-lg border border-[#4A2E1B]/18 bg-white p-1.5 text-[#4A2E1B] hover:bg-[#F3E9DA] disabled:opacity-30"
                        title="Turunkan urutan pin"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}

                  {!pc.isHidden && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handlePinToggle(pc)}
                      className={`inline-flex cursor-pointer items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition ${
                        pc.isPinned
                          ? 'border-[#4A2E1B] bg-[#4A2E1B] text-[#FAF5EC] hover:bg-[#3A2213]'
                          : 'border-[#4A2E1B]/18 bg-white text-[#3A2213] hover:border-[#4A2E1B] hover:bg-[#F3E9DA]'
                      }`}
                    >
                      {pc.isPinned ? (
                        <>
                          <PinOff className="h-3 w-3" />
                          <span>Unpin</span>
                        </>
                      ) : (
                        <>
                          <Pin className="h-3 w-3" />
                          <span>Pin</span>
                        </>
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleHideToggle(pc)}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#4A2E1B]/18 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#5C4432] transition hover:bg-[#F3E9DA]"
                    title={pc.isHidden ? 'Tampilkan kembali' : 'Sembunyikan'}
                  >
                    {pc.isHidden ? (
                      <>
                        <Eye className="h-3 w-3" />
                        <span>Tampilkan</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-3 w-3" />
                        <span>Sembunyikan</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleDelete(pc)}
                    className="cursor-pointer rounded-lg border border-[#4A2E1B]/14 bg-white p-1.5 text-[#8A7360] transition hover:border-[#4A2E1B]/35 hover:bg-[#4A2E1B]/10 hover:text-[#4A2E1B]"
                    title="Hapus permanen"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}