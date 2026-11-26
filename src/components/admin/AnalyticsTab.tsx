'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Users,
  Eye,
  MapPin,
  Globe,
  Monitor,
  Smartphone,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Compass,
  CloudSun,
  CheckSquare,
  Square,
} from 'lucide-react';
import { AnalyticsBucket, AnalyticsDashboardData } from '@/types/orihour';
import ThemedDropdown, { DropdownOption } from '@/components/ui/ThemedDropdown';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

const RANGE_OPTIONS: DropdownOption[] = [
  { value: '7', label: '7 Hari Terakhir' },
  { value: '30', label: '30 Hari Terakhir' },
  { value: '90', label: '90 Hari Terakhir' },
  { value: 'all', label: 'Semua Waktu' },
];

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function BreakdownCard({
  title,
  icon,
  items,
  emptyLabel = 'Belum ada data tercatat.',
}: {
  title: string;
  icon: React.ReactNode;
  items: AnalyticsBucket[];
  emptyLabel?: string;
}) {
  return (
    <div className="rounded-[22px] border border-[#E5D7C3] bg-[#FAF5EC]/88 p-5 shadow-xs backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#4A2E1B]/10 text-[#4A2E1B]">
          {icon}
        </span>
        <h3 className="font-mono text-[10.5px] font-bold tracking-[0.14em] text-[#5C4432] uppercase">
          {title}
        </h3>
      </div>

      {items.length === 0 ? (
        <p className="mt-4 py-4 text-center font-mono text-[11px] text-[#8A7360]">
          {emptyLabel}
        </p>
      ) : (
        <div className="mt-4 space-y-2.5">
          {items.map((item, idx) => (
            <div key={`${item.name}-${idx}`} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <span className="font-semibold text-[#241A13]">{item.name}</span>
                  {item.sublabel && (
                    <span className="ml-1.5 font-mono text-[10px] text-[#7A624E]">
                      {item.sublabel}
                    </span>
                  )}
                </div>
                <span className="shrink-0 font-mono text-[10.5px] font-semibold text-[#5C4432]">
                  {item.count}{' '}
                  <span className="font-normal text-[#8A7360]">({item.pct}%)</span>
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#4A2E1B]/10">
                <div
                  className="h-full rounded-full bg-[#4A2E1B] transition-all duration-300"
                  style={{ width: `${Math.max(4, item.pct)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AnalyticsTab() {
  const [range, setRange] = useState<string>('30');
  const [data, setData] = useState<AnalyticsDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const [confirmState, setConfirmState] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  const showToast = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3200);
  };

  const fetchAnalytics = useCallback(async (daysVal: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/admin/analytics?days=${encodeURIComponent(daysVal)}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Gagal memuat analitik.');
      }
      setData(json as AnalyticsDashboardData);
      setSelectedIds(new Set());
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat analitik.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics(range);
  }, [range, fetchAnalytics]);

  const logs = data?.recentLogs ?? [];
  const allSelected = logs.length > 0 && selectedIds.size === logs.length;

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(logs.map((l) => l.id)));
    }
  };

  const requestDeleteSelected = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    setConfirmState({
      title: `Hapus ${ids.length} Log Kunjungan?`,
      description: `Sebanyak ${ids.length} riwayat kunjungan terpilih akan dihapus secara permanen dari statistik analitik.`,
      confirmLabel: `Hapus (${ids.length})`,
      onConfirm: async () => {
        setDeleting(true);
        setErrorMsg(null);
        try {
          const res = await fetch('/api/admin/analytics', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids }),
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(json.error || 'Gagal menghapus log.');
          showToast(`${ids.length} log kunjungan berhasil dihapus.`);
          await fetchAnalytics(range);
        } catch (err) {
          setErrorMsg(err instanceof Error ? err.message : 'Gagal menghapus log.');
        } finally {
          setDeleting(false);
          setConfirmState(null);
        }
      },
    });
  };

  const requestDeleteSingle = (id: string, city: string) => {
    setConfirmState({
      title: 'Hapus Log Kunjungan?',
      description: `Log kunjungan dari ${city} akan dihapus secara permanen dari riwayat analitik.`,
      confirmLabel: 'Hapus Log',
      onConfirm: async () => {
        setDeleting(true);
        setErrorMsg(null);
        try {
          const res = await fetch(`/api/admin/analytics?id=${encodeURIComponent(id)}`, {
            method: 'DELETE',
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(json.error || 'Gagal menghapus log.');
          showToast('Log kunjungan dihapus.');
          await fetchAnalytics(range);
        } catch (err) {
          setErrorMsg(err instanceof Error ? err.message : 'Gagal menghapus log.');
        } finally {
          setDeleting(false);
          setConfirmState(null);
        }
      },
    });
  };

  const requestClearAll = () => {
    setConfirmState({
      title: 'Bersihkan Semua Riwayat Analitik?',
      description:
        'Seluruh data kunjungan, statistik kota/negara, dan grafik analitik akan dihapus permanen dan direset dari nol.',
      confirmLabel: 'Bersihkan Semua',
      onConfirm: async () => {
        setDeleting(true);
        setErrorMsg(null);
        try {
          const res = await fetch('/api/admin/analytics', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clearAll: true }),
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(json.error || 'Gagal membersihkan log.');
          showToast('Seluruh riwayat analitik berhasil dibersihkan.');
          await fetchAnalytics(range);
        } catch (err) {
          setErrorMsg(err instanceof Error ? err.message : 'Gagal membersihkan log.');
        } finally {
          setDeleting(false);
          setConfirmState(null);
        }
      },
    });
  };

  const maxDailyVisits = useMemo(() => {
    if (!data?.dailySeries?.length) return 1;
    return Math.max(1, ...data.dailySeries.map((d) => d.visits));
  }, [data?.dailySeries]);

  return (
    <div className="space-y-5">
      {feedback && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-700/25 bg-emerald-500/12 px-4 py-3 text-xs font-semibold text-emerald-950">
          <CheckCircle2 className="h-4 w-4 text-emerald-700" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Header & Range Filter */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-[#E5D7C3] bg-[#FAF5EC]/88 p-5 shadow-sm backdrop-blur-xl">
        <div>
          <p className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-[0.16em] text-[#7A5230] uppercase">
            <BarChart3 className="h-3.5 w-3.5" />
            VISITOR ANALYTICS &amp; REGION INSIGHTS
          </p>
          <h2 className="mt-1 font-serif text-2xl text-[#241A13]">
            Analitik Pengunjung &amp; Daerah
          </h2>
          <p className="mt-0.5 text-xs text-[#655040]">
            Statistik kunjungan, persebaran kota/negara, perangkat, browser, sumber kunjungan, dan mode ruangan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ThemedDropdown
            value={range}
            options={RANGE_OPTIONS}
            onChange={setRange}
            ariaLabel="Rentang waktu analitik"
            size="sm"
            className="w-44"
          />
          <button
            type="button"
            disabled={loading}
            onClick={() => fetchAnalytics(range)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#4A2E1B]/20 bg-white px-3.5 py-2 text-xs font-semibold text-[#4A2E1B] transition hover:bg-[#EFE4D3] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Muat Ulang</span>
          </button>
        </div>
      </section>

      {errorMsg && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-[#6E1D2C]/25 bg-[#6E1D2C]/10 px-4 py-3 text-xs font-semibold text-[#571622]">
          <AlertTriangle className="h-4 w-4 shrink-0 text-[#6E1D2C]" />
          <span>{errorMsg}</span>
        </div>
      )}

      {data?.tableMissing && (
        <div className="rounded-2xl border border-[#B58A52]/45 bg-[#FFF9ED] p-5 text-xs text-[#3A2213]">
          <p className="font-mono text-[10.5px] font-bold tracking-wider text-[#7A5230] uppercase">
            TABEL SUPABASE BELUM DIBUAT
          </p>
          <p className="mt-1.5 leading-relaxed">
            Tabel <code className="rounded bg-[#4A2E1B]/10 px-1.5 py-0.5 font-mono">public.visitor_logs</code> belum ditemukan di Supabase. Jalankan skrip SQL pembuatan tabel <code className="font-mono">visitor_logs</code> di Supabase SQL Editor, lalu klik <strong>Muat Ulang</strong>.
          </p>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {[
          {
            label: 'Total Kunjungan',
            value: data ? String(data.summary.totalVisits) : '—',
            sub: data ? `${data.summary.last7DaysVisits} dlm 7 hari terakhir` : '',
            icon: <Eye className="h-4 w-4" />,
          },
          {
            label: 'Pengunjung Unik',
            value: data ? String(data.summary.uniqueVisitors) : '—',
            sub: data ? `${data.summary.todayVisits} kunjungan hari ini` : '',
            icon: <Users className="h-4 w-4" />,
          },
          {
            label: 'Daerah Terbanyak',
            value: data ? data.summary.topLocation : '—',
            sub: data?.byCountry[0] ? `Negara utama: ${data.byCountry[0].name}` : 'Menunggu data',
            icon: <MapPin className="h-4 w-4" />,
          },
          {
            label: 'Akses Mobile / Tablet',
            value: data ? `${data.summary.mobileSharePct}%` : '—',
            sub: data ? `${100 - data.summary.mobileSharePct}% Desktop` : '',
            icon: <Smartphone className="h-4 w-4" />,
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-[22px] border border-[#E5D7C3] bg-[#FAF5EC]/88 p-4 shadow-xs backdrop-blur-xl"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9.5px] font-semibold tracking-wider text-[#7A624E] uppercase">
                {card.label}
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#4A2E1B]/10 text-[#4A2E1B]">
                {card.icon}
              </span>
            </div>
            <p className="mt-2 truncate font-serif text-2xl text-[#241A13]" title={card.value}>
              {card.value}
            </p>
            <p className="mt-1 truncate font-mono text-[10px] text-[#735D4B]">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* 14-Day Daily Trend Chart */}
      <section className="rounded-[24px] border border-[#E5D7C3] bg-[#FAF5EC]/88 p-5 shadow-xs backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-mono text-[10px] font-semibold tracking-[0.14em] text-[#7A5230] uppercase">
              TREN HARIAN (14 HARI TERAKHIR)
            </p>
            <h3 className="mt-0.5 font-serif text-xl text-[#241A13]">
              Grafik Kunjungan Harian
            </h3>
          </div>
          <div className="flex items-center gap-3 font-mono text-[10px] text-[#655040]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-[#4A2E1B]" />
              Total Kunjungan
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-[#C89B54]" />
              Pengunjung Unik
            </span>
          </div>
        </div>

        <div className="mt-5 flex h-40 items-end justify-between gap-1.5 rounded-2xl border border-[#4A2E1B]/10 bg-white/75 px-3 pt-5 pb-3">
          {(data?.dailySeries ?? []).length === 0 ? (
            <div className="flex h-full w-full items-center justify-center font-mono text-xs text-[#8A7360]">
              {loading ? 'Memuat grafik...' : 'Belum ada data kunjungan.'}
            </div>
          ) : (
            (data?.dailySeries ?? []).map((pt) => {
              const visitH = Math.round((pt.visits / maxDailyVisits) * 100);
              const uniqH = Math.round((pt.uniqueVisitors / maxDailyVisits) * 100);
              return (
                <div
                  key={pt.date}
                  className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5"
                  title={`${pt.label}: ${pt.visits} kunjungan (${pt.uniqueVisitors} unik)`}
                >
                  <div className="flex h-full w-full max-w-[30px] items-end justify-center gap-0.5">
                    <div
                      className="w-1/2 rounded-t-sm bg-[#4A2E1B] transition-all group-hover:bg-[#3A2213]"
                      style={{ height: `${pt.visits > 0 ? Math.max(6, visitH) : 2}%` }}
                    />
                    <div
                      className="w-1/2 rounded-t-sm bg-[#C89B54] transition-all"
                      style={{ height: `${pt.uniqueVisitors > 0 ? Math.max(6, uniqH) : 2}%` }}
                    />
                  </div>
                  <span className="font-mono text-[8.5px] text-[#7A624E]">{pt.label}</span>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Breakdown Grids: Region/City, Country, Device, Browser, OS, Referrer & View Mode */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BreakdownCard
          title="Kota & Daerah Pengunjung"
          icon={<MapPin className="h-3.5 w-3.5" />}
          items={data?.byCity ?? []}
        />
        <BreakdownCard
          title="Negara Pengunjung"
          icon={<Globe className="h-3.5 w-3.5" />}
          items={data?.byCountry ?? []}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <BreakdownCard
          title="Perangkat"
          icon={<Monitor className="h-3.5 w-3.5" />}
          items={data?.byDevice ?? []}
        />
        <BreakdownCard
          title="Browser"
          icon={<Compass className="h-3.5 w-3.5" />}
          items={data?.byBrowser ?? []}
        />
        <BreakdownCard
          title="Sumber Kunjungan"
          icon={<Globe className="h-3.5 w-3.5" />}
          items={data?.byReferrer ?? []}
        />
        <BreakdownCard
          title="Mode Ruangan & OS"
          icon={<CloudSun className="h-3.5 w-3.5" />}
          items={[...(data?.byViewMode ?? []), ...(data?.byOs ?? []).slice(0, 4)]}
        />
      </div>

      {/* Recent Visitor Logs Table with Single & Bulk Checkbox Delete */}
      <section className="rounded-[24px] border border-[#E5D7C3] bg-[#FAF5EC]/88 p-5 shadow-xs backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-[0.14em] text-[#7A5230] uppercase">
              <Clock className="h-3.5 w-3.5" />
              RIWAYAT KUNJUNGAN TERBARU ({logs.length})
            </p>
            <p className="mt-0.5 text-xs text-[#655040]">
              Ceklis satu per satu atau pilih semua untuk menghapus log kunjungan.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {logs.length > 0 && (
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
            )}

            {selectedIds.size > 0 && (
              <button
                type="button"
                disabled={deleting}
                onClick={requestDeleteSelected}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#6E1D2C] px-3.5 py-1.5 text-xs font-semibold text-[#FAF5EC] shadow-xs transition hover:bg-[#571622] disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Hapus Terpilih ({selectedIds.size})</span>
              </button>
            )}

            {logs.length > 0 && (
              <button
                type="button"
                disabled={deleting}
                onClick={requestClearAll}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#6E1D2C]/25 bg-[#F2E7D7] px-3 py-1.5 text-xs font-semibold text-[#6E1D2C] transition hover:bg-[#E7D6BE] disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Bersihkan Semua</span>
              </button>
            )}
          </div>
        </div>

        <div className="orihour-scroll mt-4 overflow-x-auto rounded-2xl border border-[#4A2E1B]/12 bg-white/85">
          {logs.length === 0 ? (
            <div className="py-10 text-center font-mono text-xs text-[#8A7360]">
              {loading ? 'Memuat log kunjungan...' : 'Belum ada riwayat pengunjung pada rentang waktu ini.'}
            </div>
          ) : (
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="border-b border-[#4A2E1B]/12 bg-[#F4ECE0]/85 font-mono text-[10px] font-semibold tracking-wider text-[#5C4432] uppercase">
                <tr>
                  <th className="w-10 px-3 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      aria-label="Pilih semua log"
                      className="h-3.5 w-3.5 cursor-pointer accent-[#4A2E1B]"
                    />
                  </th>
                  <th className="px-3 py-2.5">Waktu</th>
                  <th className="px-3 py-2.5">Kota / Daerah</th>
                  <th className="px-3 py-2.5">Perangkat &amp; OS</th>
                  <th className="px-3 py-2.5">Sumber</th>
                  <th className="px-3 py-2.5">Mode / Cuaca</th>
                  <th className="w-12 px-3 py-2.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#4A2E1B]/10">
                {logs.map((log) => {
                  const checked = selectedIds.has(log.id);
                  return (
                    <tr
                      key={log.id}
                      className={`transition ${
                        checked ? 'bg-[#F3E8D7]/70' : 'hover:bg-[#FAF5EC]/80'
                      }`}
                    >
                      <td className="px-3 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelectOne(log.id)}
                          aria-label={`Pilih log ${log.city}`}
                          className="h-3.5 w-3.5 cursor-pointer accent-[#4A2E1B]"
                        />
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[10.5px] whitespace-nowrap text-[#5C4432]">
                        <div>{formatDateTime(log.createdAt)}</div>
                        {log.timezone && (
                          <div className="text-[9px] text-[#8A7360]">{log.timezone}</div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-semibold text-[#241A13]">{log.city}</div>
                        <div className="font-mono text-[10px] text-[#7A624E]">
                          {log.region}
                          {log.country && log.country !== log.region ? `, ${log.country}` : ''}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-[#241A13]">
                          {log.deviceType} · {log.browser}
                        </div>
                        <div className="font-mono text-[10px] text-[#7A624E]">
                          {log.os}
                          {log.screenSize ? ` · ${log.screenSize}` : ''}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[10.5px] text-[#5C4432]">
                        {log.referrer}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          <span className="rounded-full bg-[#4A2E1B]/10 px-2 py-0.5 font-mono text-[9.5px] font-semibold text-[#4A2E1B]">
                            {log.viewMode}
                          </span>
                          <span className="rounded-full bg-[#C89B54]/20 px-2 py-0.5 font-mono text-[9.5px] font-semibold text-[#6E4D1B]">
                            {log.weather}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          disabled={deleting}
                          onClick={() => requestDeleteSingle(log.id, log.city)}
                          className="cursor-pointer rounded-lg p-1.5 text-[#8A7360] transition hover:bg-[#6E1D2C]/10 hover:text-[#6E1D2C]"
                          title="Hapus log ini"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Orihour-Themed Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(confirmState)}
        title={confirmState?.title || ''}
        description={confirmState?.description || ''}
        confirmLabel={confirmState?.confirmLabel || 'Hapus'}
        busy={deleting}
        onCancel={() => setConfirmState(null)}
        onConfirm={() => {
          if (confirmState) void confirmState.onConfirm();
        }}
      />
    </div>
  );
}