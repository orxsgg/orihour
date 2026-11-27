'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  HardDrive,
  Cloud,
  Database,
  Plus,
  RefreshCw,
  Activity,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Edit3,
  Trash2,
  X,
  Save,
  Eye,
  EyeOff,
  Copy,
  Check,
  Power,
  Zap,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

export type StorageProvider = 'supabase' | 'b2';
export type StorageHealthStatus = 'ok' | 'warning' | 'full' | 'disabled';

export interface PublicStorageAccount {
  id: string;
  name: string;
  provider: StorageProvider;
  isActive: boolean;
  isEnabled: boolean;
  useEnvCredentials: boolean;
  priority: number;
  bucket: string;
  endpointUrl: string;
  publicBaseUrl: string;
  accessKeyId: string;
  hasSecret: boolean;
  secretPreview: string;
  quotaMb: number;
  usedBytes: number;
  fileCount: number;
  usagePct: number;
  remainingBytes: number;
  healthStatus: StorageHealthStatus;
  lastScannedAt: string | null;
  lastPingAt: string | null;
  lastPingStatus: string;
  createdAt: string;
}

export interface PublicStorageSettings {
  autoFailover: boolean;
  warnThresholdPct: number;
  fullThresholdPct: number;
  lastKeepaliveAt: string | null;
}

export interface StoragePoolOverview {
  accounts: PublicStorageAccount[];
  settings: PublicStorageSettings;
  activeAccountId: string | null;
  hasWarning: boolean;
  hasFull: boolean;
  warningMessage: string | null;
  warningSeverity: 'none' | 'warning' | 'full';
}

interface StoragePoolTabProps {
  overview: StoragePoolOverview | null;
  loading: boolean;
  onRefresh: () => Promise<void>;
  onOverviewUpdated: (next: StoragePoolOverview) => void;
}

