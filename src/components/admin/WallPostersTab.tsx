'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Upload,
  Save,
  Trash2,
  CheckCircle2,
  Frame,
  Image as ImageIcon,
  CheckSquare,
  Square,
} from 'lucide-react';
import { PosterItem } from '@/types/orihour';
import { ProcessedImageResult } from '@/lib/imageProcessor';
import { uploadMediaToSupabase } from '@/lib/supabase/storage';
import ThemedDropdown, { DropdownOption } from '@/components/ui/ThemedDropdown';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import ImageCropEnhanceModal from './ImageCropEnhanceModal';

interface WallPostersTabProps {
  posters: PosterItem[];
  onUpdatePoster: (poster: PosterItem) => Promise<void>;
}

const SLOT_LOCATIONS = [
  'Slot 1 · Dinding Kiri (Depan)',
  'Slot 2 · Dinding Kiri (Belakang)',
  'Slot 3 · Dinding Kanan (Tepi Jendela)',
  'Slot 4 · Dinding Belakang',
];

const ACCENT_SWATCHES = [
  '#4A2E1B',
  '#6E1D2C',
  '#7A5230',
  '#8A6A38',
  '#5B633A',
  '#334155',
];

const POSTER_STYLE_OPTIONS: DropdownOption[] = [
  { value: '0', label: 'Orbital' },
  { value: '1', label: 'Wave' },
  { value: '2', label: 'Grooves' },
  { value: '3', label: 'Minimal' },
];

