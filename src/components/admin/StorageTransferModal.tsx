'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  ArrowRight,
  ArrowRightLeft,
  Check,
  CheckCircle2,
  Cloud,
  Copy,
  Database,
  File,
  FolderOutput,
  Image as ImageIcon,
  Loader2,
  Music,
  RefreshCw,
  RotateCcw,
  Search,
  StopCircle,
  X,
} from 'lucide-react';
import type {
  PublicStorageAccount,
  StoragePoolOverview,
} from '@/components/admin/StoragePoolTab';

type StorageFileKind = 'audio' | 'image' | 'other';
type FilterMode = 'all' | 'active' | 'audio' | 'image' | 'orphan';
type TransferMode = 'move' | 'copy';

interface StorageFileReferenceInfo {
  sourceType: 'vinyl_cover' | 'vinyl_audio' | 'track_audio' | 'poster' | 'avatar';
  label: string;
}

interface StorageFileItem {
  objectKey: string;
  fileName: string;
  size: number;
  kind: StorageFileKind;
  isReferenced: boolean;
  references: StorageFileReferenceInfo[];
}

interface FileTransferStatus {
  state: 'idle' | 'running' | 'success' | 'error';
  message?: string;
}

interface StorageTransferModalProps {
  open: boolean;
  accounts: PublicStorageAccount[];
  initialSourceId?: string | null;
  onClose: () => void;
  onCompleted: (overview: StoragePoolOverview, summaryMessage: string) => void;
}

