'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, X } from 'lucide-react';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'walnut';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Hapus',
  cancelLabel = 'Batal',
  tone = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, busy, onCancel]);

  if (!open || !mounted) return null;

  const isDanger = tone === 'danger';

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-[#18110C]/65 p-4 backdrop-blur-md"
      onClick={() => {
        if (!busy) onCancel();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="orihour-confirm-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-[26px] border border-[#E5D7C3] bg-[#FAF5EC] text-[#241A13] shadow-[0_28px_72px_-16px_rgba(18,12,8,0.62)]"
      >
        {/* Top Accent Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#4A2E1B]/12 bg-[#F3E9DB] px-5 py-4">
          <div className="flex items-center gap-3">
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${
                isDanger
                  ? 'border-[#6E1D2C]/25 bg-[#6E1D2C]/12 text-[#6E1D2C]'
                  : 'border-[#4A2E1B]/20 bg-[#4A2E1B]/12 text-[#4A2E1B]'
              }`}
            >
              {isDanger ? (
                <Trash2 className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
            </span>
            <div>
              <p className="font-mono text-[9.5px] font-semibold tracking-[0.16em] text-[#7A5230] uppercase">
                KONFIRMASI TINDAKAN
              </p>
              <h3
                id="orihour-confirm-title"
                className="font-serif text-xl leading-snug text-[#241A13]"
              >
                {title}
              </h3>
            </div>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[#4A2E1B]/15 bg-[#FAF5EC] text-[#5C4432] transition hover:bg-white hover:text-[#241A13] disabled:opacity-40"
            aria-label="Tutup dialog"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Message Body */}
        <div className="px-5 py-5">
          <p className="text-sm leading-relaxed text-[#46362B]">{description}</p>
        </div>

        {/* Action Footer */}
        <div className="flex items-center justify-end gap-2.5 border-t border-[#4A2E1B]/12 bg-[#F4ECE0]/80 px-5 py-3.5">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="cursor-pointer rounded-xl border border-[#4A2E1B]/20 bg-white px-4 py-2 text-xs font-semibold text-[#4A2E1B] transition hover:bg-[#EFE4D3] disabled:opacity-45"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-[#FAF5EC] shadow-sm transition disabled:opacity-50 ${
              isDanger
                ? 'bg-[#6E1D2C] hover:bg-[#571622]'
                : 'bg-[#4A2E1B] hover:bg-[#3A2213]'
            }`}
          >
            {isDanger && <Trash2 className="h-3.5 w-3.5" />}
            <span>{busy ? 'Memproses...' : confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}