export default function WallPostersTab({
  posters,
  onUpdatePoster,
}: WallPostersTabProps) {
  const [drafts, setDrafts] = useState<PosterItem[]>(posters);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [cropTarget, setCropTarget] = useState<{ posterId: string; file: File } | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    setDrafts(posters);
  }, [posters]);

  const showToast = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(null), 3200);
  };

  const updateDraft = (id: string, patch: Partial<PosterItem>) => {
    setDrafts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const allSelected = drafts.length > 0 && selectedIds.size === drafts.length;

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(drafts.map((p) => p.id)));
  };

  const executeBulkClearImages = async () => {
    const targets = drafts.filter((p) => selectedIds.has(p.id));
    if (targets.length === 0) {
      setConfirmOpen(false);
      return;
    }

    setBulkBusy(true);
    try {
      for (const poster of targets) {
        const cleared = { ...poster, imageUrl: '' };
        await onUpdatePoster(cleared);
      }
      setDrafts((prev) =>
        prev.map((p) => (selectedIds.has(p.id) ? { ...p, imageUrl: '' } : p))
      );
      setSelectedIds(new Set());
      showToast(`Gambar pada ${targets.length} poster berhasil dihapus dan disimpan.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menghapus gambar poster.');
    } finally {
      setBulkBusy(false);
      setConfirmOpen(false);
    }
  };

  const handleConfirmCrop = async (result: ProcessedImageResult) => {
    if (!cropTarget) return;
    const { posterId } = cropTarget;
    const poster = drafts.find((p) => p.id === posterId);
    setCropTarget(null);
    setUploadingId(posterId);

    try {
      const publicUrl = await uploadMediaToSupabase(
        result.blob,
        'posters',
        poster?.title || posterId,
        'jpg'
      );
      updateDraft(posterId, { imageUrl: publicUrl });
      showToast(
        result.wasUpscaled
          ? `Poster di-upload (${result.width}×${result.height}px, Auto-Enhanced). Klik Simpan untuk menerapkan.`
          : `Poster HD di-upload (${result.width}×${result.height}px). Klik Simpan untuk menerapkan.`
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal mengupload gambar poster.');
    } finally {
      setUploadingId(null);
    }
  };

  const handleSave = async (poster: PosterItem) => {
    setSavingId(poster.id);
    try {
      await onUpdatePoster(poster);
      showToast(`Poster "${poster.title}" berhasil disimpan ke dinding 3D.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menyimpan poster.');
    } finally {
      setSavingId(null);
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

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[22px] border border-[#E5D7C3] bg-[#FAF5EC]/85 p-5 shadow-sm backdrop-blur-xl">
        <div>
          <p className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-[0.16em] text-[#7A5230] uppercase">
            <Frame className="h-3.5 w-3.5" />
            4 BINGKAI POSTER DINDING 3D
          </p>
          <h2 className="mt-1 font-serif text-2xl text-[#241A13]">
            Atur Konten Poster Dinding
          </h2>
          <p className="mt-1 text-xs text-[#655040]">
            Upload gambar poster (portrait 768×1050 px) atau ceklis beberapa bingkai untuk menghapus gambarnya sekaligus.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleSelectAll}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#4A2E1B]/20 bg-white px-3 py-1.5 text-xs font-semibold text-[#4A2E1B] transition hover:bg-[#EFE4D3]"
          >
            {allSelected ? (
              <CheckSquare className="h-3.5 w-3.5" />
            ) : (
              <Square className="h-3.5 w-3.5" />
            )}
            <span>{allSelected ? 'Batal Pilih Semua' : 'Pilih Semua'}</span>
          </button>

          {selectedIds.size > 0 && (
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => setConfirmOpen(true)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#6E1D2C] px-3.5 py-1.5 text-xs font-semibold text-[#FAF5EC] shadow-sm transition hover:bg-[#571622] disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>
                {bulkBusy
                  ? 'Menghapus...'
                  : `Hapus Gambar Terpilih (${selectedIds.size})`}
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {drafts.map((poster, idx) => {
          const checked = selectedIds.has(poster.id);
          return (
            <article
              key={poster.id}
              className={`flex flex-col gap-4 rounded-[24px] border p-5 shadow-xs backdrop-blur-xl transition sm:flex-row ${
                checked
                  ? 'border-[#4A2E1B] bg-[#F3E8D7]/85 ring-1 ring-[#4A2E1B]/25'
                  : 'border-[#E5D7C3] bg-[#FAF5EC]/85'
              }`}
            >
              {/* Portrait Poster Preview */}
              <div className="flex shrink-0 flex-col items-center gap-2.5">
                <div className="relative h-48 w-36 overflow-hidden rounded-xl border-4 border-[#3D2719] bg-[#F5F0E6] shadow-md">
                  {poster.imageUrl ? (
                    <img
                      src={poster.imageUrl}
                      alt={poster.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col p-2.5">
                      <div
                        className="flex flex-1 items-center justify-center rounded-md text-white/70"
                        style={{
                          background: `linear-gradient(135deg, ${poster.accentColor}, #111827)`,
                        }}
                      >
                        <ImageIcon className="h-6 w-6" />
                      </div>
                      <p className="mt-2 truncate font-serif text-[11px] font-bold text-[#18181B]">
                        {poster.title}
                      </p>
                      <p className="truncate font-mono text-[7px] text-[#64748B]">
                        {poster.subtitle}
                      </p>
                    </div>
                  )}
                </div>

                <input
                  ref={(el) => {
                    fileInputRefs.current[poster.id] = el;
                  }}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) setCropTarget({ posterId: poster.id, file: f });
                  }}
                />

                <div className="flex w-36 items-center gap-1.5">
                  <button
                    type="button"
                    disabled={uploadingId === poster.id || bulkBusy}
                    onClick={() => fileInputRefs.current[poster.id]?.click()}
                    className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg bg-[#4A2E1B] px-2.5 py-1.5 text-[11px] font-semibold text-[#FAF5EC] transition hover:bg-[#3A2213] disabled:opacity-50"
                  >
                    <Upload className="h-3 w-3" />
                    <span>{uploadingId === poster.id ? 'Upload...' : 'Gambar'}</span>
                  </button>
                  {poster.imageUrl && (
                    <button
                      type="button"
                      onClick={() => updateDraft(poster.id, { imageUrl: '' })}
                      className="cursor-pointer rounded-lg border border-[#4A2E1B]/18 bg-white p-1.5 text-[#7A624E] hover:text-[#6E1D2C]"
                      title="Hapus gambar, gunakan tipografi default"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Poster Metadata Form */}
              <div className="flex flex-1 flex-col justify-between gap-3">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-block rounded-full bg-[#4A2E1B]/10 px-2.5 py-0.5 font-mono text-[9.5px] font-semibold text-[#4A2E1B] uppercase">
                      {SLOT_LOCATIONS[idx] || `Slot ${idx + 1}`}
                    </span>

                    <label className="inline-flex cursor-pointer items-center gap-1.5 font-mono text-[10px] font-semibold text-[#5C4432]">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSelectOne(poster.id)}
                        className="h-3.5 w-3.5 cursor-pointer accent-[#4A2E1B]"
                      />
                      <span>Pilih</span>
                    </label>
                  </div>

                  <label className="block">
                    <span className="font-mono text-[9.5px] font-semibold tracking-wider text-[#5C4432] uppercase">
                      Judul Poster
                    </span>
                    <input
                      type="text"
                      value={poster.title}
                      onChange={(e) => updateDraft(poster.id, { title: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-[#4A2E1B]/18 bg-white px-3 py-1.5 text-sm text-[#241A13] outline-none focus:border-[#4A2E1B]"
                    />
                  </label>

                  <label className="block">
                    <span className="font-mono text-[9.5px] font-semibold tracking-wider text-[#5C4432] uppercase">
                      Subjudul / Keterangan
                    </span>
                    <input
                      type="text"
                      value={poster.subtitle}
                      onChange={(e) => updateDraft(poster.id, { subtitle: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-[#4A2E1B]/18 bg-white px-3 py-1.5 text-xs text-[#241A13] outline-none focus:border-[#4A2E1B]"
                    />
                  </label>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <div>
                      <span className="block font-mono text-[9.5px] font-semibold tracking-wider text-[#5C4432] uppercase">
                        Aksen Fallback
                      </span>
                      <div className="mt-1 flex items-center gap-1.5">
                        {ACCENT_SWATCHES.map((hex) => (
                          <button
                            key={hex}
                            type="button"
                            onClick={() => updateDraft(poster.id, { accentColor: hex })}
                            className={`h-5 w-5 cursor-pointer rounded-full border-2 transition ${
                              poster.accentColor === hex
                                ? 'scale-110 border-[#241A13]'
                                : 'border-white shadow-xs'
                            }`}
                            style={{ backgroundColor: hex }}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="w-32">
                      <span className="block font-mono text-[9.5px] font-semibold tracking-wider text-[#5C4432] uppercase">
                        Motif Default
                      </span>
                      <ThemedDropdown
                        value={String(poster.style ?? 0)}
                        options={POSTER_STYLE_OPTIONS}
                        onChange={(val) =>
                          updateDraft(poster.id, { style: parseInt(val, 10) || 0 })
                        }
                        ariaLabel="Pilih motif default poster"
                        size="xs"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end border-t border-[#4A2E1B]/10 pt-3">
                  <button
                    type="button"
                    disabled={savingId === poster.id || bulkBusy}
                    onClick={() => handleSave(poster)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#4A2E1B] px-4 py-2 text-xs font-semibold text-[#FAF5EC] shadow-sm transition hover:bg-[#3A2213] disabled:opacity-50"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>{savingId === poster.id ? 'Menyimpan...' : 'Simpan Poster'}</span>
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Portrait Poster Crop, Rotate & Auto-Enhance Modal */}
      <ImageCropEnhanceModal
        file={cropTarget?.file ?? null}
        title="Crop, Rotate & Enhance Poster Dinding (Portrait)"
        targetWidth={768}
        targetHeight={1050}
        onCancel={() => setCropTarget(null)}
        onConfirm={handleConfirmCrop}
      />

      {/* Orihour-Themed Confirmation Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        title={`Hapus Gambar pada ${selectedIds.size} Poster?`}
        description={`Gambar kustom pada ${selectedIds.size} bingkai poster terpilih akan dihapus dan dikembalikan ke tampilan tipografi default.`}
        confirmLabel={`Hapus Gambar (${selectedIds.size})`}
        busy={bulkBusy}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void executeBulkClearImages()}
      />
    </div>
  );
}