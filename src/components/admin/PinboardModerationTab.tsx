'use client';

import React, { useMemo, useState } from 'react';
import {
  Pin,
  PinOff,
  Trash2,
  Search,
  CheckCircle2,
  CheckSquare,
  Square,
  Clock,
} from 'lucide-react';
import { GuestbookPostcard, MAX_PINBOARD_VISIBLE } from '@/types/orihour';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface PinboardModerationTabProps {
  postcards: GuestbookPostcard[];
  onTogglePin: (id: string, isPinned: boolean) => Promise<void>;
  onDeletePostcard: (id: string) => Promise<void>;
  onBulkDeletePostcards?: (ids: string[]) => Promise<void>;
}

function formatDetailedAdminTimestamp(pc: GuestbookPostcard): string {
  if (pc.createdAt) {
    const d = new Date(pc.createdAt);
    if (!Number.isNaN(d.getTime())) {
      const dateStr = d.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      const timeStr = d.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      return `${dateStr} · ${timeStr}`;
    }
  }
  return pc.dateLabel || '-';
}

export default function PinboardModerationTab({
  postcards,
  onTogglePin,
  onDeletePostcard,
  onBulkDeletePostcards,
}: PinboardModerationTabProps) {
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [confirmState, setConfirmState] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  const showToast = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return postcards;
    return postcards.filter(
      (pc) =>
        pc.songTitle.toLowerCase().includes(q) ||
        pc.artist.toLowerCase().includes(q) ||
        pc.senderName.toLowerCase().includes(q) ||
        pc.reason.toLowerCase().includes(q)
    );
  }, [postcards, query]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((pc) => selectedIds.has(pc.id));

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((pc) => next.delete(pc.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((pc) => next.add(pc.id));
        return next;
      });
    }
  };

  const handleTogglePin = async (pc: GuestbookPostcard) => {
    setBusyId(pc.id);
    try {
      await onTogglePin(pc.id, !pc.isPinned);
      showToast(
        !pc.isPinned
          ? `Kartu pos "${pc.songTitle}" disematkan (PINNED).`
          : `Sematan "${pc.songTitle}" dilepas.`
      );
    } finally {
      setBusyId(null);
    }
  };

  const requestDeleteOne = (pc: GuestbookPostcard) => {
    setConfirmState({
      title: 'Hapus Kartu Pos?',
      description: `Kartu pos "${pc.songTitle}" dari ${pc.senderName} akan dihapus permanen dari pinboard dan database.`,
      confirmLabel: 'Hapus Kartu Pos',
      onConfirm: async () => {
        setBusyId(pc.id);
        try {
          await onDeletePostcard(pc.id);
          setSelectedIds((prev) => {
            const next = new Set(prev);
            next.delete(pc.id);
            return next;
          });
          showToast(`Kartu pos "${pc.songTitle}" dihapus.`);
        } finally {
          setBusyId(null);
          setConfirmState(null);
        }
      },
    });
  };

  const requestBulkDelete = () => {
    const ids = Array.from(selectedIds).filter((id) =>
      postcards.some((pc) => pc.id === id)
    );
    if (ids.length === 0) return;

    setConfirmState({
      title: `Hapus ${ids.length} Kartu Pos Terpilih?`,
      description: `Sebanyak ${ids.length} kartu pos yang kamu ceklis akan dihapus secara permanen dan tidak bisa dikembalikan.`,
      confirmLabel: `Hapus (${ids.length})`,
      onConfirm: async () => {
        setBulkDeleting(true);
        try {
          if (onBulkDeletePostcards) {
            await onBulkDeletePostcards(ids);
          } else {
            for (const id of ids) {
              await onDeletePostcard(id);
            }
          }
          setSelectedIds(new Set());
          showToast(`${ids.length} kartu pos berhasil dihapus.`);
        } finally {
          setBulkDeleting(false);
          setConfirmState(null);
        }
      },
    });
  };

  return (
    <div className="space-y-5">
      {feedback && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-700/25 bg-emerald-500/12 px-4 py-3 text-xs font-semibold text-emerald-950">
          <CheckCircle2 className="h-4 w-4 text-emerald-700" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Header + Search + Bulk Delete Toolbar */}
      <section className="space-y-3 rounded-[24px] border border-[#E5D7C3] bg-[#FAF5EC]/88 p-5 shadow-sm backdrop-blur-xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-[0.16em] text-[#7A5230] uppercase">
              <Pin className="h-3.5 w-3.5" />
              MODERASI VISITOR PINBOARD ({postcards.length} KARTU POS)
            </p>
            <h2 className="mt-1 font-serif text-2xl text-[#241A13]">
              Kelola Kartu Pos Pengunjung
            </h2>
            <p className="mt-0.5 text-xs text-[#655040]">
              Maksimal {MAX_PINBOARD_VISIBLE} kartu pos tampil di papan gabus 3D (kartu yang di-PIN selalu diprioritaskan). Timestamp lengkap hanya terlihat di panel admin ini.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-[#4A2E1B]/10 pt-3">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#7A624E]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari lagu, artis, pengirim, atau catatan..."
              className="w-full rounded-xl border border-[#4A2E1B]/18 bg-white py-2 pr-3 pl-9 text-xs text-[#241A13] placeholder-[#9B8776] outline-none focus:border-[#4A2E1B]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {filtered.length > 0 && (
              <button
                type="button"
                onClick={toggleSelectAll}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#4A2E1B]/20 bg-white px-3 py-1.5 text-xs font-semibold text-[#4A2E1B] transition hover:bg-[#EFE4D3]"
              >
                {allFilteredSelected ? (
                  <CheckSquare className="h-3.5 w-3.5" />
                ) : (
                  <Square className="h-3.5 w-3.5" />
                )}
                <span>{allFilteredSelected ? 'Batal Pilih Semua' : 'Pilih Semua'}</span>
              </button>
            )}

            {selectedIds.size > 0 && (
              <button
                type="button"
                disabled={bulkDeleting}
                onClick={requestBulkDelete}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#6E1D2C] px-3.5 py-1.5 text-xs font-semibold text-[#FAF5EC] shadow-sm transition hover:bg-[#571622] disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>
                  {bulkDeleting ? 'Menghapus...' : `Hapus Terpilih (${selectedIds.size})`}
                </span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Postcards List with Detailed Admin Timestamp */}
      {filtered.length === 0 ? (
        <div className="rounded-[22px] border border-[#E5D7C3] bg-[#FAF5EC]/80 p-10 text-center font-mono text-xs text-[#7A624E]">
          Belum ada kartu pos yang cocok.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {filtered.map((pc) => {
            const isSelected = selectedIds.has(pc.id);
            const resolvedColor =
              pc.pinColor && pc.pinColor.toUpperCase() !== '#D94E28'
                ? pc.pinColor
                : '#4A2E1B';

            return (
              <article
                key={pc.id}
                className={`flex flex-col justify-between rounded-[22px] border p-4 shadow-xs transition ${
                  isSelected
                    ? 'border-[#4A2E1B] bg-[#F3E8D7]/85 ring-1 ring-[#4A2E1B]/25'
                    : 'border-[#E5D7C3] bg-[#FAF5EC]/88 hover:bg-white/95'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOne(pc.id)}
                        aria-label={`Pilih kartu pos ${pc.songTitle}`}
                        className="mt-1.5 h-4 w-4 shrink-0 cursor-pointer accent-[#4A2E1B]"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: resolvedColor }}
                          />
                          <h3 className="truncate font-serif text-xl leading-tight text-[#241A13]">
                            {pc.songTitle}
                          </h3>
                        </div>
                        <p className="truncate text-xs font-medium text-[#6E462C] italic">
                          by {pc.artist}
                        </p>
                      </div>
                    </div>

                    {pc.isPinned && (
                      <span className="shrink-0 rounded-full bg-[#4A2E1B] px-2 py-0.5 font-mono text-[9px] font-semibold text-[#FAF5EC] uppercase">
                        PINNED
                      </span>
                    )}
                  </div>

                  <p className="mt-3 rounded-xl border border-[#4A2E1B]/10 bg-white/80 p-3 text-xs leading-relaxed text-[#352E28] break-words">
                    &ldquo;{pc.reason}&rdquo;
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#4A2E1B]/10 pt-3">
                  <div className="min-w-0 space-y-0.5 font-mono text-[10px] text-[#7A624E]">
                    <div className="font-semibold text-[#3A2213] uppercase">
                      FROM: {pc.senderName}
                    </div>
                    <div className="inline-flex items-center gap-1 text-[9.5px] text-[#7A5230]">
                      <Clock className="h-3 w-3 shrink-0" />
                      <span>{formatDetailedAdminTimestamp(pc)}</span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      disabled={busyId === pc.id || bulkDeleting}
                      onClick={() => handleTogglePin(pc)}
                      className={`inline-flex cursor-pointer items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition disabled:opacity-50 ${
                        pc.isPinned
                          ? 'border-[#4A2E1B] bg-[#4A2E1B] text-[#FAF5EC] hover:bg-[#3A2213]'
                          : 'border-[#4A2E1B]/20 bg-white text-[#4A2E1B] hover:bg-[#EFE4D3]'
                      }`}
                    >
                      {pc.isPinned ? (
                        <>
                          <PinOff className="h-3 w-3" />
                          <span>Lepas Pin</span>
                        </>
                      ) : (
                        <>
                          <Pin className="h-3 w-3" />
                          <span>Pin</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={busyId === pc.id || bulkDeleting}
                      onClick={() => requestDeleteOne(pc)}
                      className="cursor-pointer rounded-lg border border-[#4A2E1B]/15 bg-white p-1.5 text-[#8A7360] transition hover:border-[#6E1D2C]/40 hover:bg-[#6E1D2C]/10 hover:text-[#6E1D2C] disabled:opacity-50"
                      title="Hapus kartu pos ini"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Orihour-Themed Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(confirmState)}
        title={confirmState?.title || ''}
        description={confirmState?.description || ''}
        confirmLabel={confirmState?.confirmLabel || 'Hapus'}
        busy={bulkDeleting || busyId !== null}
        onCancel={() => setConfirmState(null)}
        onConfirm={() => {
          if (confirmState) void confirmState.onConfirm();
        }}
      />
    </div>
  );
}