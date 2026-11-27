'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import {
  Disc3,
  Library,
  Frame,
  Pin,
  Wallet,
  BarChart3,
  HardDrive,
  ExternalLink,
  LogOut,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { DEFAULT_ROOM_CONFIG } from '@/data/mockVinyls';
import { extractUniqueGenres, sortPostcardsForBoard } from '@/lib/genreUtils';
import { STORAGE_UPDATED_EVENT } from '@/lib/supabase/storage';
import {
  GenreItem,
  GuestbookPostcard,
  PosterItem,
  RoomConfig,
  VinylRecord,
} from '@/types/orihour';
import TurntableRackTab from '@/components/admin/TurntableRackTab';
import VinylLibraryTab from '@/components/admin/VinylLibraryTab';
import WallPostersTab from '@/components/admin/WallPostersTab';
import PinboardModerationTab from '@/components/admin/PinboardModerationTab';
import RoomWalletTab from '@/components/admin/RoomWalletTab';
import AnalyticsTab from '@/components/admin/AnalyticsTab';
import StoragePoolTab, { StoragePoolOverview } from '@/components/admin/StoragePoolTab';

type AdminTabId =
  | 'turntable'
  | 'vinyls'
  | 'posters'
  | 'pinboard'
  | 'room'
  | 'storage'
  | 'analytics';