interface AccountFormState {
  id?: string;
  useEnvCredentials?: boolean;
  name: string;
  provider: StorageProvider;
  bucket: string;
  endpointUrl: string;
  publicBaseUrl: string;
  accessKeyId: string;
  secret: string;
  quotaMb: number;
  priority: number;
  setAsActive: boolean;
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

function formatQuotaMb(mb: number): string {
  if (mb >= 1024) {
    const gb = mb / 1024;
    return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} GB`;
  }
  return `${mb} MB`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return 'Belum pernah';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function StoragePoolTab({
  overview,
  loading,
  onRefresh,
  onOverviewUpdated,
}: StoragePoolTabProps) {
  const [mounted, setMounted] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [autoFailover, setAutoFailover] = useState(true);
  const [warnPct, setWarnPct] = useState(80);
  const [fullPct, setFullPct] = useState(95);

  const [editing, setEditing] = useState<AccountFormState | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [savingForm, setSavingForm] = useState(false);

  const [showGuide, setShowGuide] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [confirmState, setConfirmState] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!overview) return;
    setAutoFailover(overview.settings.autoFailover);
    setWarnPct(overview.settings.warnThresholdPct);
    setFullPct(overview.settings.fullThresholdPct);
  }, [overview]);

  useEffect(() => {
    if (!editing) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [editing]);

  const flashSuccess = (msg: string) => {
    setErrorMsg(null);
    setStatusMsg(msg);
  };

  const flashError = (msg: string) => {
    setStatusMsg(null);
    setErrorMsg(msg);
  };

  const copyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // Ignore clipboard failures
    }
  };

  const handleSaveSettings = async () => {
    setBusyAction('settings');
    try {
      const res = await fetch('/api/admin/storage', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_settings',
          autoFailover,
          warnThresholdPct: warnPct,
          fullThresholdPct: fullPct,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan pengaturan penyimpanan.');
      onOverviewUpdated(data as StoragePoolOverview);
      flashSuccess('Pengaturan Auto-Failover & ambang peringatan berhasil disimpan.');
    } catch (err) {
      flashError(err instanceof Error ? err.message : 'Gagal menyimpan pengaturan.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleSetActive = async (acc: PublicStorageAccount) => {
    setBusyAction(`active-${acc.id}`);
    try {
      const res = await fetch('/api/admin/storage', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_active', id: acc.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal mengganti akun penyimpanan aktif.');
      onOverviewUpdated(data as StoragePoolOverview);
      flashSuccess(`"${acc.name}" sekarang menjadi penyimpanan aktif untuk unggahan baru.`);
    } catch (err) {
      flashError(err instanceof Error ? err.message : 'Gagal mengganti akun aktif.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleToggleEnabled = async (acc: PublicStorageAccount) => {
    setBusyAction(`toggle-${acc.id}`);
    try {
      const res = await fetch('/api/admin/storage', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_account',
          id: acc.id,
          isEnabled: !acc.isEnabled,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal mengubah status akun.');
      onOverviewUpdated(data as StoragePoolOverview);
      flashSuccess(
        !acc.isEnabled
          ? `Akun "${acc.name}" diaktifkan kembali.`
          : `Akun "${acc.name}" dinonaktifkan dari rotasi upload.`
      );
    } catch (err) {
      flashError(err instanceof Error ? err.message : 'Gagal mengubah status akun.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleScanUsage = async (accountId?: string) => {
    setBusyAction(accountId ? `scan-${accountId}` : 'scan-all');
    try {
      const res = await fetch('/api/admin/storage', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scan_usage', id: accountId || '' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal memindai kapasitas bucket.');
      onOverviewUpdated(data as StoragePoolOverview);
      const scanErrors = Array.isArray(data.scanErrors) ? (data.scanErrors as string[]) : [];
      if (scanErrors.length > 0) {
        flashError(`Sebagian akun gagal dipindai: ${scanErrors.join(' | ')}`);
      } else {
        flashSuccess(
          accountId
            ? 'Kapasitas real-time akun berhasil dipindai.'
            : 'Kapasitas seluruh akun penyimpanan berhasil dipindai.'
        );
      }
    } catch (err) {
      flashError(err instanceof Error ? err.message : 'Gagal memindai kapasitas.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleRunKeepAlive = async () => {
    setBusyAction('keep-alive');
    try {
      const res = await fetch('/api/cron/keep-alive', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Keep-Alive gagal dijalankan.');
      await onRefresh();
      flashSuccess(
        `Keep-Alive selesai: ${data.healthyCount ?? 0}/${data.pingedCount ?? 0} akun penyimpanan aktif & Database Utama ${
          data.primaryDatabase || 'Online'
        }.`
      );
    } catch (err) {
      flashError(err instanceof Error ? err.message : 'Gagal menjalankan Keep-Alive.');
    } finally {
      setBusyAction(null);
    }
  };

  const openAddModal = (provider: StorageProvider) => {
    setErrorMsg(null);
    setShowSecret(false);
    const nextPriority = (overview?.accounts.length || 1) + 1;
    setEditing({
      name:
        provider === 'b2'
          ? `Backblaze B2 #${nextPriority}`
          : `Supabase Cadangan #${nextPriority}`,
      provider,
      bucket: provider === 'b2' ? '' : 'orihour-media',
      endpointUrl: '',
      publicBaseUrl: '',
      accessKeyId: '',
      secret: '',
      quotaMb: provider === 'b2' ? 10240 : 1024,
      priority: nextPriority,
      setAsActive: false,
    });
  };

  const openEditModal = (acc: PublicStorageAccount) => {
    setErrorMsg(null);
    setShowSecret(false);
    setEditing({
      id: acc.id,
      useEnvCredentials: acc.useEnvCredentials,
      name: acc.name,
      provider: acc.provider,
      bucket: acc.bucket,
      endpointUrl: acc.endpointUrl,
      publicBaseUrl: acc.publicBaseUrl,
      accessKeyId: acc.accessKeyId,
      secret: '',
      quotaMb: acc.quotaMb,
      priority: acc.priority,
      setAsActive: acc.isActive,
    });
  };

  const handleSubmitAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;

    setSavingForm(true);
    setErrorMsg(null);
    try {
      if (editing.id) {
        const res = await fetch('/api/admin/storage', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_account',
            id: editing.id,
            name: editing.name,
            bucket: editing.bucket,
            endpointUrl: editing.endpointUrl,
            publicBaseUrl: editing.publicBaseUrl,
            accessKeyId: editing.accessKeyId,
            secret: editing.secret,
            quotaMb: editing.quotaMb,
            priority: editing.priority,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Gagal memperbarui akun penyimpanan.');
        onOverviewUpdated(data as StoragePoolOverview);
        setEditing(null);
        flashSuccess(`Akun "${editing.name}" berhasil diperbarui.`);
      } else {
        const res = await fetch('/api/admin/storage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editing),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Gagal menambahkan akun penyimpanan.');
        onOverviewUpdated(data as StoragePoolOverview);
        setEditing(null);
        flashSuccess(`Akun "${editing.name}" berhasil terhubung & diverifikasi.`);
      }
    } catch (err) {
      flashError(err instanceof Error ? err.message : 'Gagal menyimpan akun penyimpanan.');
    } finally {
      setSavingForm(false);
    }
  };

  const requestDeleteAccount = (acc: PublicStorageAccount) => {
    setConfirmState({
      title: `Hapus Akun "${acc.name}"?`,
      description:
        'Akun ini hanya akan dilepas dari daftar rotasi upload di Orihour. File yang sudah terunggah di dalam bucket tidak akan dihapus sehingga lagu/gambar lama tetap bisa diputar.',
      confirmLabel: 'Lepas Akun',
      onConfirm: async () => {
        setBusyAction(`del-${acc.id}`);
        try {
          const res = await fetch(
            `/api/admin/storage?id=${encodeURIComponent(acc.id)}`,
            { method: 'DELETE' }
          );
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || 'Gagal menghapus akun.');
          onOverviewUpdated(data as StoragePoolOverview);
          flashSuccess(`Akun "${acc.name}" telah dilepas dari daftar.`);
        } catch (err) {
          flashError(err instanceof Error ? err.message : 'Gagal menghapus akun.');
        } finally {
          setBusyAction(null);
          setConfirmState(null);
        }
      },
    });
  };

  const accounts = overview?.accounts || [];
  const totalQuotaMb = accounts
    .filter((a) => a.isEnabled)
    .reduce((sum, a) => sum + a.quotaMb, 0);
  const totalUsedBytes = accounts
    .filter((a) => a.isEnabled)
    .reduce((sum, a) => sum + a.usedBytes, 0);
  const activeAccount = accounts.find((a) => a.isActive) || null;
  const keepAliveEndpoint =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/cron/keep-alive`
      : 'https://orihour.vercel.app/api/cron/keep-alive';

  return (
    <div className="space-y-5">
      {statusMsg && (
        <div className="flex items-center justify-between gap-2 rounded-2xl border border-emerald-700/25 bg-emerald-500/12 px-4 py-3 text-xs font-semibold text-emerald-950">
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
            <span>{statusMsg}</span>
          </span>
          <button
            type="button"
            onClick={() => setStatusMsg(null)}
            className="cursor-pointer text-emerald-900/70 hover:text-emerald-950"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {errorMsg && !editing && (
        <div className="flex items-center justify-between gap-2 rounded-2xl border border-[#6E1D2C]/25 bg-[#6E1D2C]/10 px-4 py-3 text-xs font-semibold text-[#571622]">
          <span className="inline-flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-[#6E1D2C]" />
            <span>{errorMsg}</span>
          </span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="cursor-pointer text-[#6E1D2C]/70 hover:text-[#571622]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Top Summary Metrics */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[20px] border border-[#E5D7C3] bg-[#FAF5EC]/88 p-4 shadow-xs">
          <p className="font-mono text-[9.5px] font-semibold tracking-wider text-[#7A5230] uppercase">
            PENYIMPANAN AKTIF
          </p>
          <p className="mt-1 truncate font-serif text-xl text-[#241A13]">
            {activeAccount ? activeAccount.name : 'Belum dipilih'}
          </p>
          <p className="mt-0.5 font-mono text-[10px] text-[#6E5643]">
            {activeAccount
              ? `${activeAccount.provider === 'b2' ? 'Backblaze B2' : 'Supabase'} · ${
                  activeAccount.usagePct
                }% terpakai`
              : 'Pilih akun aktif di bawah'}
          </p>
        </div>

        <div className="rounded-[20px] border border-[#E5D7C3] bg-[#FAF5EC]/88 p-4 shadow-xs">
          <p className="font-mono text-[9.5px] font-semibold tracking-wider text-[#7A5230] uppercase">
            TOTAL KAPASITAS POOL
          </p>
          <p className="mt-1 font-serif text-xl text-[#241A13]">
            {formatBytes(totalUsedBytes)}{' '}
            <span className="font-sans text-xs font-medium text-[#7A624E]">
              / {formatQuotaMb(totalQuotaMb || 1024)}
            </span>
          </p>
          <p className="mt-0.5 font-mono text-[10px] text-[#6E5643]">
            {accounts.filter((a) => a.isEnabled).length} akun aktif dari {accounts.length} terdaftar
          </p>
        </div>

        <div className="rounded-[20px] border border-[#E5D7C3] bg-[#FAF5EC]/88 p-4 shadow-xs">
          <p className="font-mono text-[9.5px] font-semibold tracking-wider text-[#7A5230] uppercase">
            MODE FAILOVER OTOMATIS
          </p>
          <p className="mt-1 font-serif text-xl text-[#241A13]">
            {autoFailover ? 'Aktif (Otomatis)' : 'Manual'}
          </p>
          <p className="mt-0.5 font-mono text-[10px] text-[#6E5643]">
            Peringatan ≥{warnPct}% · Penuh ≥{fullPct}%
          </p>
        </div>

        <div className="rounded-[20px] border border-[#E5D7C3] bg-[#FAF5EC]/88 p-4 shadow-xs">
          <p className="font-mono text-[9.5px] font-semibold tracking-wider text-[#7A5230] uppercase">
            ANTI AUTO-PAUSE (CRON)
          </p>
          <p className="mt-1 font-serif text-xl text-[#241A13]">
            {formatDateTime(overview?.settings.lastKeepaliveAt || null)}
          </p>
          <p className="mt-0.5 font-mono text-[10px] text-[#6E5643]">
            Menjaga Supabase Free Tier tetap aktif
          </p>
        </div>
      </div>

      {/* Action Toolbar + Auto-Failover & Threshold Settings */}
      <div className="space-y-4 rounded-[22px] border border-[#E5D7C3] bg-[#FAF5EC]/88 p-4 shadow-xs backdrop-blur-xl sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div>
            <h2 className="font-serif text-2xl leading-tight text-[#241A13]">
              Multi-Storage Pool (Supabase &amp; Backblaze B2)
            </h2>
            <p className="mt-0.5 text-xs text-[#655040]">
              Database utama tetap satu, sedangkan file audio MP3 dan cover dibagi otomatis ke akun penyimpanan yang masih longgar.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => openAddModal('supabase')}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#4A2E1B]/22 bg-white px-3.5 py-2 text-xs font-semibold text-[#4A2E1B] transition hover:bg-[#EFE4D3]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Tambah Supabase</span>
            </button>

            <button
              type="button"
              onClick={() => openAddModal('b2')}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#4A2E1B] px-3.5 py-2 text-xs font-semibold text-[#FAF5EC] shadow-xs transition hover:bg-[#3A2213]"
            >
              <Cloud className="h-3.5 w-3.5" />
              <span>Tambah Backblaze B2</span>
            </button>
          </div>
        </div>

        {/* Settings Row */}
        <div className="grid grid-cols-1 items-end gap-3 border-t border-[#4A2E1B]/10 pt-4 md:grid-cols-12">
          <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-[#4A2E1B]/15 bg-white/85 px-3.5 py-2.5 md:col-span-5">
            <input
              type="checkbox"
              checked={autoFailover}
              onChange={(e) => setAutoFailover(e.target.checked)}
              className="h-4 w-4 accent-[#4A2E1B]"
            />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#241A13]">
                Auto-Failover ke Akun Cadangan
              </p>
              <p className="text-[10.5px] text-[#6B5442]">
                Pindah otomatis ke akun prioritas berikutnya saat akun aktif penuh.
              </p>
            </div>
          </label>

          <div className="flex flex-col gap-1 md:col-span-2">
            <label className="font-mono text-[9.5px] font-semibold tracking-wider text-[#5C4432] uppercase">
              Peringatan (%)
            </label>
            <input
              type="number"
              min={30}
              max={95}
              value={warnPct}
              onChange={(e) => setWarnPct(parseInt(e.target.value, 10) || 80)}
              className="h-[38px] rounded-xl border border-[#4A2E1B]/18 bg-white px-3 font-mono text-xs text-[#241A13] outline-none focus:border-[#4A2E1B]"
            />
          </div>

          <div className="flex flex-col gap-1 md:col-span-2">
            <label className="font-mono text-[9.5px] font-semibold tracking-wider text-[#5C4432] uppercase">
              Batas Penuh (%)
            </label>
            <input
              type="number"
              min={50}
              max={100}
              value={fullPct}
              onChange={(e) => setFullPct(parseInt(e.target.value, 10) || 95)}
              className="h-[38px] rounded-xl border border-[#4A2E1B]/18 bg-white px-3 font-mono text-xs text-[#241A13] outline-none focus:border-[#4A2E1B]"
            />
          </div>

          <div className="flex flex-wrap gap-2 md:col-span-3 md:justify-end">
            <button
              type="button"
              disabled={busyAction === 'settings'}
              onClick={() => void handleSaveSettings()}
              className="inline-flex h-[38px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#4A2E1B] px-3.5 text-xs font-semibold text-[#FAF5EC] transition hover:bg-[#3A2213] disabled:opacity-50 md:flex-none"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{busyAction === 'settings' ? 'Menyimpan...' : 'Simpan Aturan'}</span>
            </button>
          </div>
        </div>

        {/* Utility Buttons Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#4A2E1B]/10 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busyAction === 'scan-all' || loading}
              onClick={() => void handleScanUsage()}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#4A2E1B]/20 bg-white px-3 py-1.5 text-xs font-semibold text-[#4A2E1B] transition hover:bg-[#EFE4D3] disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${busyAction === 'scan-all' ? 'animate-spin' : ''}`}
              />
              <span>
                {busyAction === 'scan-all' ? 'Memindai...' : 'Scan Real Usage Semua Akun'}
              </span>
            </button>

            <button
              type="button"
              disabled={busyAction === 'keep-alive'}
              onClick={() => void handleRunKeepAlive()}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#4A2E1B]/20 bg-[#FFF6E6] px-3 py-1.5 text-xs font-semibold text-[#4A2E1B] transition hover:bg-[#F2E2C4] disabled:opacity-50"
            >
              <Activity
                className={`h-3.5 w-3.5 ${busyAction === 'keep-alive' ? 'animate-pulse' : ''}`}
              />
              <span>
                {busyAction === 'keep-alive' ? 'Menyapa Akun...' : 'Test Keep-Alive Sekarang'}
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowGuide((prev) => !prev)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#4A2E1B]/16 bg-white/80 px-3 py-1.5 text-xs font-semibold text-[#5C4432] transition hover:bg-white"
          >
            <HelpCircle className="h-3.5 w-3.5 text-[#7A5230]" />
            <span>Panduan Backblaze B2 &amp; Cron</span>
            {showGuide ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        {/* Expandable Setup Guide for Backblaze B2 & Cron Keep-Alive */}
        {showGuide && (
          <div className="grid grid-cols-1 gap-4 rounded-2xl border border-[#4A2E1B]/14 bg-white/88 p-4 text-xs text-[#3A2B20] lg:grid-cols-2">
            <div className="space-y-2">
              <p className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-wider text-[#7A5230] uppercase">
                <Cloud className="h-3.5 w-3.5" />
                SETUP BACKBLAZE B2 (10 GB GRATIS, TANPA KARTU KREDIT)
              </p>
              <ol className="list-decimal space-y-1.5 pl-4 text-[11.5px] leading-relaxed">
                <li>
                  Daftar akun gratis di <strong>backblaze.com/cloud-storage</strong> (cukup verifikasi email &amp; nomor HP, tidak perlu kartu kredit).
                </li>
                <li>
                  Buka menu <strong>Buckets → Create a Bucket</strong>. Buat nama bucket unik (misal <code>orihour-media-01</code>), lalu wajib pilih <strong>Files in Bucket are: Public</strong>. Salin <strong>Endpoint</strong> yang tampil di kartu bucket (contoh: <code>s3.us-west-004.backblazeb2.com</code>).
                </li>
                <li>
                  Di kartu bucket tersebut, klik <strong>CORS Rules</strong> → pilih <strong>Share everything in this bucket with every origin</strong> → centang <strong>S3 Compatible API</strong> → klik <strong>Update CORS Rules</strong>.
                </li>
                <li>
                  Buka menu kiri <strong>Application Keys → Add a New Application Key</strong>: pilih bucket kamu, set <strong>Type of Access: Read and Write</strong>, lalu klik <strong>Create New Key</strong>.
                </li>
                <li>
                  Langsung salin <strong>keyID</strong> dan <strong>applicationKey</strong> (hanya tampil sekali), lalu masukkan ke form <strong>Tambah Backblaze B2</strong>.
                </li>
              </ol>
            </div>

            <div className="space-y-2">
              <p className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-wider text-[#7A5230] uppercase">
                <Activity className="h-3.5 w-3.5" />
                SETUP CRON JOB KEEP-ALIVE (ANTI AUTO-PAUSE 7 HARI)
              </p>
              <p className="text-[11.5px] leading-relaxed">
                Supabase Free Tier akan otomatis tidur setelah 7 hari tanpa aktivitas (sedangkan Backblaze B2 tidak pernah auto-pause). Endpoint di bawah otomatis menyapa Database Utama dan seluruh akun terdaftar:
              </p>
              <div className="flex items-center justify-between gap-2 rounded-xl border border-[#4A2E1B]/15 bg-[#FAF5EC] px-3 py-2 font-mono text-[10.5px] text-[#241A13]">
                <span className="truncate">{keepAliveEndpoint}</span>
                <button
                  type="button"
                  onClick={() => void copyText('cron-url', keepAliveEndpoint)}
                  className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg bg-[#4A2E1B] px-2 py-1 text-[9.5px] font-semibold text-[#FAF5EC] hover:bg-[#3A2213]"
                >
                  {copiedKey === 'cron-url' ? (
                    <>
                      <Check className="h-3 w-3" />
                      <span>Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Salin URL</span>
                    </>
                  )}
                </button>
              </div>
              <ol className="list-decimal space-y-1 pl-4 text-[11.5px] leading-relaxed">
                <li>
                  Pastikan Environment Variable <code>CRON_SECRET</code> sudah dipasang di <strong>Vercel → Settings → Environment Variables</strong>.
                </li>
                <li>
                  Di GitHub repo Orihour → <strong>Settings → Secrets and variables → Actions</strong>, pastikan secret <code>CRON_SECRET</code> dan <code>ORIHOUR_APP_URL</code> sudah tersimpan.
                </li>
                <li>
                  Workflow <code>.github/workflows/keep-alive.yml</code> otomatis berjalan tiap 3 hari sekali.
                </li>
              </ol>
            </div>
          </div>
        )}
      </div>

      {/* Storage Accounts List */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {accounts.map((acc) => {
          const clampedPct = Math.min(100, Math.max(0, acc.usagePct));
          const barColor =
            acc.healthStatus === 'full'
              ? 'bg-[#8F1D2C]'
              : acc.healthStatus === 'warning'
              ? 'bg-amber-600'
              : acc.healthStatus === 'disabled'
              ? 'bg-[#8A7360]/50'
              : 'bg-emerald-700';

          const statusBadge =
            acc.healthStatus === 'full'
              ? {
                  label: 'PENUH',
                  cls: 'bg-[#6E1D2C]/15 text-[#6E1D2C] border-[#6E1D2C]/25',
                }
              : acc.healthStatus === 'warning'
              ? {
                  label: 'HAMPIR PENUH',
                  cls: 'bg-amber-500/18 text-amber-950 border-amber-700/25',
                }
              : acc.healthStatus === 'disabled'
              ? {
                  label: 'NONAKTIF',
                  cls: 'bg-[#4A2E1B]/10 text-[#6E5643] border-[#4A2E1B]/15',
                }
              : {
                  label: 'AMAN',
                  cls: 'bg-emerald-600/14 text-emerald-900 border-emerald-700/20',
                };

          return (
            <article
              key={acc.id}
              className={`flex flex-col justify-between rounded-[22px] border p-4 shadow-xs backdrop-blur-xl transition sm:p-5 ${
                acc.isActive
                  ? 'border-[#4A2E1B] bg-[#FFFDF8] ring-1 ring-[#4A2E1B]/20'
                  : 'border-[#E5D7C3] bg-[#FAF5EC]/88'
              }`}
            >
              <div>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        acc.provider === 'b2'
                          ? 'bg-[#C89B54]/25 text-[#5C3B14]'
                          : 'bg-[#4A2E1B]/12 text-[#4A2E1B]'
                      }`}
                    >
                      {acc.provider === 'b2' ? (
                        <Cloud className="h-5 w-5" />
                      ) : (
                        <Database className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="truncate font-serif text-xl leading-tight text-[#241A13]">
                          {acc.name}
                        </h3>
                        {acc.isActive && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#4A2E1B] px-2 py-0.5 font-mono text-[9px] font-semibold text-[#FAF5EC] uppercase">
                            <Zap className="h-2.5 w-2.5 text-[#E6C79C]" />
                            AKTIF
                          </span>
                        )}
                      </div>
                      <p className="truncate font-mono text-[10px] text-[#7A624E]">
                        {acc.provider === 'b2' ? 'Backblaze B2' : 'Supabase Storage'} · Bucket:{' '}
                        <strong>{acc.bucket}</strong> · Prioritas #{acc.priority}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-0.5 font-mono text-[9.5px] font-bold uppercase ${statusBadge.cls}`}
                  >
                    {statusBadge.label}
                  </span>
                </div>

                {/* Usage Progress Bar */}
                <div className="mt-4 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#241A13]">
                      {formatBytes(acc.usedBytes)}{' '}
                      <span className="font-normal text-[#7A624E]">
                        dari {formatQuotaMb(acc.quotaMb)}
                      </span>
                    </span>
                    <span className="font-mono text-[11px] font-bold text-[#4A2E1B]">
                      {acc.usagePct}%
                    </span>
                  </div>

                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#4A2E1B]/12">
                    <div
                      className={`h-full rounded-full transition-[width] duration-300 ${barColor}`}
                      style={{ width: `${clampedPct}%` }}
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] text-[#7A624E]">
                    <span>
                      Sisa: {formatBytes(acc.remainingBytes)} · {acc.fileCount} file
                    </span>
                    <span>Scan: {formatDateTime(acc.lastScannedAt)}</span>
                  </div>
                </div>

                {/* Metadata & Ping Status */}
                <div className="mt-3 space-y-1 rounded-xl border border-[#4A2E1B]/10 bg-white/80 px-3 py-2 font-mono text-[10px] text-[#5C4432]">
                  <p className="truncate">
                    <span className="text-[#8A7360]">Endpoint:</span>{' '}
                    {acc.endpointUrl || '-'}
                  </p>
                  {acc.provider === 'b2' && (
                    <p className="truncate">
                      <span className="text-[#8A7360]">Public URL:</span>{' '}
                      {acc.publicBaseUrl || '-'}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3 text-emerald-700" />
                      Kunci: {acc.secretPreview || 'Tersimpan Terenkripsi'}
                    </span>
                    <span>
                      Ping: <strong>{acc.lastPingStatus}</strong> ({formatDateTime(acc.lastPingAt)})
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Actions */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#4A2E1B]/10 pt-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {!acc.isActive && (
                    <button
                      type="button"
                      disabled={busyAction === `active-${acc.id}`}
                      onClick={() => void handleSetActive(acc)}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-[#4A2E1B] px-2.5 py-1.5 text-[11px] font-semibold text-[#FAF5EC] transition hover:bg-[#3A2213] disabled:opacity-50"
                    >
                      <Zap className="h-3 w-3" />
                      <span>Jadikan Aktif</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={busyAction === `scan-${acc.id}`}
                    onClick={() => void handleScanUsage(acc.id)}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#4A2E1B]/20 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#4A2E1B] transition hover:bg-[#EFE4D3] disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`h-3 w-3 ${
                        busyAction === `scan-${acc.id}` ? 'animate-spin' : ''
                      }`}
                    />
                    <span>Scan</span>
                  </button>

                  <button
                    type="button"
                    disabled={busyAction === `toggle-${acc.id}`}
                    onClick={() => void handleToggleEnabled(acc)}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#4A2E1B]/18 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#5C4432] transition hover:bg-[#EFE4D3] disabled:opacity-50"
                    title={acc.isEnabled ? 'Nonaktifkan sementara' : 'Aktifkan akun'}
                  >
                    <Power className="h-3 w-3" />
                    <span>{acc.isEnabled ? 'Nonaktifkan' : 'Aktifkan'}</span>
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEditModal(acc)}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#4A2E1B]/18 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#3A2213] transition hover:border-[#4A2E1B] hover:bg-[#4A2E1B] hover:text-[#FAF5EC]"
                  >
                    <Edit3 className="h-3 w-3" />
                    <span>Edit</span>
                  </button>

                  {!acc.useEnvCredentials && (
                    <button
                      type="button"
                      disabled={busyAction === `del-${acc.id}`}
                      onClick={() => requestDeleteAccount(acc)}
                      className="cursor-pointer rounded-lg border border-[#4A2E1B]/14 bg-white p-1.5 text-[#8A7360] transition hover:border-[#6E1D2C]/40 hover:bg-[#6E1D2C]/10 hover:text-[#6E1D2C] disabled:opacity-45"
                      title="Lepas akun dari daftar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Add / Edit Storage Account Modal (Portal at z-[90]) */}
      {editing &&
        mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-[#18110C]/62 p-3 backdrop-blur-md sm:p-4"
            onClick={() => {
              if (!savingForm) setEditing(null);
            }}
          >
            <form
              onSubmit={handleSubmitAccount}
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-[24px] border border-[#E7DAC7] bg-[#FAF5EC] text-[#241A13] shadow-2xl"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-[#4A2E1B]/12 bg-[#F4ECE0] px-5 py-4">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-[#4A2E1B]" />
                  <h3 className="font-serif text-xl text-[#241A13]">
                    {editing.id
                      ? `Edit Akun (${editing.provider === 'b2' ? 'Backblaze B2' : 'Supabase'})`
                      : 'Tambah Akun Penyimpanan Baru'}
                  </h3>
                </div>
                <button
                  type="button"
                  disabled={savingForm}
                  onClick={() => setEditing(null)}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[#4A2E1B]/15 bg-[#FAF5EC] text-[#4A2E1B] hover:bg-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="orihour-scroll flex-1 space-y-4 overflow-y-auto p-5">
                {/* Provider Selector (on Create) */}
                {!editing.id && (
                  <div>
                    <span className="block font-mono text-[10px] font-semibold tracking-wider text-[#5C4432] uppercase">
                      Penyedia Penyimpanan *
                    </span>
                    <div className="mt-1.5 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setEditing({
                            ...editing,
                            provider: 'supabase',
                            bucket: editing.bucket || 'orihour-media',
                            quotaMb: 1024,
                          })
                        }
                        className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${
                          editing.provider === 'supabase'
                            ? 'border-[#4A2E1B] bg-[#4A2E1B] text-[#FAF5EC]'
                            : 'border-[#4A2E1B]/18 bg-white text-[#4A2E1B] hover:bg-[#FAF5EC]'
                        }`}
                      >
                        <Database className="h-4 w-4" />
                        <span>Supabase Storage (1 GB)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setEditing({
                            ...editing,
                            provider: 'b2',
                            bucket:
                              editing.bucket === 'orihour-media' ? '' : editing.bucket,
                            quotaMb: 10240,
                          })
                        }
                        className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${
                          editing.provider === 'b2'
                            ? 'border-[#4A2E1B] bg-[#4A2E1B] text-[#FAF5EC]'
                            : 'border-[#4A2E1B]/18 bg-white text-[#4A2E1B] hover:bg-[#FAF5EC]'
                        }`}
                      >
                        <Cloud className="h-4 w-4" />
                        <span>Backblaze B2 (10 GB)</span>
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <label className="font-mono text-[10px] font-semibold tracking-wider text-[#5C4432] uppercase">
                      Nama Label Akun *
                    </label>
                    <input
                      type="text"
                      required
                      value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                      placeholder="e.g. Backblaze B2 Utama"
                      className="h-[36px] rounded-xl border border-[#4A2E1B]/18 bg-white px-3 text-xs text-[#241A13] outline-none focus:border-[#4A2E1B]"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-mono text-[10px] font-semibold tracking-wider text-[#5C4432] uppercase">
                      Nama Bucket *
                    </label>
                    <input
                      type="text"
                      required
                      disabled={Boolean(editing.useEnvCredentials)}
                      value={editing.bucket}
                      onChange={(e) => setEditing({ ...editing, bucket: e.target.value })}
                      placeholder={
                        editing.provider === 'b2' ? 'orihour-media-01' : 'orihour-media'
                      }
                      className="h-[36px] rounded-xl border border-[#4A2E1B]/18 bg-white px-3 font-mono text-xs text-[#241A13] outline-none focus:border-[#4A2E1B] disabled:bg-[#EFE7DA]"
                    />
                  </div>
                </div>

                {!editing.useEnvCredentials && (
                  <>
                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-[10px] font-semibold tracking-wider text-[#5C4432] uppercase">
                        {editing.provider === 'b2'
                          ? 'S3 Endpoint Backblaze B2 *'
                          : 'Project URL Supabase *'}
                      </label>
                      <input
                        type="text"
                        required
                        value={editing.endpointUrl}
                        onChange={(e) =>
                          setEditing({ ...editing, endpointUrl: e.target.value })
                        }
                        placeholder={
                          editing.provider === 'b2'
                            ? 's3.us-west-004.backblazeb2.com'
                            : 'https://xxxxxxxxxxxx.supabase.co'
                        }
                        className="h-[36px] rounded-xl border border-[#4A2E1B]/18 bg-white px-3 font-mono text-xs text-[#241A13] outline-none focus:border-[#4A2E1B]"
                      />
                      {editing.provider === 'b2' && (
                        <p className="text-[10.5px] text-[#7A624E]">
                          Salin dari kolom <strong>Endpoint</strong> di kartu bucket Backblaze B2 (region terdeteksi otomatis).
                        </p>
                      )}
                    </div>

                    {editing.provider === 'b2' && (
                      <>
                        <div className="flex flex-col gap-1">
                          <label className="font-mono text-[10px] font-semibold tracking-wider text-[#5C4432] uppercase">
                            Public URL Kustom (Opsional)
                          </label>
                          <input
                            type="url"
                            value={editing.publicBaseUrl}
                            onChange={(e) =>
                              setEditing({ ...editing, publicBaseUrl: e.target.value })
                            }
                            placeholder="Kosongkan untuk otomatis (https://s3.<region>.backblazeb2.com/<bucket>)"
                            className="h-[36px] rounded-xl border border-[#4A2E1B]/18 bg-white px-3 font-mono text-xs text-[#241A13] outline-none focus:border-[#4A2E1B]"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="font-mono text-[10px] font-semibold tracking-wider text-[#5C4432] uppercase">
                            Backblaze Key ID (keyID) *
                          </label>
                          <input
                            type="text"
                            required
                            value={editing.accessKeyId}
                            onChange={(e) =>
                              setEditing({ ...editing, accessKeyId: e.target.value })
                            }
                            placeholder="Tempel keyID dari Application Key Backblaze..."
                            className="h-[36px] rounded-xl border border-[#4A2E1B]/18 bg-white px-3 font-mono text-xs text-[#241A13] outline-none focus:border-[#4A2E1B]"
                          />
                        </div>
                      </>
                    )}

                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-[10px] font-semibold tracking-wider text-[#5C4432] uppercase">
                        {editing.provider === 'b2'
                          ? 'Backblaze Application Key (applicationKey)'
                          : 'Supabase Service Role Key'}{' '}
                        {editing.id ? '(Kosongkan Jika Tidak Diubah)' : '*'}
                      </label>
                      <div className="relative">
                        <input
                          type={showSecret ? 'text' : 'password'}
                          required={!editing.id}
                          value={editing.secret}
                          onChange={(e) =>
                            setEditing({ ...editing, secret: e.target.value })
                          }
                          placeholder={
                            editing.id
                              ? 'Biarkan kosong untuk tetap memakai kunci lama...'
                              : editing.provider === 'b2'
                              ? 'Tempel applicationKey Backblaze B2...'
                              : 'eyJhbGciOiJIUzI1NiIsInR5cCI6...'
                          }
                          className="h-[36px] w-full rounded-xl border border-[#4A2E1B]/18 bg-white pr-10 pl-3 font-mono text-xs text-[#241A13] outline-none focus:border-[#4A2E1B]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSecret((prev) => !prev)}
                          className="absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer text-[#7A624E] hover:text-[#241A13]"
                          aria-label={showSecret ? 'Sembunyikan kunci' : 'Tampilkan kunci'}
                        >
                          {showSecret ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      <p className="text-[10.5px] text-[#7A624E]">
                        Kunci dienkripsi AES-256-GCM di server dan tidak pernah dikirim kembali ke browser pengunjung.
                      </p>
                    </div>
                  </>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="font-mono text-[10px] font-semibold tracking-wider text-[#5C4432] uppercase">
                      Batas Kuota (MB) *
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={1048576}
                      required
                      value={editing.quotaMb}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          quotaMb: parseInt(e.target.value, 10) || 1024,
                        })
                      }
                      className="h-[36px] rounded-xl border border-[#4A2E1B]/18 bg-white px-3 font-mono text-xs text-[#241A13] outline-none focus:border-[#4A2E1B]"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-mono text-[10px] font-semibold tracking-wider text-[#5C4432] uppercase">
                      Prioritas Failover *
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={999}
                      required
                      value={editing.priority}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          priority: parseInt(e.target.value, 10) || 10,
                        })
                      }
                      className="h-[36px] rounded-xl border border-[#4A2E1B]/18 bg-white px-3 font-mono text-xs text-[#241A13] outline-none focus:border-[#4A2E1B]"
                    />
                  </div>
                </div>

                {!editing.id && (
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#4A2E1B]/14 bg-white/85 px-3 py-2.5 text-xs text-[#241A13]">
                    <input
                      type="checkbox"
                      checked={editing.setAsActive}
                      onChange={(e) =>
                        setEditing({ ...editing, setAsActive: e.target.checked })
                      }
                      className="h-4 w-4 accent-[#4A2E1B]"
                    />
                    <span>Langsung jadikan penyimpanan aktif untuk unggahan berikutnya</span>
                  </label>
                )}

                {errorMsg && (
                  <div className="flex items-center gap-2 rounded-xl border border-[#6E1D2C]/25 bg-[#6E1D2C]/10 px-3.5 py-2.5 text-xs font-semibold text-[#571622]">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-[#6E1D2C]" />
                    <span>{errorMsg}</span>
                  </div>
                )}
              </div>

              <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#4A2E1B]/12 bg-[#F4ECE0] px-5 py-3.5">
                <button
                  type="button"
                  disabled={savingForm}
                  onClick={() => setEditing(null)}
                  className="cursor-pointer rounded-xl border border-[#4A2E1B]/20 bg-white px-4 py-2 text-xs font-semibold text-[#4A2E1B] hover:bg-[#EFE5D5]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingForm}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#4A2E1B] px-4 py-2 text-xs font-semibold text-[#FAF5EC] shadow-sm transition hover:bg-[#3A2213] disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>
                    {savingForm
                      ? editing.id
                        ? 'Menyimpan...'
                        : 'Memverifikasi & Menyimpan...'
                      : 'Simpan Akun'}
                  </span>
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

      <ConfirmDialog
        open={Boolean(confirmState)}
        title={confirmState?.title || ''}
        description={confirmState?.description || ''}
        confirmLabel={confirmState?.confirmLabel || 'Hapus'}
        busy={Boolean(busyAction)}
        onCancel={() => setConfirmState(null)}
        onConfirm={() => {
          if (confirmState) void confirmState.onConfirm();
        }}
      />
    </div>
  );
}