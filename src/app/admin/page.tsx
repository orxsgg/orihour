'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Disc3,
  Layers,
  Library,
  Frame,
  Pin,
  CreditCard,
  LogOut,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import {
  GenreItem,
  GuestbookPostcard,
  OwnerProfile,
  PosterItem,
  RoomConfig,
  VinylRecord,
} from '@/types/orihour';
import { createSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';
import TurntableRackTab from '@/components/admin/TurntableRackTab';
import VinylLibraryTab from '@/components/admin/VinylLibraryTab';
import WallPostersTab from '@/components/admin/WallPostersTab';
import PinboardModerationTab from '@/components/admin/PinboardModerationTab';
import RoomWalletTab from '@/components/admin/RoomWalletTab';

type AdminTab = 'turntable' | 'library' | 'posters' | 'pinboard' | 'room';

const TABS: {
  id: AdminTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'turntable', label: 'Turntable & Rak', icon: Layers },
  { id: 'library', label: 'Koleksi & Genre', icon: Library },
  { id: 'posters', label: 'Poster Dinding', icon: Frame },
  { id: 'pinboard', label: 'Visitor Pinboard', icon: Pin },
  { id: 'room', label: 'Room & Wallet', icon: CreditCard },
];

export default function AdminDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminTab>('turntable');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);

  const [config, setConfig] = useState<RoomConfig | null>(null);
  const [vinyls, setVinyls] = useState<VinylRecord[]>([]);
  const [postcards, setPostcards] = useState<GuestbookPostcard[]>([]);
  const [genres, setGenres] = useState<GenreItem[]>([]);

  // Active session monitor: redirects immediately if session expires or signs out in another tab
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createSupabaseBrowserClient();

    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace('/admin/login');
      } else {
        setAdminEmail(data.user.email ?? null);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session?.user) {
        router.replace('/admin/login');
      } else {
        setAdminEmail(session.user.email ?? null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  const loadAdminData = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      setErrorMsg(null);

      try {
        const [roomRes, adminPostcardsRes, genresRes] = await Promise.all([
          fetch('/api/room-data', { cache: 'no-store' }),
          fetch('/api/admin/postcards', { cache: 'no-store' }),
          fetch('/api/admin/genres', { cache: 'no-store' }),
        ]);

        if (adminPostcardsRes.status === 401 || genresRes.status === 401) {
          router.replace('/admin/login');
          return;
        }

        if (!roomRes.ok) throw new Error('Gagal memuat data ruangan.');
        const roomData = await roomRes.json();
        setConfig(roomData.config);
        setVinyls(roomData.vinyls || []);

        if (adminPostcardsRes.ok) {
          const pcData = await adminPostcardsRes.json();
          setPostcards(pcData.postcards || []);
        } else {
          setPostcards(roomData.postcards || []);
        }

        if (genresRes.ok) {
          const gData = await genresRes.json();
          setGenres(gData.genres || []);
        } else {
          setGenres(roomData.genres || []);
        }
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat data admin.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router]
  );

  useEffect(() => {
    loadAdminData(false);
  }, [loadAdminData]);

  const handleSignOut = async () => {
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
    } finally {
      router.replace('/admin/login');
      router.refresh();
    }
  };

  // ==================== MUTATION HANDLERS ====================

  const handleUpdateActiveTurntable = async (vinylId: string | null) => {
    const res = await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeTurntableVinylId: vinylId }),
    });
    if (res.status === 401) {
      router.replace('/admin/login');
      return;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Gagal memperbarui turntable.');
    }
    const data = await res.json();
    setConfig(data.config);
    setVinyls(data.vinyls);
  };

  const handleSaveRackOrder = async (rackIds: (string | null)[]) => {
    const res = await fetch('/api/admin/vinyls', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reorder_rack', rackIds }),
    });
    if (res.status === 401) {
      router.replace('/admin/login');
      return;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Gagal menyimpan susunan rak.');
    }
    const data = await res.json();
    setVinyls(data.vinyls);
  };

  const handleCreateVinyl = async (payload: Partial<VinylRecord>) => {
    const res = await fetch('/api/admin/vinyls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.status === 401) {
      router.replace('/admin/login');
      return;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Gagal menambah koleksi.');
    }
    await loadAdminData(true);
  };

  const handleUpdateVinyl = async (payload: Partial<VinylRecord> & { id: string }) => {
    const res = await fetch('/api/admin/vinyls', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.status === 401) {
      router.replace('/admin/login');
      return;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Gagal memperbarui koleksi.');
    }
    await loadAdminData(true);
  };

  const handleDeleteVinyl = async (id: string) => {
    const res = await fetch(`/api/admin/vinyls?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (res.status === 401) {
      router.replace('/admin/login');
      return;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Gagal menghapus koleksi.');
    }
    await loadAdminData(true);
  };

  const handleAddGenre = async (name: string): Promise<string> => {
    const res = await fetch('/api/admin/genres', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (res.status === 401) {
      router.replace('/admin/login');
      return name;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Gagal menambah genre.');
    }
    setGenres(data.genres || []);
    return data.genre || name;
  };

  const handleDeleteGenre = async (id: string) => {
    const res = await fetch(`/api/admin/genres?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (res.status === 401) {
      router.replace('/admin/login');
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Gagal menghapus genre.');
    }
    setGenres(data.genres || []);
  };

  const handleUpdatePoster = async (poster: PosterItem) => {
    const res = await fetch('/api/admin/posters', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(poster),
    });
    if (res.status === 401) {
      router.replace('/admin/login');
      return;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Gagal menyimpan poster.');
    }
    const data = await res.json();
    setConfig((prev) =>
      prev
        ? {
            ...prev,
            posters: prev.posters.map((p) =>
              p.id === data.poster.id ? data.poster : p
            ),
          }
        : prev
    );
  };

  const handleTogglePinPostcard = async (id: string, nextPinned: boolean) => {
    const res = await fetch('/api/admin/postcards', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isPinned: nextPinned }),
    });
    if (!res.ok) throw new Error('Gagal memperbarui pin.');
    const data = await res.json();
    setPostcards(data.postcards);
  };

  const handleReorderPinnedPostcards = async (orderedIds: string[]) => {
    const res = await fetch('/api/admin/postcards', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reorder_pinned', orderedIds }),
    });
    if (!res.ok) throw new Error('Gagal mengubah urutan pin.');
    const data = await res.json();
    setPostcards(data.postcards);
  };

  const handleToggleHiddenPostcard = async (id: string, nextHidden: boolean) => {
    const res = await fetch('/api/admin/postcards', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isHidden: nextHidden }),
    });
    if (!res.ok) throw new Error('Gagal mengubah visibilitas pesan.');
    const data = await res.json();
    setPostcards(data.postcards);
  };

  const handleDeletePostcard = async (id: string) => {
    const res = await fetch(`/api/admin/postcards?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Gagal menghapus catatan.');
    setPostcards((prev) => prev.filter((p) => p.id !== id));
  };

  const handleSaveRoomSettings = async (patch: {
    siteName: string;
    wallTitle: string;
    wallSubtitle: string;
    bio: string;
    ownerProfile: OwnerProfile;
  }) => {
    const res = await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Gagal menyimpan pengaturan ruangan.');
    }
    const data = await res.json();
    setConfig(data.config);
  };

  return (
    <main className="relative min-h-screen w-full overflow-x-hidden bg-gradient-to-br from-[#F7F1E7] via-[#EFE5D6] to-[#E5D6C2] text-[#241A13]">
      {/* Warm cream & espresso ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -top-36 -left-24 h-[420px] w-[420px] rounded-full bg-[#4A2E1B]/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -right-24 -bottom-36 h-[420px] w-[420px] rounded-full bg-[#B58A52]/16 blur-3xl"
      />

      {/* Top Glass Header (z-20 so Portal Modals at z-[90]/z-[110] ALWAYS float cleanly on top) */}
      <header
        className="sticky top-0 z-20 border-b border-[#4A2E1B]/12 bg-[#FAF5EC]/88 shadow-xs"
        style={{
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
        }}
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#4A2E1B] text-[#FAF5EC] shadow-sm">
              <Disc3 className="h-4.5 w-4.5" />
            </span>
            <div>
              <h1 className="font-serif text-2xl leading-none tracking-[0.08em] text-[#241A13]">
                ORI<span className="text-[#7A5230]">HOUR</span>{' '}
                <span className="font-mono text-[10px] font-semibold tracking-[0.16em] text-[#7D6654] uppercase">
                  CURATOR CONSOLE
                </span>
              </h1>
              {adminEmail && (
                <p className="mt-0.5 inline-flex items-center gap-1 font-mono text-[9.5px] text-[#7A624E]">
                  <ShieldCheck className="h-3 w-3 text-emerald-700" />
                  Sesi aktif: {adminEmail}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => loadAdminData(true)}
              disabled={refreshing}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#4A2E1B]/18 bg-white/90 px-3 py-1.5 text-xs font-semibold text-[#4A2E1B] transition hover:bg-white"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sinkronkan</span>
            </button>

            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#4A2E1B]/18 bg-white/90 px-3 py-1.5 text-xs font-semibold text-[#241A13] transition hover:border-[#4A2E1B] hover:bg-[#F3E9DA]"
            >
              <span>Buka Ruang 3D</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>

            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#4A2E1B]/25 bg-[#4A2E1B]/10 px-3 py-1.5 text-xs font-semibold text-[#4A2E1B] transition hover:bg-[#4A2E1B] hover:text-[#FAF5EC]"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mx-auto max-w-6xl px-4 pb-3 sm:px-6">
          <nav className="flex gap-1.5 overflow-x-auto pb-0.5">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                    isActive
                      ? 'bg-[#4A2E1B] text-[#FAF5EC] shadow-sm'
                      : 'border border-[#4A2E1B]/14 bg-white/75 text-[#5C4432] hover:bg-white'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                  {tab.id === 'pinboard' && postcards.length > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 font-mono text-[9.5px] ${
                        isActive ? 'bg-white/20 text-[#FAF5EC]' : 'bg-[#4A2E1B]/12 text-[#4A2E1B]'
                      }`}
                    >
                      {postcards.length}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="relative z-10 mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {errorMsg && (
          <div className="mb-5 flex items-center gap-2.5 rounded-2xl border border-[#4A2E1B]/30 bg-[#4A2E1B]/10 px-4 py-3 text-xs font-semibold text-[#3A2213]">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {loading || !config ? (
          <div className="flex flex-col items-center justify-center rounded-[26px] border border-[#E5D7C3] bg-[#FAF5EC]/80 py-24 backdrop-blur-xl">
            <Disc3
              className="h-7 w-7 animate-spin text-[#4A2E1B]"
              style={{ animationDuration: '2.2s' }}
            />
            <p className="mt-3 font-mono text-xs tracking-[0.16em] text-[#735D4B] uppercase">
              MEMUAT DATA RUANGAN...
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

            {activeTab === 'library' && (
              <VinylLibraryTab
                vinyls={vinyls}
                genres={genres}
                activeTurntableVinylId={config.activeTurntableVinylId}
                onCreateVinyl={handleCreateVinyl}
                onUpdateVinyl={handleUpdateVinyl}
                onDeleteVinyl={handleDeleteVinyl}
                onAddGenre={handleAddGenre}
                onDeleteGenre={handleDeleteGenre}
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
                onTogglePin={handleTogglePinPostcard}
                onReorderPinned={handleReorderPinnedPostcards}
                onToggleHidden={handleToggleHiddenPostcard}
                onDeletePostcard={handleDeletePostcard}
              />
            )}

            {activeTab === 'room' && (
              <RoomWalletTab
                config={config}
                onSaveSettings={handleSaveRoomSettings}
              />
            )}
          </>
        )}
      </div>
    </main>
  );
}