export default function OrihourAdminPage() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<AdminTabId>('turntable');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const [config, setConfig] = useState<RoomConfig>(DEFAULT_ROOM_CONFIG);
  const [vinyls, setVinyls] = useState<VinylRecord[]>([]);
  const [postcards, setPostcards] = useState<GuestbookPostcard[]>([]);
  const [genres, setGenres] = useState<GenreItem[]>([]);

  const [storageOverview, setStorageOverview] = useState<StoragePoolOverview | null>(null);
  const [storageLoading, setStorageLoading] = useState(false);

  const loadStorageOverview = useCallback(async () => {
    setStorageLoading(true);
    try {
      const res = await fetch('/api/admin/storage', { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        setStorageOverview(data as StoragePoolOverview);
      }
    } catch {
      // Abaikan diam-diam agar tab lain tetap bisa dipakai
    } finally {
      setStorageLoading(false);
    }
  }, []);

  const loadRoomData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/room-data', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memuat data ruangan.');
      }

      const nextConfig: RoomConfig = data.config || DEFAULT_ROOM_CONFIG;
      const nextVinyls: VinylRecord[] = Array.isArray(data.vinyls) ? data.vinyls : [];
      const nextPostcards: GuestbookPostcard[] = Array.isArray(data.postcards)
        ? sortPostcardsForBoard(data.postcards)
        : [];
      const nextGenres: GenreItem[] = Array.isArray(data.genres)
        ? data.genres
        : extractUniqueGenres(nextVinyls).map((name, i) => ({
            id: `gnr-${i}`,
            name,
          }));

      setConfig(nextConfig);
      setVinyls(nextVinyls);
      setPostcards(nextPostcards);
      setGenres(nextGenres);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat data admin.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoomData();
    loadStorageOverview();
  }, [loadRoomData, loadStorageOverview]);

  // Refresh kapasitas & banner peringatan otomatis setiap kali ada file yang selesai diunggah
  useEffect(() => {
    const onStorageUpdated = () => {
      void loadStorageOverview();
    };
    window.addEventListener(STORAGE_UPDATED_EVENT, onStorageUpdated);
    return () => window.removeEventListener(STORAGE_UPDATED_EVENT, onStorageUpdated);
  }, [loadStorageOverview]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (url && key) {
        const supabase = createBrowserClient(url, key);
        await supabase.auth.signOut();
      }
      router.replace('/admin/login');
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  };

  // 1. Turntable Active Vinyl
  const handleUpdateActiveTurntable = async (vinylId: string | null) => {
    const res = await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeTurntableVinylId: vinylId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Gagal memperbarui vinyl turntable.');
    }

    if (vinylId) {
      const existing = vinyls.find((v) => v.id === vinylId);
      if (existing && existing.rackSlot !== null) {
        await fetch('/api/admin/vinyls', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: vinylId, rackSlot: null }),
        }).catch(() => {});
      }
    }

    await loadRoomData();
  };

  // 2. Save 6-Slot Wooden Rack Order
  const handleSaveRackOrder = async (rackIds: (string | null)[]) => {
    const updates: Promise<Response>[] = [];

    for (const v of vinyls) {
      const idx = rackIds.indexOf(v.id);
      const nextSlot = idx >= 0 ? idx + 1 : null;
      const currentSlot = v.rackSlot ?? null;

      if (nextSlot !== currentSlot) {
        updates.push(
          fetch('/api/admin/vinyls', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: v.id, rackSlot: nextSlot }),
          })
        );
      }
    }

    const results = await Promise.all(updates);
    const failed = results.find((r) => !r.ok);
    if (failed) {
      const errData = await failed.json().catch(() => ({}));
      throw new Error(errData.error || 'Gagal menyimpan susunan rak.');
    }

    await loadRoomData();
  };

  // 3. Vinyl Collection CRUD + Bulk Delete
  const handleCreateVinyl = async (payload: Partial<VinylRecord>) => {
    const res = await fetch('/api/admin/vinyls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Gagal menambahkan vinyl baru.');
    }
    await loadRoomData();
  };

  const handleUpdateVinyl = async (payload: Partial<VinylRecord> & { id: string }) => {
    const res = await fetch('/api/admin/vinyls', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Gagal memperbarui koleksi vinyl.');
    }
    await loadRoomData();
  };

  const handleDeleteVinyl = async (id: string) => {
    const res = await fetch(`/api/admin/vinyls?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Gagal menghapus vinyl.');
    }
    await loadRoomData();
  };

  const handleBulkDeleteVinyls = async (ids: string[]) => {
    for (const id of ids) {
      const res = await fetch(`/api/admin/vinyls?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Sebagian koleksi gagal dihapus.');
      }
    }
    await loadRoomData();
  };

  // 4. Genres CRUD + Bulk Delete
  const handleAddGenre = async (name: string): Promise<string> => {
    const res = await fetch('/api/admin/genres', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Gagal menambah genre.');
    }
    await loadRoomData();
    return data.genre?.name || name.trim();
  };

  const handleDeleteGenre = async (id: string) => {
    const res = await fetch(`/api/admin/genres?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Gagal menghapus genre.');
    }
    await loadRoomData();
  };

  const handleBulkDeleteGenres = async (ids: string[]) => {
    for (const id of ids) {
      const res = await fetch(`/api/admin/genres?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Sebagian genre gagal dihapus.');
      }
    }
    await loadRoomData();
  };

  // 5. Wall Posters Update
  const handleUpdatePoster = async (poster: PosterItem) => {
    const res = await fetch('/api/admin/posters', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(poster),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Gagal menyimpan poster.');
    }
    await loadRoomData();
  };

  // 6. Pinboard Moderation + Bulk Delete
  const handleTogglePin = async (id: string, isPinned: boolean) => {
    const res = await fetch('/api/admin/postcards', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isPinned }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Gagal mengubah status pin kartu pos.');
    }
    await loadRoomData();
  };

  const handleDeletePostcard = async (id: string) => {
    const res = await fetch(`/api/admin/postcards?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Gagal menghapus kartu pos.');
    }
    await loadRoomData();
  };

  const handleBulkDeletePostcards = async (ids: string[]) => {
    for (const id of ids) {
      const res = await fetch(`/api/admin/postcards?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Sebagian kartu pos gagal dihapus.');
      }
    }
    await loadRoomData();
  };

  // 7. Room & Wallet Identity Settings Update
  const handleSaveRoomSettings = async (nextConfig: Partial<RoomConfig>) => {
    const res = await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nextConfig),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Gagal menyimpan pengaturan ruangan & dompet.');
    }
    await loadRoomData();
  };

  const storageAlertSeverity = storageOverview?.warningSeverity || 'none';

  const tabs: {
    id: AdminTabId;
    label: string;
    count?: number;
    alertDot?: 'warning' | 'full' | null;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'turntable', label: 'Turntable & Rak', icon: Disc3 },
    { id: 'vinyls', label: 'Koleksi Vinyl', count: vinyls.length, icon: Library },
    { id: 'posters', label: 'Poster Dinding', count: config.posters.length, icon: Frame },
    { id: 'pinboard', label: 'Pinboard', count: postcards.length, icon: Pin },
    { id: 'room', label: 'Ruangan & Dompet', icon: Wallet },
    {
      id: 'storage',
      label: 'Penyimpanan',
      count: storageOverview?.accounts.length,
      alertDot: storageAlertSeverity === 'none' ? null : storageAlertSeverity,
      icon: HardDrive,
    },
    { id: 'analytics', label: 'Analitik', icon: BarChart3 },
  ];

  return (
    <div
      className="flex h-[100dvh] flex-col overflow-hidden bg-[#F2E9DB] text-[#241A13]"
      style={{
        backgroundImage:
          'radial-gradient(circle at 12% 8%, rgba(200, 155, 84, 0.18), transparent 42%), radial-gradient(circle at 90% 92%, rgba(74, 46, 27, 0.12), transparent 46%)',
      }}
    >
      {/* Fixed Top Curator Admin Header — Never shifts or scrolls */}
      <header className="z-30 shrink-0 border-b border-[#E5D7C3] bg-[#FAF5EC]/92 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2.5 px-4 py-3 sm:px-6 sm:py-3.5">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#4A2E1B] text-[#FAF5EC] shadow-sm sm:h-10 sm:w-10">
              <Disc3 className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-mono text-[9.5px] font-semibold tracking-[0.2em] text-[#7A5230] uppercase sm:text-[10px]">
                CURATOR CONTROL PANEL
              </p>
              <h1 className="truncate font-serif text-lg leading-tight text-[#241A13] sm:text-xl">
                {config.siteName} Admin
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              disabled={loading || storageLoading}
              onClick={() => {
                void loadRoomData();
                void loadStorageOverview();
              }}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#4A2E1B]/20 bg-white px-2.5 py-2 text-xs font-semibold text-[#4A2E1B] transition hover:bg-[#EFE4D3] disabled:opacity-50 sm:px-3"
              title="Sinkronkan data terbaru dari database"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading || storageLoading ? 'animate-spin' : ''}`}
              />
              <span className="hidden sm:inline">Sync</span>
            </button>

            <Link
              href="/"
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#4A2E1B]/20 bg-white px-2.5 py-2 text-xs font-semibold text-[#4A2E1B] transition hover:bg-[#EFE4D3] sm:px-3"
              title="Buka ruangan 3D di tab baru"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Lihat Ruangan 3D</span>
            </Link>

            <button
              type="button"
              disabled={loggingOut}
              onClick={handleLogout}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#4A2E1B] px-3 py-2 text-xs font-semibold text-[#FAF5EC] shadow-xs transition hover:bg-[#3A2213] disabled:opacity-50 sm:px-3.5"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>{loggingOut ? 'Keluar...' : 'Keluar'}</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mx-auto max-w-6xl px-4 pb-3 sm:px-6">
          <nav className="no-scrollbar flex items-center gap-1.5 overflow-x-auto sm:flex-wrap sm:overflow-visible">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-1.5 text-xs font-semibold transition sm:px-3.5 sm:py-2 ${
                    isActive
                      ? 'border-[#4A2E1B] bg-[#4A2E1B] text-[#FAF5EC] shadow-sm'
                      : 'border-[#4A2E1B]/15 bg-white/80 text-[#5C4432] hover:border-[#4A2E1B]/35 hover:bg-white'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                  {typeof tab.count === 'number' && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 font-mono text-[9.5px] ${
                        isActive
                          ? 'bg-[#FAF5EC]/20 text-[#FAF5EC]'
                          : 'bg-[#4A2E1B]/10 text-[#4A2E1B]'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                  {tab.alertDot && (
                    <span
                      className={`h-2 w-2 rounded-full ${
                        tab.alertDot === 'full' ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'
                      }`}
                      title={
                        tab.alertDot === 'full'
                          ? 'Penyimpanan penuh!'
                          : 'Penyimpanan hampir penuh'
                      }
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Internal Scrollable Tab Content Area */}
      <div className="orihour-scroll flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-6">
          {/* Global Storage Capacity Warning / Full Banner */}
          {storageOverview?.warningMessage && storageAlertSeverity !== 'none' && (
            <div
              className={`mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-xs font-semibold ${
                storageAlertSeverity === 'full'
                  ? 'border-[#6E1D2C]/35 bg-[#6E1D2C]/12 text-[#571622]'
                  : 'border-amber-700/30 bg-amber-500/15 text-amber-950'
              }`}
            >
              <span className="inline-flex items-center gap-2.5">
                <AlertTriangle
                  className={`h-4 w-4 shrink-0 ${
                    storageAlertSeverity === 'full' ? 'text-[#6E1D2C]' : 'text-amber-700'
                  }`}
                />
                <span>{storageOverview.warningMessage}</span>
              </span>
              {activeTab !== 'storage' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('storage')}
                  className={`cursor-pointer whitespace-nowrap rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${
                    storageAlertSeverity === 'full'
                      ? 'bg-[#6E1D2C] text-[#FAF5EC] hover:bg-[#571622]'
                      : 'bg-[#4A2E1B] text-[#FAF5EC] hover:bg-[#3A2213]'
                  }`}
                >
                  Kelola Penyimpanan
                </button>
              )}
            </div>
          )}

          {errorMsg && (
            <div className="mb-5 flex items-center gap-2.5 rounded-2xl border border-[#4A2E1B]/30 bg-[#4A2E1B]/10 px-4 py-3 text-xs font-semibold text-[#3A2213]">
              <AlertTriangle className="h-4 w-4 shrink-0 text-[#7A5230]" />
              <span>{errorMsg}</span>
            </div>
          )}

          {loading &&
          vinyls.length === 0 &&
          activeTab !== 'analytics' &&
          activeTab !== 'storage' ? (
            <div className="flex flex-col items-center justify-center rounded-[24px] border border-[#E5D7C3] bg-[#FAF5EC]/80 py-20 text-center">
              <Disc3 className="h-7 w-7 animate-spin text-[#4A2E1B]" />
              <p className="mt-3 font-mono text-xs text-[#655040]">
                Memuat data ruangan Orihour...
              </p>
            </div>
          ) : (
            <>
              {activeTab === 'turntable' && (
                <TurntableRackTab
                  config={config}
                  vinyls={vinyls}
                  onUpdateActiveTurntable={handleUpdateActiveTurntable}
                  onSaveRackOrder={handleSaveRackOrder}
                />
              )}

              {activeTab === 'vinyls' && (
                <VinylLibraryTab
                  vinyls={vinyls}
                  genres={genres}
                  activeTurntableVinylId={config.activeTurntableVinylId}
                  onCreateVinyl={handleCreateVinyl}
                  onUpdateVinyl={handleUpdateVinyl}
                  onDeleteVinyl={handleDeleteVinyl}
                  onBulkDeleteVinyls={handleBulkDeleteVinyls}
                  onAddGenre={handleAddGenre}
                  onDeleteGenre={handleDeleteGenre}
                  onBulkDeleteGenres={handleBulkDeleteGenres}
                />
              )}

              {activeTab === 'posters' && (
                <WallPostersTab
                  posters={config.posters}
                  onUpdatePoster={handleUpdatePoster}
                />
              )}

              {activeTab === 'pinboard' && (
                <PinboardModerationTab
                  postcards={postcards}
                  onTogglePin={handleTogglePin}
                  onDeletePostcard={handleDeletePostcard}
                  onBulkDeletePostcards={handleBulkDeletePostcards}
                />
              )}

              {activeTab === 'room' && (
                <RoomWalletTab
                  config={config}
                  onSaveSettings={handleSaveRoomSettings}
                />
              )}

              {activeTab === 'storage' && (
                <StoragePoolTab
                  overview={storageOverview}
                  loading={storageLoading}
                  onRefresh={loadStorageOverview}
                  onOverviewUpdated={setStorageOverview}
                />
              )}

              {activeTab === 'analytics' && <AnalyticsTab />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}