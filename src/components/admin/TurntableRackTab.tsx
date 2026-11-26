'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Disc3,
  PowerOff,
  GripVertical,
  Trash2,
  Plus,
  Save,
  CheckCircle2,
  Layers,
  CheckSquare,
  Square,
} from 'lucide-react';
import { RoomConfig, VinylRecord } from '@/types/orihour';
import { getSleeveDataUrl } from '@/components/room-3d/textures';
import ThemedDropdown, { DropdownOption } from '@/components/ui/ThemedDropdown';

interface TurntableRackTabProps {
  config: RoomConfig;
  vinyls: VinylRecord[];
  onUpdateActiveTurntable: (vinylId: string | null) => Promise<void>;
  onSaveRackOrder: (rackIds: (string | null)[]) => Promise<void>;
}

export default function TurntableRackTab({
  config,
  vinyls,
  onUpdateActiveTurntable,
  onSaveRackOrder,
}: TurntableRackTabProps) {
  const [savingTurntable, setSavingTurntable] = useState(false);
  const [savingRack, setSavingRack] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [dragFromIdx, setDragFromIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [selectedSlotIndices, setSelectedSlotIndices] = useState<Set<number>>(new Set());

  const activeTurntableVinyl = useMemo(
    () =>
      config.activeTurntableVinylId
        ? vinyls.find((v) => v.id === config.activeTurntableVinylId) ?? null
        : null,
    [config.activeTurntableVinylId, vinyls]
  );

  const initialSlots = useMemo(() => {
    const arr: (string | null)[] = [null, null, null, null, null, null];
    for (const v of vinyls) {
      if (
        v.id !== config.activeTurntableVinylId &&
        typeof v.rackSlot === 'number' &&
        v.rackSlot >= 1 &&
        v.rackSlot <= 6
      ) {
        arr[v.rackSlot - 1] = v.id;
      }
    }
    return arr;
  }, [vinyls, config.activeTurntableVinylId]);

  const [slots, setSlots] = useState<(string | null)[]>(initialSlots);

  useEffect(() => {
    setSlots(initialSlots);
    setSelectedSlotIndices(new Set());
  }, [initialSlots]);

  const filledIndices = useMemo(
    () => slots.map((id, i) => (id ? i : -1)).filter((i) => i >= 0),
    [slots]
  );

  const allFilledSelected =
    filledIndices.length > 0 && filledIndices.every((i) => selectedSlotIndices.has(i));

  const toggleSlotSelect = (idx: number) => {
    setSelectedSlotIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleSelectAllFilled = () => {
    if (allFilledSelected) {
      setSelectedSlotIndices(new Set());
    } else {
      setSelectedSlotIndices(new Set(filledIndices));
    }
  };

  const handleBulkClearSlots = () => {
    const targets = Array.from(selectedSlotIndices).filter((i) => Boolean(slots[i]));
    if (targets.length === 0) return;
    setSlots((prev) => prev.map((val, i) => (selectedSlotIndices.has(i) ? null : val)));
    setSelectedSlotIndices(new Set());
    showToast(
      `${targets.length} slot rak dikosongkan. Klik "Simpan Susunan Rak" untuk menerapkan.`
    );
  };

  const showToast = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3200);
  };

  const handleSetTurntable = async (nextId: string | null) => {
    setSavingTurntable(true);
    try {
      await onUpdateActiveTurntable(nextId);
      showToast(
        nextId
          ? 'Vinyl berhasil dipasang ke turntable 3D.'
          : 'Turntable & stand cover kanan berhasil dikosongkan.'
      );
    } finally {
      setSavingTurntable(false);
    }
  };

  const handleSlotChange = (slotIdx: number, nextVinylId: string) => {
    const cleanId = nextVinylId || null;
    setSlots((prev) => {
      const next = [...prev];
      if (cleanId) {
        for (let i = 0; i < next.length; i++) {
          if (i !== slotIdx && next[i] === cleanId) {
            next[i] = null;
          }
        }
      }
      next[slotIdx] = cleanId;
      return next;
    });
    if (!cleanId) {
      setSelectedSlotIndices((prev) => {
        const next = new Set(prev);
        next.delete(slotIdx);
        return next;
      });
    }
  };

  const handleDropOnSlot = (targetIdx: number) => {
    if (dragFromIdx === null || dragFromIdx === targetIdx) {
      setDragFromIdx(null);
      setDragOverIdx(null);
      return;
    }

    setSlots((prev) => {
      const next = [...prev];
      const temp = next[dragFromIdx];
      next[dragFromIdx] = next[targetIdx];
      next[targetIdx] = temp;
      return next;
    });

    setSelectedSlotIndices(new Set());
    setDragFromIdx(null);
    setDragOverIdx(null);
  };

  const handlePersistRack = async () => {
    setSavingRack(true);
    try {
      await onSaveRackOrder(slots);
      setSelectedSlotIndices(new Set());
      showToast('Susunan 6 slot kontainer rak vinyl berhasil disimpan.');
    } finally {
      setSavingRack(false);
    }
  };

  const turntableDropdownOptions = useMemo<DropdownOption[]>(
    () => [
      { value: '', label: '-- Kosongkan Turntable (Empty Platter) --' },
      ...vinyls.map((v) => ({
        value: v.id,
        label: `[${v.releaseType}] ${v.title} - ${v.artist} (${v.releaseYear})`,
      })),
    ],
    [vinyls]
  );

  const rackSlotDropdownOptions = useMemo<DropdownOption[]>(() => {
    const eligible = vinyls.filter((v) => v.id !== config.activeTurntableVinylId);
    return [
      { value: '', label: '(Slot Kosong)' },
      ...eligible.map((v) => ({
        value: v.id,
        label: `[${v.releaseType}] ${v.title} - ${v.artist}`,
      })),
    ];
  }, [vinyls, config.activeTurntableVinylId]);

  const getThumb = (v: VinylRecord) =>
    v.coverUrl || (typeof window !== 'undefined' ? getSleeveDataUrl(v) : '');

  return (
    <div className="space-y-6">
      {feedback && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-700/25 bg-emerald-500/12 px-4 py-3 text-xs font-semibold text-emerald-950">
          <CheckCircle2 className="h-4 w-4 text-emerald-700" />
          <span>{feedback}</span>
        </div>
      )}

      {/* SECTION 1: TURNTABLE & RIGHT STAND CONTROL */}
      <section className="rounded-[24px] border border-[#E5D7C3] bg-[#FAF5EC]/85 p-6 shadow-sm backdrop-blur-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] font-semibold tracking-[0.16em] text-[#7A5230] uppercase">
              TURNTABLE &amp; NOW PLAYING STAND
            </p>
            <h2 className="mt-1 font-serif text-2xl text-[#241A13]">
              Vinyl Aktif di Platter 3D
            </h2>
            <p className="mt-1 text-xs text-[#655040]">
              Pilih vinyl yang langsung terpasang saat pengunjung masuk ruangan, atau kosongkan agar platter dan stand cover kanan kosong.
            </p>
          </div>

          <button
            type="button"
            disabled={savingTurntable || !activeTurntableVinyl}
            onClick={() => handleSetTurntable(null)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#4A2E1B]/25 bg-[#F2E7D7] px-3.5 py-2 text-xs font-semibold text-[#4A2E1B] transition hover:bg-[#E7D6BE] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <PowerOff className="h-3.5 w-3.5" />
            <span>Kosongkan Turntable</span>
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="flex items-center gap-4 rounded-2xl border border-[#4A2E1B]/12 bg-white/85 p-4 lg:col-span-5">
            {activeTurntableVinyl ? (
              <>
                <img
                  src={getThumb(activeTurntableVinyl)}
                  alt={activeTurntableVinyl.title}
                  className="h-20 w-20 shrink-0 rounded-xl border border-black/10 object-cover shadow-sm"
                />
                <div className="min-w-0">
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#4A2E1B]/12 px-2 py-0.5 font-mono text-[9.5px] font-semibold text-[#4A2E1B] uppercase">
                    <Disc3 className="h-3 w-3" />
                    TERPASANG DI PLATTER
                  </span>
                  <h3 className="mt-1.5 truncate font-serif text-xl text-[#241A13]">
                    {activeTurntableVinyl.title}
                  </h3>
                  <p className="truncate text-xs text-[#655040]">
                    {activeTurntableVinyl.artist} · {activeTurntableVinyl.releaseType} ·{' '}
                    {activeTurntableVinyl.releaseYear}
                  </p>
                </div>
              </>
            ) : (
              <div className="flex w-full items-center gap-3.5 py-2">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-[#4A2E1B]/35 bg-[#FAF5EC] text-[#7A5230]">
                  <Disc3 className="h-7 w-7" />
                </div>
                <div>
                  <span className="inline-flex rounded-full bg-[#4A2E1B]/10 px-2 py-0.5 font-mono text-[9.5px] font-semibold text-[#5C4432] uppercase">
                    EMPTY PLATTER
                  </span>
                  <p className="mt-1 font-serif text-lg text-[#241A13]">
                    Turntable &amp; Stand Cover Kosong
                  </p>
                  <p className="text-[11px] text-[#6B5442]">
                    Pengunjung dapat memilih vinyl dari kontainer rak untuk mulai memutar.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col justify-center rounded-2xl border border-[#4A2E1B]/12 bg-white/80 p-4 lg:col-span-7">
            <span className="font-mono text-[10px] font-semibold tracking-wider text-[#5C4432] uppercase">
              Pilih Vinyl untuk Turntable
            </span>
            <div className="mt-2">
              <ThemedDropdown
                value={config.activeTurntableVinylId ?? ''}
                options={turntableDropdownOptions}
                disabled={savingTurntable}
                onChange={(val) => handleSetTurntable(val || null)}
                ariaLabel="Pilih vinyl aktif untuk turntable"
                size="md"
              />
            </div>
            <p className="mt-2 text-[11px] text-[#735D4B]">
              Memasang vinyl ke turntable otomatis mengeluarkannya dari kontainer rak agar tidak tampil ganda.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 2: DRAG-AND-DROP 6-SLOT 3D WOODEN RACK CONTAINER + BULK CLEAR */}
      <section className="rounded-[24px] border border-[#E5D7C3] bg-[#FAF5EC]/85 p-6 shadow-sm backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-[0.16em] text-[#7A5230] uppercase">
              <Layers className="h-3.5 w-3.5" />
              3D WOODEN VINYL CONTAINER (MAKS 6 SLOT · DRAG &amp; DROP)
            </p>
            <h2 className="mt-1 font-serif text-2xl text-[#241A13]">
              Susunan Vinyl di Kontainer Rak
            </h2>
            <p className="mt-1 text-xs text-[#655040]">
              Geser (drag &amp; drop) kartu slot untuk menukar urutan, atau ceklis slot terisi untuk mengeluarkannya sekaligus.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {filledIndices.length > 0 && (
              <button
                type="button"
                onClick={toggleSelectAllFilled}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#4A2E1B]/20 bg-white px-3 py-2 text-xs font-semibold text-[#4A2E1B] transition hover:bg-[#EFE4D3]"
              >
                {allFilledSelected ? (
                  <CheckSquare className="h-3.5 w-3.5" />
                ) : (
                  <Square className="h-3.5 w-3.5" />
                )}
                <span>{allFilledSelected ? 'Batal Pilih' : 'Pilih Semua Terisi'}</span>
              </button>
            )}

            {selectedSlotIndices.size > 0 && (
              <button
                type="button"
                onClick={handleBulkClearSlots}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#4A2E1B]/25 bg-[#F2E7D7] px-3.5 py-2 text-xs font-semibold text-[#4A2E1B] transition hover:bg-[#E7D6BE]"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Keluarkan Terpilih ({selectedSlotIndices.size})</span>
              </button>
            )}

            <button
              type="button"
              disabled={savingRack}
              onClick={handlePersistRack}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#4A2E1B] px-4 py-2 text-xs font-semibold text-[#FAF5EC] shadow-md transition hover:bg-[#3A2213] disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{savingRack ? 'Menyimpan...' : 'Simpan Susunan Rak'}</span>
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
          {slots.map((vinylId, idx) => {
            const record = vinylId ? vinyls.find((v) => v.id === vinylId) ?? null : null;
            const isDragging = dragFromIdx === idx;
            const isDragOver =
              dragOverIdx === idx && dragFromIdx !== null && dragFromIdx !== idx;
            const isChecked = selectedSlotIndices.has(idx);

            return (
              <div
                key={idx}
                draggable
                onDragStart={(e) => {
                  setDragFromIdx(idx);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverIdx !== idx) setDragOverIdx(idx);
                }}
                onDragLeave={() => {
                  if (dragOverIdx === idx) setDragOverIdx(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDropOnSlot(idx);
                }}
                onDragEnd={() => {
                  setDragFromIdx(null);
                  setDragOverIdx(null);
                }}
                className={`flex cursor-grab items-center gap-3 rounded-2xl border p-3 shadow-xs transition select-none active:cursor-grabbing ${
                  isDragging
                    ? 'scale-[0.98] border-[#4A2E1B]/45 bg-[#EFE4D3] opacity-60'
                    : isDragOver
                    ? 'border-2 border-dashed border-[#4A2E1B] bg-[#F3E8D7]'
                    : isChecked
                    ? 'border-[#4A2E1B] bg-[#F3E8D7]/85 ring-1 ring-[#4A2E1B]/25'
                    : 'border-[#4A2E1B]/12 bg-white/88 hover:border-[#4A2E1B]/30'
                }`}
              >
                <div className="flex shrink-0 items-center gap-1.5 text-[#7A5E48]">
                  <input
                    type="checkbox"
                    disabled={!vinylId}
                    checked={isChecked}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggleSlotSelect(idx)}
                    aria-label={`Pilih slot rak #${idx + 1}`}
                    className="h-3.5 w-3.5 cursor-pointer accent-[#4A2E1B] disabled:cursor-not-allowed disabled:opacity-30"
                  />
                  <GripVertical className="h-4 w-4" />
                  <div className="flex h-9 w-9 flex-col items-center justify-center rounded-xl bg-[#4A2E1B]/10 font-mono text-[10px] font-bold text-[#4A2E1B]">
                    <span>#{idx + 1}</span>
                  </div>
                </div>

                {record ? (
                  <img
                    src={getThumb(record)}
                    alt={record.title}
                    draggable={false}
                    className="h-12 w-12 shrink-0 rounded-lg border border-black/10 object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-dashed border-[#4A2E1B]/22 bg-[#FAF5EC] text-[#9A8470]">
                    <Plus className="h-4 w-4" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <ThemedDropdown
                    value={vinylId ?? ''}
                    options={rackSlotDropdownOptions}
                    onChange={(val) => handleSlotChange(idx, val)}
                    ariaLabel={`Pilih vinyl untuk slot rak nomor ${idx + 1}`}
                    size="xs"
                  />
                  {record ? (
                    <p className="mt-1 truncate font-mono text-[10px] text-[#735D4B]">
                      {record.genre} · {record.releaseType} ·{' '}
                      {record.releaseType === 'Song'
                        ? record.duration
                        : `${record.tracks?.length || 0} lagu`}
                    </p>
                  ) : (
                    <p className="mt-1 font-mono text-[10px] text-[#9A8470]">
                      Drag slot lain ke sini atau pilih vinyl
                    </p>
                  )}
                </div>

                {vinylId && (
                  <button
                    type="button"
                    onClick={() => handleSlotChange(idx, '')}
                    className="cursor-pointer rounded-lg p-1.5 text-[#8A7360] transition hover:bg-[#4A2E1B]/10 hover:text-[#4A2E1B]"
                    title="Keluarkan dari rak"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}