function formatBytes(bytes: number): string {
  const safe = Math.max(0, Number(bytes) || 0);
  if (safe < 1024) return `${safe} B`;
  const kb = safe / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

export default function StorageTransferModal({
  open,
  accounts,
  initialSourceId,
  onClose,
  onCompleted,
}: StorageTransferModalProps) {
  const [mounted, setMounted] = useState(false);
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [mode, setMode] = useState<TransferMode>('move');
  const [copyUpdateRefs, setCopyUpdateRefs] = useState(false);

  const [files, setFiles] = useState<StorageFileItem[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [selectedMap, setSelectedMap] = useState<Record<string, boolean>>({});

  const [isRunning, setIsRunning] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const stopRequestedRef = useRef(false);

  const [progressIndex, setProgressIndex] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [currentFileLabel, setCurrentFileLabel] = useState<string | null>(null);
  const [statusMap, setStatusMap] = useState<Record<string, FileTransferStatus>>({});
  const [runSummary, setRunSummary] = useState<{
    successCount: number;
    failedCount: number;
    totalBytes: number;
    updatedRefs: number;
    stoppedEarly: boolean;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Inisialisasi akun asal & tujuan saat modal dibuka
  useEffect(() => {
    if (!open || accounts.length < 2) return;

    const preferredSource =
      (initialSourceId && accounts.find((a) => a.id === initialSourceId)?.id) ||
      accounts.find((a) => a.isActive)?.id ||
      accounts[0].id;

    const preferredTarget =
      accounts.find((a) => a.id !== preferredSource && a.isEnabled)?.id ||
      accounts.find((a) => a.id !== preferredSource)?.id ||
      '';

    setSourceId(preferredSource);
    setTargetId(preferredTarget);
    setMode('move');
    setCopyUpdateRefs(false);
    setSearch('');
    setFilter('all');
    setStatusMap({});
    setRunSummary(null);
    setProgressIndex(0);
    setProgressTotal(0);
    setCurrentFileLabel(null);
    stopRequestedRef.current = false;
    setIsStopping(false);
  }, [open, accounts, initialSourceId]);

  const fetchSourceFiles = useCallback(async (accId: string, signal?: AbortSignal) => {
    if (!accId) return;
    setLoadingFiles(true);
    setLoadError(null);
    setStatusMap({});
    setRunSummary(null);

    try {
      const res = await fetch(
        `/api/admin/storage/transfer?sourceId=${encodeURIComponent(accId)}`,
        { cache: 'no-store', signal }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memuat daftar file dari akun asal.');
      }

      const nextFiles = Array.isArray(data.files) ? (data.files as StorageFileItem[]) : [];
      setFiles(nextFiles);

      // Default: pilih otomatis semua file aktif (file sisa dibiarkan tidak tercentang agar aman)
      const initialSelected: Record<string, boolean> = {};
      for (const f of nextFiles) {
        if (f.isReferenced) initialSelected[f.objectKey] = true;
      }
      setSelectedMap(initialSelected);
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') return;
      setFiles([]);
      setSelectedMap({});
      setLoadError(
        err instanceof Error ? err.message : 'Gagal memuat daftar file penyimpanan.'
      );
    } finally {
      if (!signal?.aborted) {
        setLoadingFiles(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!open || !sourceId) return;
    const controller = new AbortController();
    void fetchSourceFiles(sourceId, controller.signal);
    return () => controller.abort();
  }, [open, sourceId, fetchSourceFiles]);

  const sourceAccount = useMemo(
    () => accounts.find((a) => a.id === sourceId) || null,
    [accounts, sourceId]
  );
  const targetAccount = useMemo(
    () => accounts.find((a) => a.id === targetId) || null,
    [accounts, targetId]
  );

  const counts = useMemo(() => {
    let active = 0;
    let audio = 0;
    let image = 0;
    let orphan = 0;
    for (const f of files) {
      if (f.isReferenced) active += 1;
      else orphan += 1;
      if (f.kind === 'audio') audio += 1;
      else if (f.kind === 'image') image += 1;
    }
    return { all: files.length, active, audio, image, orphan };
  }, [files]);

  const filteredFiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return files.filter((f) => {
      if (filter === 'active' && !f.isReferenced) return false;
      if (filter === 'orphan' && f.isReferenced) return false;
      if (filter === 'audio' && f.kind !== 'audio') return false;
      if (filter === 'image' && f.kind !== 'image') return false;
      if (!q) return true;
      return (
        f.fileName.toLowerCase().includes(q) ||
        f.objectKey.toLowerCase().includes(q) ||
        f.references.some((r) => r.label.toLowerCase().includes(q))
      );
    });
  }, [files, filter, search]);

  const selectedFiles = useMemo(
    () => files.filter((f) => Boolean(selectedMap[f.objectKey])),
    [files, selectedMap]
  );

  const selectedBytes = useMemo(
    () => selectedFiles.reduce((sum, f) => sum + f.size, 0),
    [selectedFiles]
  );

  const failedFiles = useMemo(
    () => files.filter((f) => statusMap[f.objectKey]?.state === 'error'),
    [files, statusMap]
  );

  const targetRemainingBytes = targetAccount?.remainingBytes ?? 0;
  const exceedsTargetQuota =
    Boolean(targetAccount) && selectedBytes > 0 && selectedBytes > targetRemainingBytes;

  const handleSourceChange = (nextSourceId: string) => {
    setSourceId(nextSourceId);
    if (nextSourceId === targetId) {
      const alt =
        accounts.find((a) => a.id !== nextSourceId && a.isEnabled)?.id ||
        accounts.find((a) => a.id !== nextSourceId)?.id ||
        '';
      setTargetId(alt);
    }
  };

  const handleSwapAccounts = () => {
    if (isRunning || !sourceId || !targetId) return;
    const prevSource = sourceId;
    setSourceId(targetId);
    setTargetId(prevSource);
  };

  const toggleSelectKey = (objectKey: string) => {
    if (isRunning) return;
    setSelectedMap((prev) => ({
      ...prev,
      [objectKey]: !prev[objectKey],
    }));
  };

  const selectAllActive = () => {
    if (isRunning) return;
    const next: Record<string, boolean> = {};
    for (const f of files) {
      if (f.isReferenced) next[f.objectKey] = true;
    }
    setSelectedMap(next);
  };

  const selectAllVisible = () => {
    if (isRunning) return;
    setSelectedMap((prev) => {
      const next = { ...prev };
      for (const f of filteredFiles) {
        next[f.objectKey] = true;
      }
      return next;
    });
  };

  const clearSelection = () => {
    if (isRunning) return;
    setSelectedMap({});
  };

  const executeQueue = async (queue: StorageFileItem[]) => {
    if (isRunning || !sourceAccount || !targetAccount || queue.length === 0) return;

    stopRequestedRef.current = false;
    setIsStopping(false);
    setIsRunning(true);
    setRunSummary(null);
    setProgressIndex(0);
    setProgressTotal(queue.length);

    const initialStatus: Record<string, FileTransferStatus> = {};
    for (const f of queue) {
      initialStatus[f.objectKey] = { state: 'idle' };
    }
    setStatusMap(initialStatus);

    let successCount = 0;
    let failedCount = 0;
    let totalBytes = 0;
    let updatedRefs = 0;
    let stoppedEarly = false;

    for (let i = 0; i < queue.length; i++) {
      if (stopRequestedRef.current) {
        stoppedEarly = true;
        break;
      }

      const item = queue[i];
      setProgressIndex(i + 1);
      setCurrentFileLabel(item.references[0]?.label || item.fileName);
      setStatusMap((prev) => ({
        ...prev,
        [item.objectKey]: { state: 'running' },
      }));

      try {
        const res = await fetch('/api/admin/storage/transfer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'transfer_file',
            sourceAccountId: sourceAccount.id,
            targetAccountId: targetAccount.id,
            objectKey: item.objectKey,
            mode,
            updateReferences: mode === 'move' ? true : copyUpdateRefs,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || `HTTP ${res.status}`);
        }

        successCount += 1;
        totalBytes += Number(data.sizeBytes) || item.size;
        updatedRefs += Number(data.updatedReferences) || 0;

        setStatusMap((prev) => ({
          ...prev,
          [item.objectKey]: {
            state: 'success',
            message:
              mode === 'move'
                ? 'Dipindahkan'
                : copyUpdateRefs
                ? 'Disalin & URL dialihkan'
                : 'Disalin',
          },
        }));
      } catch (err) {
        failedCount += 1;
        setStatusMap((prev) => ({
          ...prev,
          [item.objectKey]: {
            state: 'error',
            message: err instanceof Error ? err.message : 'Gagal transfer',
          },
        }));
      }
    }

    setCurrentFileLabel(null);
    setRunSummary({
      successCount,
      failedCount,
      totalBytes,
      updatedRefs,
      stoppedEarly,
    });

    // Refresh kapasitas kedua akun jika minimal 1 file berhasil
    if (successCount > 0) {
      try {
        const finRes = await fetch('/api/admin/storage/transfer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'finalize',
            sourceAccountId: sourceAccount.id,
            targetAccountId: targetAccount.id,
          }),
        });
        const finData = await finRes.json().catch(() => ({}));
        if (finRes.ok && finData.overview) {
          const verb = mode === 'move' ? 'dipindahkan' : 'disalin';
          const summaryMsg =
            failedCount > 0
              ? `${successCount} file (${formatBytes(totalBytes)}) berhasil ${verb} dari "${sourceAccount.name}" ke "${targetAccount.name}", ${failedCount} gagal.`
              : `${successCount} file (${formatBytes(totalBytes)}) berhasil ${verb} dari "${sourceAccount.name}" ke "${targetAccount.name}"${
                  updatedRefs > 0 ? ` (${updatedRefs} tautan media diperbarui).` : '.'
                }`;
          onCompleted(finData.overview as StoragePoolOverview, summaryMsg);
        }
      } catch {
        // Non-fatal: admin masih bisa klik Scan di tab utama
      }

      // Pada mode Pindahkan, hapus file yang sukses dari daftar & pilihan agar langsung akurat
      if (mode === 'move') {
        setStatusMap((latestStatus) => {
          const succeededKeys = new Set(
            Object.entries(latestStatus)
              .filter(([, v]) => v.state === 'success')
              .map(([k]) => k)
          );
          if (succeededKeys.size > 0) {
            setFiles((prev) => prev.filter((f) => !succeededKeys.has(f.objectKey)));
            setSelectedMap((prev) => {
              const next = { ...prev };
              succeededKeys.forEach((k) => {
                delete next[k];
              });
              return next;
            });
          }
          return latestStatus;
        });
      }
    }

    setIsRunning(false);
    setIsStopping(false);
  };

  if (!open || !mounted) return null;

  const progressPct =
    progressTotal > 0 ? Math.min(100, Math.round((progressIndex / progressTotal) * 100)) : 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-[#18110C]/64 p-3 backdrop-blur-md sm:p-4"
      onClick={() => {
        if (!isRunning) onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-[24px] border border-[#E7DAC7] bg-[#FAF5EC] text-[#241A13] shadow-2xl"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#4A2E1B]/12 bg-[#F4ECE0] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#4A2E1B] text-[#FAF5EC]">
              <ArrowRightLeft className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-serif text-xl leading-tight text-[#241A13]">
                Transfer File Antar Penyimpanan
              </h3>
              <p className="text-[11px] text-[#6B5442]">
                Pindahkan atau salin seluruh file maupun file tertentu secara langsung antar-server.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isRunning}
            onClick={onClose}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[#4A2E1B]/15 bg-[#FAF5EC] text-[#4A2E1B] hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Tutup modal transfer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="orihour-scroll flex-1 space-y-4 overflow-y-auto p-5">
          {/* Source & Target Account Selector */}
          <div className="grid grid-cols-1 items-end gap-2.5 rounded-2xl border border-[#4A2E1B]/14 bg-white/88 p-3.5 sm:grid-cols-11">
            <div className="flex flex-col gap-1 sm:col-span-5">
              <label className="font-mono text-[9.5px] font-semibold tracking-wider text-[#5C4432] uppercase">
                Akun Asal (Sumber)
              </label>
              <select
                disabled={isRunning}
                value={sourceId}
                onChange={(e) => handleSourceChange(e.target.value)}
                className="h-[38px] rounded-xl border border-[#4A2E1B]/18 bg-[#FAF5EC] px-3 text-xs font-semibold text-[#241A13] outline-none focus:border-[#4A2E1B] disabled:opacity-60"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.provider === 'b2' ? 'B2' : 'Supabase'} · {formatBytes(acc.usedBytes)})
                  </option>
                ))}
              </select>
              {sourceAccount && (
                <p className="font-mono text-[9.5px] text-[#7A624E]">
                  Bucket: <strong>{sourceAccount.bucket}</strong> · {sourceAccount.fileCount} file
                </p>
              )}
            </div>

            <div className="flex justify-center pb-1 sm:col-span-1">
              <button
                type="button"
                disabled={isRunning || accounts.length < 2}
                onClick={handleSwapAccounts}
                title="Tukar akun asal & tujuan"
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[#4A2E1B]/20 bg-[#FAF5EC] text-[#4A2E1B] transition hover:bg-[#EFE4D3] disabled:opacity-45"
              >
                <ArrowRightLeft className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex flex-col gap-1 sm:col-span-5">
              <label className="font-mono text-[9.5px] font-semibold tracking-wider text-[#5C4432] uppercase">
                Akun Tujuan
              </label>
              <select
                disabled={isRunning}
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="h-[38px] rounded-xl border border-[#4A2E1B]/18 bg-[#FAF5EC] px-3 text-xs font-semibold text-[#241A13] outline-none focus:border-[#4A2E1B] disabled:opacity-60"
              >
                {accounts
                  .filter((acc) => acc.id !== sourceId)
                  .map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.provider === 'b2' ? 'B2' : 'Supabase'} · Sisa {formatBytes(acc.remainingBytes)})
                    </option>
                  ))}
              </select>
              {targetAccount && (
                <p className="font-mono text-[9.5px] text-[#7A624E]">
                  Sisa kuota: <strong>{formatBytes(targetAccount.remainingBytes)}</strong>
                  {!targetAccount.isEnabled ? ' · (Nonaktif)' : ''}
                </p>
              )}
            </div>
          </div>

          {/* Transfer Mode Selector (Move vs Copy) */}
          <div className="space-y-2.5">
            <span className="block font-mono text-[9.5px] font-semibold tracking-wider text-[#5C4432] uppercase">
              Mode Transfer
            </span>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={isRunning}
                onClick={() => setMode('move')}
                className={`flex cursor-pointer items-start gap-2.5 rounded-2xl border p-3 text-left transition disabled:opacity-60 ${
                  mode === 'move'
                    ? 'border-[#4A2E1B] bg-[#4A2E1B] text-[#FAF5EC] shadow-xs'
                    : 'border-[#4A2E1B]/16 bg-white/85 text-[#241A13] hover:bg-white'
                }`}
              >
                <FolderOutput
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    mode === 'move' ? 'text-[#E6C79C]' : 'text-[#7A5230]'
                  }`}
                />
                <div>
                  <p className="text-xs font-semibold">Pindahkan (Move)</p>
                  <p
                    className={`mt-0.5 text-[10.5px] leading-snug ${
                      mode === 'move' ? 'text-[#FAF5EC]/82' : 'text-[#6B5442]'
                    }`}
                  >
                    Salin ke tujuan, perbarui URL di database otomatis, lalu hapus file lama di akun asal.
                  </p>
                </div>
              </button>

              <button
                type="button"
                disabled={isRunning}
                onClick={() => setMode('copy')}
                className={`flex cursor-pointer items-start gap-2.5 rounded-2xl border p-3 text-left transition disabled:opacity-60 ${
                  mode === 'copy'
                    ? 'border-[#4A2E1B] bg-[#4A2E1B] text-[#FAF5EC] shadow-xs'
                    : 'border-[#4A2E1B]/16 bg-white/85 text-[#241A13] hover:bg-white'
                }`}
              >
                <Copy
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    mode === 'copy' ? 'text-[#E6C79C]' : 'text-[#7A5230]'
                  }`}
                />
                <div>
                  <p className="text-xs font-semibold">Salin Saja (Tanpa Hapus Asal)</p>
                  <p
                    className={`mt-0.5 text-[10.5px] leading-snug ${
                      mode === 'copy' ? 'text-[#FAF5EC]/82' : 'text-[#6B5442]'
                    }`}
                  >
                    Duplikasi file ke tujuan sebagai cadangan tanpa menghapus file di akun asal.
                  </p>
                </div>
              </button>
            </div>

            {mode === 'copy' && (
              <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-[#4A2E1B]/14 bg-white/85 px-3.5 py-2.5 text-xs text-[#241A13]">
                <input
                  type="checkbox"
                  disabled={isRunning}
                  checked={copyUpdateRefs}
                  onChange={(e) => setCopyUpdateRefs(e.target.checked)}
                  className="h-4 w-4 accent-[#4A2E1B]"
                />
                <div>
                  <span className="font-semibold">
                    Alihkan tautan aktif di Orihour ke akun tujuan
                  </span>
                  <p className="text-[10.5px] text-[#6B5442]">
                    Biarkan tidak dicentang jika ingin menyimpan salinan sebagai backup murni (tautan aktif tetap diputar dari akun asal).
                  </p>
                </div>
              </label>
            )}
          </div>

          {/* Live Progress Bar / Result Banner */}
          {(isRunning || runSummary) && (
            <div className="space-y-2 rounded-2xl border border-[#4A2E1B]/16 bg-white p-3.5 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="inline-flex items-center gap-2 font-semibold text-[#241A13]">
                  {isRunning ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-[#7A5230]" />
                      <span>
                        {mode === 'move' ? 'Memindahkan' : 'Menyalin'} file {progressIndex} dari{' '}
                        {progressTotal}...
                      </span>
                    </>
                  ) : runSummary?.failedCount ? (
                    <>
                      <AlertTriangle className="h-4 w-4 text-amber-700" />
                      <span>
                        Selesai sebagian: {runSummary.successCount} berhasil,{' '}
                        {runSummary.failedCount} gagal ({formatBytes(runSummary.totalBytes)})
                      </span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                      <span>
                        {runSummary?.stoppedEarly ? 'Dihentikan: ' : 'Selesai! '}
                        {runSummary?.successCount ?? 0} file (
                        {formatBytes(runSummary?.totalBytes ?? 0)}) berhasil{' '}
                        {mode === 'move' ? 'dipindahkan' : 'disalin'}
                        {runSummary?.updatedRefs
                          ? ` · ${runSummary.updatedRefs} referensi URL diperbarui`
                          : ''}
                      </span>
                    </>
                  )}
                </span>

                <span className="font-mono text-[10.5px] font-bold text-[#4A2E1B]">
                  {progressPct}%
                </span>
              </div>

              <div className="h-2 w-full overflow-hidden rounded-full bg-[#4A2E1B]/12">
                <div
                  className={`h-full rounded-full transition-[width] duration-200 ${
                    runSummary?.failedCount && !isRunning
                      ? 'bg-amber-600'
                      : 'bg-emerald-700'
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              {currentFileLabel && isRunning && (
                <p className="truncate font-mono text-[10px] text-[#7A624E]">
                  Sedang diproses: <strong>{currentFileLabel}</strong>
                </p>
              )}
            </div>
          )}

          {/* Quota Warning */}
          {exceedsTargetQuota && (
            <div className="flex items-start gap-2 rounded-xl border border-[#6E1D2C]/28 bg-[#6E1D2C]/10 px-3.5 py-2.5 text-xs font-semibold text-[#571622]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#6E1D2C]" />
              <span>
                Total file terpilih ({formatBytes(selectedBytes)}) melebihi sisa kuota{' '}
                <strong>{targetAccount?.name}</strong> ({formatBytes(targetRemainingBytes)}). Kurangi
                pilihan file atau pilih akun tujuan dengan ruang lebih besar.
              </span>
            </div>
          )}

          {/* File Picker Toolbar */}
          <div className="space-y-2.5 rounded-2xl border border-[#4A2E1B]/14 bg-white/85 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="relative min-w-[200px] flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#8A7360]" />
                <input
                  type="text"
                  disabled={loadingFiles}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari nama vinyl, track, poster, atau nama file..."
                  className="h-[34px] w-full rounded-xl border border-[#4A2E1B]/16 bg-[#FAF5EC] pr-3 pl-8.5 text-xs text-[#241A13] placeholder-[#9B8776] outline-none focus:border-[#4A2E1B]"
                />
              </div>

              <button
                type="button"
                disabled={loadingFiles || isRunning || !sourceId}
                onClick={() => void fetchSourceFiles(sourceId)}
                className="inline-flex h-[34px] cursor-pointer items-center gap-1.5 rounded-xl border border-[#4A2E1B]/18 bg-white px-3 text-[11px] font-semibold text-[#4A2E1B] hover:bg-[#EFE4D3] disabled:opacity-45"
              >
                <RefreshCw className={`h-3 w-3 ${loadingFiles ? 'animate-spin' : ''}`} />
                <span>Muat Ulang</span>
              </button>
            </div>

            {/* Filter Pills & Bulk Selection Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#4A2E1B]/10 pt-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: 'all', label: `Semua (${counts.all})` },
                    { id: 'active', label: `Aktif (${counts.active})` },
                    { id: 'audio', label: `Audio (${counts.audio})` },
                    { id: 'image', label: `Gambar (${counts.image})` },
                    { id: 'orphan', label: `File Sisa (${counts.orphan})` },
                  ] as { id: FilterMode; label: string }[]
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilter(tab.id)}
                    className={`cursor-pointer rounded-full border px-2.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase transition ${
                      filter === tab.id
                        ? 'border-[#4A2E1B] bg-[#4A2E1B] text-[#FAF5EC]'
                        : 'border-[#4A2E1B]/15 bg-[#FAF5EC] text-[#5C4432] hover:bg-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
                <button
                  type="button"
                  disabled={isRunning || counts.active === 0}
                  onClick={selectAllActive}
                  className="cursor-pointer font-semibold text-[#4A2E1B] underline underline-offset-2 hover:text-[#7A5230] disabled:opacity-40"
                >
                  Pilih Semua Aktif
                </button>
                <span className="text-[#B8A593]">·</span>
                <button
                  type="button"
                  disabled={isRunning || filteredFiles.length === 0}
                  onClick={selectAllVisible}
                  className="cursor-pointer font-semibold text-[#4A2E1B] underline underline-offset-2 hover:text-[#7A5230] disabled:opacity-40"
                >
                  Pilih Terlihat
                </button>
                <span className="text-[#B8A593]">·</span>
                <button
                  type="button"
                  disabled={isRunning || selectedFiles.length === 0}
                  onClick={clearSelection}
                  className="cursor-pointer font-semibold text-[#6E1D2C] underline underline-offset-2 hover:opacity-80 disabled:opacity-40"
                >
                  Kosongkan
                </button>
              </div>
            </div>

            {/* File Checklist */}
            <div className="orihour-scroll max-h-64 divide-y divide-[#4A2E1B]/10 overflow-y-auto rounded-xl border border-[#4A2E1B]/12 bg-[#FAF5EC]/75">
              {loadingFiles ? (
                <div className="flex items-center justify-center gap-2 py-10 text-xs text-[#6B5442]">
                  <Loader2 className="h-4 w-4 animate-spin text-[#7A5230]" />
                  <span>Memindai daftar file di bucket asal...</span>
                </div>
              ) : loadError ? (
                <div className="flex items-center justify-center gap-2 px-4 py-8 text-xs font-semibold text-[#6E1D2C]">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{loadError}</span>
                </div>
              ) : filteredFiles.length === 0 ? (
                <div className="py-10 text-center font-mono text-[11px] text-[#7A624E]">
                  {files.length === 0
                    ? 'Bucket asal kosong — tidak ada file untuk ditransfer.'
                    : 'Tidak ada file yang cocok dengan filter/pencarian.'}
                </div>
              ) : (
                filteredFiles.map((file) => {
                  const checked = Boolean(selectedMap[file.objectKey]);
                  const st = statusMap[file.objectKey];
                  const primaryLabel =
                    file.references[0]?.label || file.fileName;

                  return (
                    <label
                      key={file.objectKey}
                      className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 text-xs transition ${
                        checked ? 'bg-[#FFFDF8]' : 'hover:bg-white/70'
                      } ${isRunning ? 'cursor-default' : ''}`}
                    >
                      <input
                        type="checkbox"
                        disabled={isRunning}
                        checked={checked}
                        onChange={() => toggleSelectKey(file.objectKey)}
                        className="h-4 w-4 shrink-0 accent-[#4A2E1B]"
                      />

                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                          file.kind === 'audio'
                            ? 'bg-[#4A2E1B]/12 text-[#4A2E1B]'
                            : file.kind === 'image'
                            ? 'bg-[#C89B54]/22 text-[#6E4D1B]'
                            : 'bg-[#4A2E1B]/8 text-[#7A624E]'
                        }`}
                      >
                        {file.kind === 'audio' ? (
                          <Music className="h-3.5 w-3.5" />
                        ) : file.kind === 'image' ? (
                          <ImageIcon className="h-3.5 w-3.5" />
                        ) : (
                          <File className="h-3.5 w-3.5" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate font-semibold text-[#241A13]">
                            {primaryLabel}
                          </span>
                          {file.references.length > 1 && (
                            <span className="rounded-full bg-[#4A2E1B]/10 px-1.5 py-0.2 font-mono text-[9px] font-semibold text-[#5C4432]">
                              +{file.references.length - 1} lain
                            </span>
                          )}
                          {!file.isReferenced && (
                            <span className="rounded-full border border-amber-700/25 bg-amber-500/15 px-1.5 py-0.2 font-mono text-[8.5px] font-bold text-amber-950 uppercase">
                              File Sisa
                            </span>
                          )}
                        </div>
                        <p className="truncate font-mono text-[9.5px] text-[#7A624E]">
                          {file.objectKey}
                        </p>
                        {st?.state === 'error' && st.message && (
                          <p className="mt-0.5 text-[10px] font-semibold text-[#6E1D2C]">
                            Gagal: {st.message}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-2 text-right">
                        <span className="font-mono text-[10.5px] font-semibold text-[#4A2E1B]">
                          {formatBytes(file.size)}
                        </span>
                        {st?.state === 'running' && (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#7A5230]" />
                        )}
                        {st?.state === 'success' && (
                          <span
                            title={st.message || 'Berhasil'}
                            className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-700 text-white"
                          >
                            <Check className="h-2.5 w-2.5" />
                          </span>
                        )}
                        {st?.state === 'error' && (
                          <AlertTriangle className="h-3.5 w-3.5 text-[#6E1D2C]" />
                        )}
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#4A2E1B]/12 bg-[#F4ECE0] px-5 py-3.5">
          <div className="flex items-center gap-2 font-mono text-[10.5px] text-[#4A2E1B]">
            <span className="inline-flex items-center gap-1 rounded-lg bg-white/80 px-2.5 py-1 font-semibold">
              {sourceAccount?.provider === 'b2' ? (
                <Cloud className="h-3 w-3 text-[#7A5230]" />
              ) : (
                <Database className="h-3 w-3 text-[#7A5230]" />
              )}
              <span>{selectedFiles.length} file dipilih</span>
              <span className="text-[#8A7360]">·</span>
              <span>{formatBytes(selectedBytes)}</span>
            </span>
            {targetAccount && (
              <span className="hidden items-center gap-1 text-[10px] text-[#6B5442] sm:inline-flex">
                <ArrowRight className="h-3 w-3" />
                <span>{targetAccount.name}</span>
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isRunning ? (
              <button
                type="button"
                disabled={isStopping}
                onClick={() => {
                  stopRequestedRef.current = true;
                  setIsStopping(true);
                }}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#6E1D2C] px-4 py-2 text-xs font-semibold text-[#FAF5EC] transition hover:bg-[#571622] disabled:opacity-60"
              >
                <StopCircle className="h-3.5 w-3.5" />
                <span>{isStopping ? 'Menghentikan...' : 'Hentikan Antrean'}</span>
              </button>
            ) : (
              <>
                {failedFiles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => void executeQueue(failedFiles)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-amber-800/30 bg-amber-500/18 px-3.5 py-2 text-xs font-semibold text-amber-950 transition hover:bg-amber-500/28"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Ulangi yang Gagal ({failedFiles.length})</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className="cursor-pointer rounded-xl border border-[#4A2E1B]/20 bg-white px-4 py-2 text-xs font-semibold text-[#4A2E1B] hover:bg-[#EFE5D5]"
                >
                  Tutup
                </button>

                <button
                  type="button"
                  disabled={
                    selectedFiles.length === 0 ||
                    !sourceAccount ||
                    !targetAccount ||
                    exceedsTargetQuota ||
                    loadingFiles
                  }
                  onClick={() => void executeQueue(selectedFiles)}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#4A2E1B] px-4 py-2 text-xs font-semibold text-[#FAF5EC] shadow-sm transition hover:bg-[#3A2213] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {mode === 'move' ? (
                    <FolderOutput className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  <span>
                    {mode === 'move'
                      ? `Pindahkan ${selectedFiles.length} File`
                      : `Salin ${selectedFiles.length} File`}
                  </span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}