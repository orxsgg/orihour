'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  Edit3,
  Trash2,
  Upload,
  FolderUp,
  FileArchive,
  Music2,
  Disc3,
  Save,
  X,
  Tag,
  Check,
  CheckCircle2,
  AlertTriangle,
  Image as ImageIcon,
  Volume2,
  ListMusic,
  Scissors,
  Star,
  CheckSquare,
  Square,
  Loader2,
} from 'lucide-react';
import {
  ClipMode,
  GenreItem,
  RELEASE_TYPES,
  ReleaseType,
  TrackItem,
  VinylRecord,
} from '@/types/orihour';
import { extractAudioDurationSeconds, formatDurationSeconds } from '@/lib/audioEngine';
import { collectAudioFilesFromSelection } from '@/lib/audioArchiveExtractor';
import {
  formatGenres,
  hasMultipleTracks,
  parseGenres,
} from '@/lib/genreUtils';
import { ProcessedImageResult } from '@/lib/imageProcessor';
import { uploadMediaToSupabase } from '@/lib/supabase/storage';
import { getSleeveDataUrl } from '@/components/room-3d/textures';
import ThemedDropdown, { DropdownOption } from '@/components/ui/ThemedDropdown';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import ImageCropEnhanceModal from './ImageCropEnhanceModal';
import SnippetTrimmer from './SnippetTrimmer';

interface VinylLibraryTabProps {
  vinyls: VinylRecord[];
  genres: GenreItem[];
  activeTurntableVinylId: string | null;
  onCreateVinyl: (payload: Partial<VinylRecord>) => Promise<void>;
  onUpdateVinyl: (payload: Partial<VinylRecord> & { id: string }) => Promise<void>;
  onDeleteVinyl: (id: string) => Promise<void>;
  onBulkDeleteVinyls?: (ids: string[]) => Promise<void>;
  onAddGenre: (name: string) => Promise<string>;
  onDeleteGenre: (id: string) => Promise<void>;
  onBulkDeleteGenres?: (ids: string[]) => Promise<void>;
}

const LABEL_SWATCHES = [
  '#4A2E1B',
  '#6E462C',
  '#8C6846',
  '#4D0F18',
  '#2563EB',
  '#0D9488',
  '#334155',
  '#047857',
  '#5B4636',
];

const RACK_SLOT_OPTIONS: DropdownOption[] = [
  { value: '', label: 'Koleksi Saja' },
  { value: '1', label: 'Kontainer Slot #1' },
  { value: '2', label: 'Kontainer Slot #2' },
  { value: '3', label: 'Kontainer Slot #3' },
  { value: '4', label: 'Kontainer Slot #4' },
  { value: '5', label: 'Kontainer Slot #5' },
  { value: '6', label: 'Kontainer Slot #6' },
];

const CLIP_MODE_OPTIONS: DropdownOption[] = [
  { value: 'full', label: 'Full Song' },
  { value: 'snippet', label: 'Sebagian (Snippet)' },
];

interface VinylFormState {
  id?: string;
  title: string;
  artist: string;
  album: string;
  releaseType: ReleaseType;
  singleOrMulti: 'single' | 'multi';
  releaseYear: number;
  duration: string;
  selectedGenres: string[];
  labelColor: string;
  artStyle: number;
  coverUrl: string;
  showCoverOverlay: boolean;
  audioUrl: string;
  clipMode: ClipMode;
  clipStartSec: number;
  clipEndSec: number;
  favoriteLyric: string;
  favoriteSong: string;
  tracks: TrackItem[];
  linerNotes: string;
  rackSlot: number | null;
}

function isFlexibleReleaseType(rt: ReleaseType): boolean {
  return rt === 'Live Version' || rt === 'Cover';
}

function createEmptyForm(defaultGenre: string): VinylFormState {
  const initialGenres = parseGenres(defaultGenre);
  return {
    title: '',
    artist: '',
    album: '',
    releaseType: 'Song',
    singleOrMulti: 'single',
    releaseYear: new Date().getFullYear(),
    duration: '03:30',
    selectedGenres: initialGenres.length > 0 ? initialGenres : ['Indie'],
    labelColor: '#4A2E1B',
    artStyle: 0,
    coverUrl: '',
    showCoverOverlay: true,
    audioUrl: '',
    clipMode: 'full',
    clipStartSec: 0,
    clipEndSec: 30,
    favoriteLyric: '',
    favoriteSong: '',
    tracks: [],
    linerNotes: '',
    rackSlot: null,
  };
}

function formatSecLabel(sec: number): string {
  const safe = Math.max(0, Math.round(sec));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function parseDurationToSeconds(label: string): number {
  const parts = (label || '')
    .trim()
    .split(':')
    .map((n) => parseInt(n, 10));
  if (parts.some((n) => Number.isNaN(n))) return 0;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

function formatTotalDuration(totalSec: number): string {
  const safe = Math.max(0, Math.round(totalSec));
  if (safe === 0) return '00:00';
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function VinylLibraryTab({
  vinyls,
  genres,
  activeTurntableVinylId,
  onCreateVinyl,
  onUpdateVinyl,
  onDeleteVinyl,
  onBulkDeleteVinyls,
  onAddGenre,
  onDeleteGenre,
  onBulkDeleteGenres,
}: VinylLibraryTabProps) {
  const [mounted, setMounted] = useState(false);
  const [editing, setEditing] = useState<VinylFormState | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [uploadingTrackId, setUploadingTrackId] = useState<string | null>(null);
  const [batchUploadProgress, setBatchUploadProgress] = useState<{
    done: number;
    total: number;
    currentName: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  const [selectedVinylIds, setSelectedVinylIds] = useState<Set<string>>(new Set());
  const [bulkDeletingVinyls, setBulkDeletingVinyls] = useState(false);
  const [selectedGenreIds, setSelectedGenreIds] = useState<Set<string>>(new Set());
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(new Set());

  const [showGenreManager, setShowGenreManager] = useState(false);
  const [newGenreName, setNewGenreName] = useState('');
  const [inlineGenreInput, setInlineGenreInput] = useState('');
  const [genreBusy, setGenreBusy] = useState(false);

  const [confirmState, setConfirmState] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => Promise<void> | void;
  } | null>(null);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const zipOrMultiInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const trackAudioRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!editing) {
      setSelectedTrackIds(new Set());
      setInlineGenreInput('');
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [editing]);

  // Attach non-standard webkitdirectory attribute safely for folder uploads
  const bindFolderInputRef = (el: HTMLInputElement | null) => {
    folderInputRef.current = el;
    if (el) {
      el.setAttribute('webkitdirectory', '');
      el.setAttribute('directory', '');
    }
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 5000);
  };

  const genreNames = useMemo(() => {
    const map = new Map<string, string>();
    genres.forEach((g) => {
      parseGenres(g.name).forEach((name) => {
        const key = name.toLowerCase();
        if (!map.has(key)) map.set(key, name);
      });
    });
    vinyls.forEach((v) => {
      parseGenres(v.genre || v.mood).forEach((name) => {
        const key = name.toLowerCase();
        if (!map.has(key)) map.set(key, name);
      });
    });
    editing?.selectedGenres.forEach((name) => {
      const key = name.toLowerCase();
      if (!map.has(key)) map.set(key, name);
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [genres, vinyls, editing?.selectedGenres]);

  const filteredVinyls = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vinyls.filter((v) => {
      const matchType = typeFilter === 'ALL' || v.releaseType === typeFilter;
      const gList = parseGenres(v.genre || v.mood);
      const matchQuery =
        !q ||
        v.title.toLowerCase().includes(q) ||
        v.artist.toLowerCase().includes(q) ||
        v.album.toLowerCase().includes(q) ||
        gList.some((g) => g.toLowerCase().includes(q));
      return matchType && matchQuery;
    });
  }, [vinyls, search, typeFilter]);

  const allFilteredVinylsSelected =
    filteredVinyls.length > 0 && filteredVinyls.every((v) => selectedVinylIds.has(v.id));

  const toggleVinylSelect = (id: string) => {
    setSelectedVinylIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVinyls = () => {
    if (allFilteredVinylsSelected) {
      setSelectedVinylIds((prev) => {
        const next = new Set(prev);
        filteredVinyls.forEach((v) => next.delete(v.id));
        return next;
      });
    } else {
      setSelectedVinylIds((prev) => {
        const next = new Set(prev);
        filteredVinyls.forEach((v) => next.add(v.id));
        return next;
      });
    }
  };

  const requestBulkDeleteVinyls = () => {
    const ids = Array.from(selectedVinylIds).filter((id) =>
      vinyls.some((v) => v.id === id)
    );
    if (ids.length === 0) return;

    setConfirmState({
      title: `Hapus ${ids.length} Koleksi Vinyl?`,
      description: `Sebanyak ${ids.length} koleksi vinyl terpilih akan dihapus permanen dari rak, turntable, dan katalog Orihour.`,
      confirmLabel: `Hapus (${ids.length})`,
      onConfirm: async () => {
        setBulkDeletingVinyls(true);
        try {
          if (onBulkDeleteVinyls) {
            await onBulkDeleteVinyls(ids);
          } else {
            for (const id of ids) {
              await onDeleteVinyl(id);
            }
          }
          setSelectedVinylIds(new Set());
          setStatusMsg(`${ids.length} koleksi vinyl berhasil dihapus.`);
        } catch (err) {
          showError(err instanceof Error ? err.message : 'Gagal menghapus koleksi terpilih.');
        } finally {
          setBulkDeletingVinyls(false);
          setConfirmState(null);
        }
      },
    });
  };

  const allGenresSelected =
    genres.length > 0 && genres.every((g) => selectedGenreIds.has(g.id));

  const toggleGenreSelect = (id: string) => {
    setSelectedGenreIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllGenres = () => {
    if (allGenresSelected) {
      setSelectedGenreIds(new Set());
    } else {
      setSelectedGenreIds(new Set(genres.map((g) => g.id)));
    }
  };

  const requestBulkDeleteGenres = () => {
    const ids = Array.from(selectedGenreIds).filter((id) =>
      genres.some((g) => g.id === id)
    );
    if (ids.length === 0) return;

    setConfirmState({
      title: `Hapus ${ids.length} Genre Terpilih?`,
      description: `Sebanyak ${ids.length} genre terpilih akan dihapus dari daftar pilihan genre.`,
      confirmLabel: `Hapus (${ids.length})`,
      onConfirm: async () => {
        setGenreBusy(true);
        try {
          if (onBulkDeleteGenres) {
            await onBulkDeleteGenres(ids);
          } else {
            for (const id of ids) {
              await onDeleteGenre(id);
            }
          }
          setSelectedGenreIds(new Set());
          setStatusMsg(`${ids.length} genre berhasil dihapus.`);
        } catch (err) {
          showError(err instanceof Error ? err.message : 'Gagal menghapus genre terpilih.');
        } finally {
          setGenreBusy(false);
          setConfirmState(null);
        }
      },
    });
  };

  const openEdit = (v: VinylRecord) => {
    setSelectedTrackIds(new Set());
    const rt = v.releaseType || 'Song';
    const multi = hasMultipleTracks(v);
    const singleOrMulti: 'single' | 'multi' =
      rt === 'Song'
        ? 'single'
        : isFlexibleReleaseType(rt)
        ? multi
          ? 'multi'
          : 'single'
        : 'multi';

    const parsedGenres = parseGenres(v.genre || v.mood);

    setEditing({
      id: v.id,
      title: v.title,
      artist: v.artist,
      album: v.album,
      releaseType: rt,
      singleOrMulti,
      releaseYear: v.releaseYear,
      duration: v.duration,
      selectedGenres: parsedGenres.length > 0 ? parsedGenres : [genreNames[0] || 'Indie'],
      labelColor: v.labelColor || '#4A2E1B',
      artStyle: v.artStyle || 0,
      coverUrl: v.coverUrl || '',
      showCoverOverlay: v.showCoverOverlay ?? true,
      audioUrl: v.audioUrl || '',
      clipMode: v.clipMode || 'full',
      clipStartSec: v.clipStartSec ?? 0,
      clipEndSec: v.clipEndSec ?? 30,
      favoriteLyric: v.favoriteLyric || '',
      favoriteSong: v.favoriteSong || '',
      tracks: Array.isArray(v.tracks) ? v.tracks : [],
      linerNotes: v.linerNotes || '',
      rackSlot: v.rackSlot ?? null,
    });
  };

  const handleReleaseTypeChange = (nextType: ReleaseType) => {
    setEditing((prev) => {
      if (!prev) return prev;
      let nextMode: 'single' | 'multi' = prev.singleOrMulti;
      if (nextType === 'Song') {
        nextMode = 'single';
      } else if (isFlexibleReleaseType(nextType)) {
        nextMode = prev.tracks.length > 1 ? 'multi' : 'single';
      } else {
        nextMode = 'multi';
      }
      return {
        ...prev,
        releaseType: nextType,
        singleOrMulti: nextMode,
      };
    });
  };

  const toggleEditingGenre = (genreName: string) => {
    setEditing((prev) => {
      if (!prev) return prev;
      const exists = prev.selectedGenres.some(
        (g) => g.toLowerCase() === genreName.toLowerCase()
      );
      if (exists) {
        return {
          ...prev,
          selectedGenres: prev.selectedGenres.filter(
            (g) => g.toLowerCase() !== genreName.toLowerCase()
          ),
        };
      }
      return {
        ...prev,
        selectedGenres: [...prev.selectedGenres, genreName],
      };
    });
  };

  const handleAddInlineGenre = async () => {
    const trimmed = inlineGenreInput.trim();
    if (!trimmed || !editing) return;
    setGenreBusy(true);
    try {
      const canonical = await onAddGenre(trimmed);
      setInlineGenreInput('');
      setEditing((prev) => {
        if (!prev) return prev;
        const already = prev.selectedGenres.some(
          (g) => g.toLowerCase() === canonical.toLowerCase()
        );
        return already
          ? prev
          : { ...prev, selectedGenres: [...prev.selectedGenres, canonical] };
      });
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Gagal menambah genre.');
    } finally {
      setGenreBusy(false);
    }
  };

  const handleConfirmCrop = async (result: ProcessedImageResult) => {
    if (!editing) return;
    setCropFile(null);
    setUploadingCover(true);
    try {
      const publicUrl = await uploadMediaToSupabase(
        result.blob,
        'covers',
        editing.title || 'vinyl-cover',
        'jpg'
      );
      setEditing((prev) => (prev ? { ...prev, coverUrl: publicUrl } : prev));
      setStatusMsg(
        result.wasUpscaled
          ? `Cover di-upload (${result.width}×${result.height}px, Auto-Enhanced).`
          : `Cover HD berhasil di-upload (${result.width}×${result.height}px).`
      );
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Gagal upload cover.');
    } finally {
      setUploadingCover(false);
    }
  };

  const handleMainAudioSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !editing) return;

    setUploadingAudio(true);
    try {
      const secs = await extractAudioDurationSeconds(file);
      const publicUrl = await uploadMediaToSupabase(
        file,
        'audio',
        editing.title || file.name,
        file.name.split('.').pop()?.toLowerCase() || 'mp3'
      );
      setEditing((prev) =>
        prev
          ? {
              ...prev,
              audioUrl: publicUrl,
              duration: secs ? formatDurationSeconds(secs) : prev.duration,
              clipEndSec:
                secs && prev.clipMode === 'snippet'
                  ? Math.min(secs, Math.max(prev.clipStartSec + 10, prev.clipEndSec))
                  : prev.clipEndSec,
            }
          : prev
      );
      setStatusMsg(
        secs
          ? `MP3 berhasil di-upload · Durasi otomatis (${formatDurationSeconds(secs)}).`
          : 'MP3 berhasil di-upload.'
      );
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Gagal upload audio MP3.');
    } finally {
      setUploadingAudio(false);
    }
  };

  // Batch Upload ZIP / Folder / Multiple Audio Files -> Auto Track Title, Duration & Storage Upload
  const handleBatchAudioSelection = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !editing) return;
    const fileArray = Array.from(files);
    e.target.value = '';

    setBatchUploadProgress({
      done: 0,
      total: fileArray.length,
      currentName: 'Mengekstrak daftar file audio...',
    });

    try {
      const extracted = await collectAudioFilesFromSelection(fileArray);

      if (extracted.length === 0) {
        showError(
          'Tidak ditemukan file audio yang didukung (MP3, M4A, WAV, OGG, FLAC) di dalam pilihan atau arsip ZIP tersebut.'
        );
        return;
      }

      const uploadedTracks: TrackItem[] = [];
      let failedCount = 0;

      for (let i = 0; i < extracted.length; i++) {
        const item = extracted[i];
        setBatchUploadProgress({
          done: i,
          total: extracted.length,
          currentName: item.suggestedTitle,
        });

        try {
          const secs = await extractAudioDurationSeconds(item.file);
          const ext = item.file.name.split('.').pop()?.toLowerCase() || 'mp3';
          const publicUrl = await uploadMediaToSupabase(
            item.file,
            'audio',
            item.suggestedTitle || item.file.name,
            ext
          );

          uploadedTracks.push({
            id: `trk-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
            title: item.suggestedTitle,
            duration: secs ? formatDurationSeconds(secs) : '03:30',
            audioUrl: publicUrl,
            clipMode: 'full',
            clipStartSec: 0,
            clipEndSec: secs ? Math.min(30, Math.max(10, Math.round(secs))) : 30,
          });
        } catch {
          failedCount += 1;
        }
      }

      if (uploadedTracks.length > 0) {
        setEditing((prev) => {
          if (!prev) return prev;
          const mergedTracks = [...prev.tracks, ...uploadedTracks];
          const totalSecs = mergedTracks.reduce(
            (acc, t) => acc + parseDurationToSeconds(t.duration),
            0
          );
          return {
            ...prev,
            singleOrMulti: mergedTracks.length > 1 ? 'multi' : prev.singleOrMulti,
            tracks: mergedTracks,
            duration: totalSecs > 0 ? formatTotalDuration(totalSecs) : prev.duration,
          };
        });

        setStatusMsg(
          failedCount > 0
            ? `${uploadedTracks.length} lagu berhasil diimpor otomatis (${failedCount} file gagal). Judul lagu tetap dapat diedit jika perlu.`
            : `${uploadedTracks.length} lagu berhasil diimpor otomatis beserta judul dan durasinya.`
        );
      } else {
        showError('Semua file audio gagal diunggah. Pastikan koneksi dan batas ukuran file aman.');
      }
    } catch (err) {
      showError(
        err instanceof Error ? err.message : 'Gagal membaca arsip ZIP atau folder audio.'
      );
    } finally {
      setBatchUploadProgress(null);
    }
  };

  const handleAddTrackRow = () => {
    if (!editing) return;
    const nextTrack: TrackItem = {
      id: `trk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: '',
      duration: '03:30',
      audioUrl: '',
      clipMode: 'full',
      clipStartSec: 0,
      clipEndSec: 30,
    };
    setEditing({ ...editing, tracks: [...editing.tracks, nextTrack] });
  };

  const updateTrackRow = (trackId: string, patch: Partial<TrackItem>) => {
    setEditing((prev) =>
      prev
        ? {
            ...prev,
            tracks: prev.tracks.map((t) => (t.id === trackId ? { ...t, ...patch } : t)),
          }
        : prev
    );
  };

  const removeTrackRow = (trackId: string) => {
    setEditing((prev) =>
      prev
        ? { ...prev, tracks: prev.tracks.filter((t) => t.id !== trackId) }
        : prev
    );
    setSelectedTrackIds((prev) => {
      const next = new Set(prev);
      next.delete(trackId);
      return next;
    });
  };

  const toggleTrackSelect = (trackId: string) => {
    setSelectedTrackIds((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      return next;
    });
  };

  const allTracksSelected =
    Boolean(editing && editing.tracks.length > 0) &&
    editing!.tracks.every((t) => selectedTrackIds.has(t.id));

  const toggleSelectAllTracks = () => {
    if (!editing) return;
    if (allTracksSelected) {
      setSelectedTrackIds(new Set());
    } else {
      setSelectedTrackIds(new Set(editing.tracks.map((t) => t.id)));
    }
  };

  const requestRemoveSelectedTracks = () => {
    if (!editing || selectedTrackIds.size === 0) return;
    const count = selectedTrackIds.size;

    setConfirmState({
      title: `Hapus ${count} Lagu dari Tracklist?`,
      description: `Sebanyak ${count} lagu yang kamu ceklis akan dihapus dari daftar tracklist ini.`,
      confirmLabel: `Hapus (${count})`,
      onConfirm: () => {
        setEditing((prev) =>
          prev
            ? {
                ...prev,
                tracks: prev.tracks.filter((t) => !selectedTrackIds.has(t.id)),
              }
            : prev
        );
        setSelectedTrackIds(new Set());
        setConfirmState(null);
      },
    });
  };

  const handleTrackAudioSelect = async (
    trackId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !editing) return;

    const targetTrack = editing.tracks.find((t) => t.id === trackId);
    setUploadingTrackId(trackId);
    try {
      const secs = await extractAudioDurationSeconds(file);
      const publicUrl = await uploadMediaToSupabase(
        file,
        'audio',
        targetTrack?.title || file.name,
        file.name.split('.').pop()?.toLowerCase() || 'mp3'
      );
      updateTrackRow(trackId, {
        audioUrl: publicUrl,
        duration: secs ? formatDurationSeconds(secs) : targetTrack?.duration || '03:30',
      });
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Gagal upload MP3 track.');
    } finally {
      setUploadingTrackId(null);
    }
  };

  const handleQuickAddGenre = async () => {
    const trimmed = newGenreName.trim();
    if (!trimmed) return;
    setGenreBusy(true);
    try {
      const canonical = await onAddGenre(trimmed);
      setNewGenreName('');
      if (editing) {
        const already = editing.selectedGenres.some(
          (g) => g.toLowerCase() === canonical.toLowerCase()
        );
        if (!already) {
          setEditing({
            ...editing,
            selectedGenres: [...editing.selectedGenres, canonical],
          });
        }
      }
      setStatusMsg(`Genre "${canonical}" ditambahkan ke daftar pilihan.`);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Gagal menambah genre.');
    } finally {
      setGenreBusy(false);
    }
  };

  const requestRemoveGenre = (g: GenreItem) => {
    setConfirmState({
      title: `Hapus Genre "${g.name}"?`,
      description: `Genre "${g.name}" akan dihapus dari daftar pilihan genre di dashboard admin.`,
      confirmLabel: 'Hapus Genre',
      onConfirm: async () => {
        setGenreBusy(true);
        try {
          await onDeleteGenre(g.id);
          setSelectedGenreIds((prev) => {
            const next = new Set(prev);
            next.delete(g.id);
            return next;
          });
          setStatusMsg(`Genre "${g.name}" dihapus dari daftar pilihan.`);
        } catch (err) {
          showError(err instanceof Error ? err.message : 'Gagal menghapus genre.');
        } finally {
          setGenreBusy(false);
          setConfirmState(null);
        }
      },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (!editing.title.trim() || !editing.artist.trim()) return;

    const isSingleMode =
      editing.releaseType === 'Song' ||
      (isFlexibleReleaseType(editing.releaseType) && editing.singleOrMulti === 'single');

    const cleanedTracks = isSingleMode
      ? []
      : editing.tracks
          .filter((t) => t.title.trim().length > 0)
          .map((t) => ({
            ...t,
            title: t.title.trim(),
            duration: t.duration.trim() || '03:30',
          }));

    const resolvedGenreString =
      formatGenres(editing.selectedGenres) || 'Indie';

    let resolvedAudioUrl = editing.audioUrl.trim() || undefined;
    let resolvedClipMode: ClipMode = editing.clipMode;
    let resolvedClipStart = editing.clipStartSec;
    let resolvedClipEnd = editing.clipEndSec;

    if (!isSingleMode && !resolvedAudioUrl && cleanedTracks.length > 0) {
      const favTrack =
        cleanedTracks.find(
          (t) =>
            editing.favoriteSong.trim() &&
            t.title.toLowerCase() === editing.favoriteSong.trim().toLowerCase() &&
            t.audioUrl
        ) || cleanedTracks.find((t) => Boolean(t.audioUrl));

      if (favTrack?.audioUrl) {
        resolvedAudioUrl = favTrack.audioUrl;
        resolvedClipMode = favTrack.clipMode || 'full';
        resolvedClipStart = favTrack.clipStartSec ?? 0;
        resolvedClipEnd = favTrack.clipEndSec ?? 30;
      }
    }
    setErrorMsg(null);
    setSaving(true);
    try {
      const payload: Partial<VinylRecord> = {
        title: editing.title.trim(),
        artist: editing.artist.trim(),
        album: isSingleMode
          ? editing.album.trim()
          : editing.album.trim() || editing.title.trim(),
        releaseType: editing.releaseType,
        releaseYear: Number(editing.releaseYear) || new Date().getFullYear(),
        duration: editing.duration.trim() || '03:30',
        genre: resolvedGenreString,
        mood: resolvedGenreString,
        labelColor: editing.labelColor,
        artStyle: editing.artStyle,
        coverUrl: editing.coverUrl || undefined,
        showCoverOverlay: editing.showCoverOverlay,
        audioUrl: resolvedAudioUrl,
        clipMode: resolvedClipMode,
        clipStartSec: Math.max(0, Number(resolvedClipStart) || 0),
        clipEndSec: Math.max(
          (Number(resolvedClipStart) || 0) + 5,
          Number(resolvedClipEnd) || 30
        ),
        favoriteLyric: isSingleMode ? editing.favoriteLyric.trim() : '',
        favoriteSong: !isSingleMode ? editing.favoriteSong.trim() : '',
        tracks: cleanedTracks,
        linerNotes: editing.linerNotes.trim(),
        rackSlot: editing.rackSlot,
      };

      if (editing.id) {
        await onUpdateVinyl({ id: editing.id, ...payload });
        setStatusMsg(`"${payload.title}" berhasil diperbarui.`);
      } else {
        await onCreateVinyl(payload);
        setStatusMsg(`"${payload.title}" berhasil ditambahkan ke koleksi.`);
      }
      setEditing(null);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Gagal menyimpan vinyl.');
    } finally {
      setSaving(false);
    }
  };

  const requestDeleteVinyl = (v: VinylRecord) => {
    setConfirmState({
      title: 'Hapus Koleksi Vinyl?',
      description: `"${v.title}" oleh ${v.artist} akan dihapus secara permanen dari koleksi dan ruangan 3D.`,
      confirmLabel: 'Hapus Koleksi',
      onConfirm: async () => {
        setBulkDeletingVinyls(true);
        try {
          await onDeleteVinyl(v.id);
          setSelectedVinylIds((prev) => {
            const next = new Set(prev);
            next.delete(v.id);
            return next;
          });
          setStatusMsg(`"${v.title}" dihapus.`);
        } catch (err) {
          showError(err instanceof Error ? err.message : 'Gagal menghapus vinyl.');
        } finally {
          setBulkDeletingVinyls(false);
          setConfirmState(null);
        }
      },
    });
  };

  const getThumb = (v: VinylRecord) =>
    v.coverUrl || (typeof window !== 'undefined' ? getSleeveDataUrl(v) : '');

  const isSingleMode =
    editing?.releaseType === 'Song' ||
    (Boolean(editing) &&
      isFlexibleReleaseType(editing!.releaseType) &&
      editing!.singleOrMulti === 'single');

  const isUploadingAny =
    uploadingCover ||
    uploadingAudio ||
    uploadingTrackId !== null ||
    batchUploadProgress !== null;

  return (
    <div className="space-y-5">
      {statusMsg && (
        <div className="flex items-center justify-between gap-2 rounded-2xl border border-emerald-700/25 bg-emerald-500/12 px-4 py-3 text-xs font-semibold text-emerald-950">
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
            {statusMsg}
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

      {errorMsg && (
        <div className="flex items-center justify-between gap-2 rounded-2xl border border-[#6E1D2C]/25 bg-[#6E1D2C]/10 px-4 py-3 text-xs font-semibold text-[#571622]">
          <span className="inline-flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-[#6E1D2C]" />
            {errorMsg}
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

      {/* Top Toolbar + Release Type Filters + Bulk Delete Controls + Genre Manager */}
      <div className="space-y-3 rounded-[22px] border border-[#E5D7C3] bg-[#FAF5EC]/85 p-4 shadow-sm backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari judul, penyanyi, album, atau genre..."
            className="w-full max-w-sm rounded-xl border border-[#4A2E1B]/15 bg-white px-3.5 py-2 text-xs text-[#241A13] placeholder-[#9B8776] outline-none focus:border-[#4A2E1B]"
          />

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowGenreManager((prev) => !prev)}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                showGenreManager
                  ? 'border-[#4A2E1B] bg-[#4A2E1B] text-[#FAF5EC]'
                  : 'border-[#4A2E1B]/20 bg-white text-[#4A2E1B] hover:bg-[#F3E9DA]'
              }`}
            >
              <Tag className="h-3.5 w-3.5" />
              <span>Kelola Genre ({genres.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedTrackIds(new Set());
                setEditing(createEmptyForm(genreNames[0] || 'Indie'));
              }}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#4A2E1B] px-4 py-2 text-xs font-semibold text-[#FAF5EC] shadow-md transition hover:bg-[#3A2213]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Tambah Koleksi</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-[#4A2E1B]/10 pt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(['ALL', ...RELEASE_TYPES] as const).map((rt) => (
              <button
                key={rt}
                type="button"
                onClick={() => setTypeFilter(rt)}
                className={`cursor-pointer rounded-full border px-3 py-1 font-mono text-[10px] font-semibold uppercase transition ${
                  typeFilter === rt
                    ? 'border-[#4A2E1B] bg-[#4A2E1B] text-[#FAF5EC]'
                    : 'border-[#4A2E1B]/15 bg-white/80 text-[#5C4432] hover:bg-white'
                }`}
              >
                {rt === 'ALL' ? `SEMUA (${vinyls.length})` : rt}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {filteredVinyls.length > 0 && (
              <button
                type="button"
                onClick={toggleSelectAllVinyls}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#4A2E1B]/20 bg-white px-3 py-1.5 text-xs font-semibold text-[#4A2E1B] transition hover:bg-[#EFE4D3]"
              >
                {allFilteredVinylsSelected ? (
                  <CheckSquare className="h-3.5 w-3.5" />
                ) : (
                  <Square className="h-3.5 w-3.5" />
                )}
                <span>{allFilteredVinylsSelected ? 'Batal Pilih Semua' : 'Pilih Semua'}</span>
              </button>
            )}

            {selectedVinylIds.size > 0 && (
              <button
                type="button"
                disabled={bulkDeletingVinyls}
                onClick={requestBulkDeleteVinyls}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#6E1D2C] px-3.5 py-1.5 text-xs font-semibold text-[#FAF5EC] shadow-xs transition hover:bg-[#571622] disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>
                  {bulkDeletingVinyls
                    ? 'Menghapus...'
                    : `Hapus Terpilih (${selectedVinylIds.size})`}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Expandable Genre Manager */}
        {showGenreManager && (
          <div className="rounded-2xl border border-[#4A2E1B]/15 bg-white/88 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-[10px] font-semibold tracking-[0.14em] text-[#7A5230] uppercase">
                KELOLA DAFTAR GENRE (TAMBAH &amp; HAPUS SATUAN / MASSAL)
              </p>

              <div className="flex items-center gap-2">
                {genres.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleSelectAllGenres}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#4A2E1B]/20 bg-[#FAF5EC] px-2.5 py-1 text-[10.5px] font-semibold text-[#4A2E1B] hover:bg-[#EFE4D3]"
                  >
                    {allGenresSelected ? (
                      <CheckSquare className="h-3 w-3" />
                    ) : (
                      <Square className="h-3 w-3" />
                    )}
                    <span>{allGenresSelected ? 'Batal Semua' : 'Pilih Semua'}</span>
                  </button>
                )}

                {selectedGenreIds.size > 0 && (
                  <button
                    type="button"
                    disabled={genreBusy}
                    onClick={requestBulkDeleteGenres}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-[#6E1D2C] px-2.5 py-1 text-[10.5px] font-semibold text-[#FAF5EC] hover:bg-[#571622] disabled:opacity-50"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Hapus Terpilih ({selectedGenreIds.size})</span>
                  </button>
                )}
              </div>
            </div>

            <div className="mt-2.5 flex flex-wrap gap-2">
              <input
                type="text"
                value={newGenreName}
                onChange={(e) => setNewGenreName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleQuickAddGenre();
                  }
                }}
                placeholder="Nama genre baru (misal: Shoegaze, Jazz, Dream Pop)..."
                className="flex-1 rounded-xl border border-[#4A2E1B]/18 bg-white px-3 py-1.5 text-xs text-[#241A13] outline-none focus:border-[#4A2E1B]"
              />
              <button
                type="button"
                disabled={genreBusy || !newGenreName.trim()}
                onClick={handleQuickAddGenre}
                className="inline-flex cursor-pointer items-center gap-1 rounded-xl bg-[#4A2E1B] px-3.5 py-1.5 text-xs font-semibold text-[#FAF5EC] transition hover:bg-[#3A2213] disabled:opacity-45"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Tambah</span>
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {genres.length === 0 ? (
                <span className="text-xs text-[#7A624E]">Belum ada genre tersimpan.</span>
              ) : (
                genres.map((g) => {
                  const isChecked = selectedGenreIds.has(g.id);
                  return (
                    <span
                      key={g.id}
                      className={`inline-flex items-center gap-1.5 rounded-full border py-1 pr-2 pl-2.5 font-mono text-[10.5px] font-semibold transition ${
                        isChecked
                          ? 'border-[#4A2E1B] bg-[#EFE4D3] text-[#241A13]'
                          : 'border-[#4A2E1B]/18 bg-[#FAF5EC] text-[#3A2213]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleGenreSelect(g.id)}
                        aria-label={`Pilih genre ${g.name}`}
                        className="h-3 w-3 cursor-pointer accent-[#4A2E1B]"
                      />
                      <span>{g.name}</span>
                      <button
                        type="button"
                        disabled={genreBusy}
                        onClick={() => requestRemoveGenre(g)}
                        className="flex h-4 w-4 cursor-pointer items-center justify-center rounded-full bg-[#4A2E1B]/12 text-[#4A2E1B] transition hover:bg-[#6E1D2C] hover:text-white"
                        title={`Hapus genre ${g.name}`}
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Vinyl Collection Cards */}
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        {filteredVinyls.map((v) => {
          const isOnTurntable = v.id === activeTurntableVinylId;
          const isMulti = hasMultipleTracks(v);
          const isSelected = selectedVinylIds.has(v.id);
          const gList = parseGenres(v.genre || v.mood);

          return (
            <article
              key={v.id}
              className={`flex gap-3 rounded-[22px] border p-4 shadow-xs backdrop-blur-lg transition ${
                isSelected
                  ? 'border-[#4A2E1B] bg-[#F3E8D7]/88 ring-1 ring-[#4A2E1B]/25'
                  : 'border-[#E5D7C3] bg-[#FAF5EC]/85 hover:bg-white/95'
              }`}
            >
              <div className="flex shrink-0 items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleVinylSelect(v.id)}
                  aria-label={`Pilih koleksi ${v.title}`}
                  className="mt-1 h-4 w-4 cursor-pointer accent-[#4A2E1B]"
                />
                <img
                  src={getThumb(v)}
                  alt={v.title}
                  className="h-20 w-20 shrink-0 rounded-xl border border-black/10 object-cover shadow-xs"
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-[#4A2E1B] px-2 py-0.5 font-mono text-[9px] font-semibold text-[#FAF5EC] uppercase">
                    {v.releaseType}
                  </span>
                  {gList.map((g) => (
                    <span
                      key={g}
                      className="rounded-full bg-[#4A2E1B]/10 px-2 py-0.5 font-mono text-[9px] font-semibold text-[#5C3B24] uppercase"
                    >
                      {g}
                    </span>
                  ))}
                  {v.clipMode === 'snippet' && (
                    <span className="rounded-full bg-[#B58A52]/20 px-2 py-0.5 font-mono text-[9px] font-semibold text-[#6E4D1B] uppercase">
                      SEBAGIAN ({formatSecLabel(v.clipStartSec ?? 0)}-
                      {formatSecLabel(v.clipEndSec ?? 30)})
                    </span>
                  )}
                  {isOnTurntable && (
                    <span className="rounded-full bg-emerald-600/15 px-2 py-0.5 font-mono text-[9px] font-semibold text-emerald-900 uppercase">
                      TURNTABLE
                    </span>
                  )}
                  {!isOnTurntable && v.rackSlot && (
                    <span className="rounded-full bg-[#C89B54]/22 px-2 py-0.5 font-mono text-[9px] font-semibold text-[#6E4D1B] uppercase">
                      RAK #{v.rackSlot}
                    </span>
                  )}
                </div>

                <h3 className="mt-1 truncate font-serif text-xl leading-snug text-[#241A13]">
                  {v.title}
                </h3>
                <p className="truncate text-xs text-[#655040]">
                  {v.artist} · {v.releaseYear} ·{' '}
                  {isMulti ? `${v.tracks?.length || 0} lagu` : v.duration}
                </p>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 font-mono text-[9.5px] text-[#7A624E]">
                    <Volume2 className="h-3 w-3" />
                    {v.audioUrl || (v.tracks && v.tracks.some((t) => t.audioUrl))
                      ? 'MP3 Terpasang'
                      : 'Audio Analog Default'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEdit(v)}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#4A2E1B]/18 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#3A2213] transition hover:border-[#4A2E1B] hover:bg-[#4A2E1B] hover:text-[#FAF5EC]"
                    >
                      <Edit3 className="h-3 w-3" />
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={bulkDeletingVinyls}
                      onClick={() => requestDeleteVinyl(v)}
                      className="cursor-pointer rounded-lg border border-[#4A2E1B]/12 bg-white p-1.5 text-[#8A7360] transition hover:border-[#6E1D2C]/40 hover:bg-[#6E1D2C]/10 hover:text-[#6E1D2C] disabled:opacity-45"
                      title="Hapus vinyl"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* FULL VINYL EDITOR MODAL (Portal at z-[90]) */}
      {editing &&
        mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-[#18110C]/62 p-4 backdrop-blur-md"
            onClick={() => {
              if (!batchUploadProgress) setEditing(null);
            }}
          >
            <form
              onSubmit={handleSubmit}
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[26px] border border-[#E7DAC7] bg-[#FAF5EC] text-[#241A13] shadow-2xl"
            >
              {/* Modal Header */}
              <div className="flex shrink-0 items-center justify-between border-b border-[#4A2E1B]/12 bg-[#F4ECE0] px-6 py-4">
                <div className="flex items-center gap-2">
                  <Disc3 className="h-4 w-4 text-[#4A2E1B]" />
                  <h2 className="font-serif text-2xl text-[#241A13]">
                    {editing.id ? 'Edit Koleksi Vinyl' : 'Tambah Koleksi Baru'}
                  </h2>
                </div>
                <button
                  type="button"
                  disabled={Boolean(batchUploadProgress)}
                  onClick={() => setEditing(null)}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[#4A2E1B]/15 bg-[#FAF5EC] text-[#4A2E1B] hover:bg-white disabled:opacity-40"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Modal Scrollable Form Body */}
              <div className="orihour-scroll grid flex-1 grid-cols-1 gap-6 overflow-y-auto p-6 lg:grid-cols-12">
                {/* Left Column: Cover Art + Disc Preview + Main Audio & Snippet Trimmer */}
                <div className="space-y-4 lg:col-span-5">
                  <div className="rounded-2xl border border-[#4A2E1B]/12 bg-white/85 p-4">
                    <p className="font-mono text-[10px] font-semibold tracking-[0.14em] text-[#7A5230] uppercase">
                      COVER ART &amp; LABEL PIRINGAN
                    </p>

                    <div className="mt-3 flex items-center gap-4">
                      <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-xl border border-black/12 bg-[#1B140F] shadow-md">
                        {editing.coverUrl ? (
                          <img
                            src={editing.coverUrl}
                            alt="Cover"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div
                            className="flex h-full w-full items-center justify-center text-white/70"
                            style={{
                              background: `linear-gradient(135deg, ${editing.labelColor}, #12151E)`,
                            }}
                          >
                            <ImageIcon className="h-8 w-8" />
                          </div>
                        )}
                        {editing.showCoverOverlay && (
                          <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/82 via-black/55 to-transparent px-2.5 pt-2 pb-4 text-white">
                            <p className="truncate text-[10px] font-bold leading-tight">
                              {editing.title || 'Judul'}
                            </p>
                            <p className="truncate font-mono text-[8px] text-white/80">
                              {editing.artist || 'Penyanyi'} · {editing.releaseYear}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-center">
                        <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-[#111318] shadow-md">
                          <div
                            className="relative flex h-11 w-11 flex-col items-center justify-center rounded-full px-1 text-center text-white ring-1 ring-white/50"
                            style={{ backgroundColor: editing.labelColor }}
                          >
                            <span className="font-mono text-[4.5px] opacity-80">ORIHOUR</span>
                            <span className="mt-1.5 max-w-[36px] truncate text-[5.5px] font-bold">
                              {editing.title || 'Track'}
                            </span>
                            <span className="absolute h-1.5 w-1.5 rounded-full bg-[#090A0D]" />
                          </div>
                        </div>
                        <span className="mt-1.5 text-center font-mono text-[9px] text-[#735D4B]">
                          Nama di piringan otomatis ikut cover
                        </span>
                      </div>
                    </div>

                    <input
                      ref={coverInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        if (f) setCropFile(f);
                      }}
                    />

                    <div className="mt-3.5 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={uploadingCover}
                        onClick={() => coverInputRef.current?.click()}
                        className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#4A2E1B] px-3 py-2 text-xs font-semibold text-[#FAF5EC] transition hover:bg-[#3A2213] disabled:opacity-50"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        <span>
                          {uploadingCover ? 'Mengupload...' : 'Upload, Crop & Rotasi Cover'}
                        </span>
                      </button>
                      {editing.coverUrl && (
                        <button
                          type="button"
                          onClick={() => setEditing({ ...editing, coverUrl: '' })}
                          className="cursor-pointer rounded-xl border border-[#4A2E1B]/18 bg-white px-2.5 py-2 text-xs text-[#6B5442] hover:text-[#6E1D2C]"
                          title="Hapus cover kustom"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-[#3A2B20]">
                      <input
                        type="checkbox"
                        checked={editing.showCoverOverlay}
                        onChange={(e) =>
                          setEditing({ ...editing, showCoverOverlay: e.target.checked })
                        }
                        className="h-4 w-4 accent-[#4A2E1B]"
                      />
                      <span>Tampilkan judul, penyanyi &amp; tahun di atas cover</span>
                    </label>

                    <div className="mt-3.5 border-t border-[#4A2E1B]/10 pt-3">
                      <span className="font-mono text-[9.5px] font-semibold tracking-wider text-[#5C4432] uppercase">
                        Warna Label Tengah Piringan
                      </span>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {LABEL_SWATCHES.map((hex) => (
                          <button
                            key={hex}
                            type="button"
                            onClick={() => setEditing({ ...editing, labelColor: hex })}
                            className={`h-6 w-6 cursor-pointer rounded-full border-2 transition ${
                              editing.labelColor === hex
                                ? 'scale-110 border-[#241A13]'
                                : 'border-white shadow-xs'
                            }`}
                            style={{ backgroundColor: hex }}
                          />
                        ))}
                        <input
                          type="color"
                          value={editing.labelColor}
                          onChange={(e) =>
                            setEditing({ ...editing, labelColor: e.target.value })
                          }
                          className="h-6 w-7 cursor-pointer rounded border border-[#4A2E1B]/20 bg-white p-0.5"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Main Audio MP3 + Draggable Snippet Trimmer */}
                  <div className="rounded-2xl border border-[#4A2E1B]/12 bg-white/85 p-4">
                    <p className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-[0.14em] text-[#7A5230] uppercase">
                      <Music2 className="h-3.5 w-3.5" />
                      {isSingleMode
                        ? 'AUDIO LAGU (MP3) & DURASI PUTAR'
                        : 'AUDIO UTAMA TURNTABLE (OPSIONAL)'}
                    </p>
                    <p className="mt-1 text-[11px] text-[#6B5442]">
                      {isSingleMode
                        ? 'Upload MP3, lalu pilih putar Full Song atau geser rentang & playhead snippet bebas.'
                        : 'Opsional. Jika dikosongkan, turntable otomatis memutar lagu favorit / lagu pertama dari daftar track.'}
                    </p>

                    <input
                      ref={audioInputRef}
                      type="file"
                      accept="audio/mpeg,audio/mp3,audio/mp4,audio/wav,audio/ogg,audio/flac"
                      className="hidden"
                      onChange={handleMainAudioSelect}
                    />

                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        disabled={uploadingAudio}
                        onClick={() => audioInputRef.current?.click()}
                        className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#4A2E1B]/25 bg-[#F2E7D7] px-3 py-2 text-xs font-semibold text-[#4A2E1B] transition hover:bg-[#E7D6BE] disabled:opacity-50"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        <span>{uploadingAudio ? 'Mengupload MP3...' : 'Upload File MP3'}</span>
                      </button>
                      {editing.audioUrl && (
                        <button
                          type="button"
                          onClick={() => setEditing({ ...editing, audioUrl: '' })}
                          className="cursor-pointer rounded-xl border border-[#4A2E1B]/18 bg-white px-2.5 py-2 text-xs text-[#6B5442] hover:text-[#6E1D2C]"
                          title="Hapus file audio"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {editing.audioUrl && editing.clipMode === 'full' && (
                      <audio controls src={editing.audioUrl} className="mt-3 h-9 w-full" />
                    )}

                    {/* Full Song vs Snippet Selector */}
                    <div className="mt-3.5 border-t border-[#4A2E1B]/10 pt-3">
                      <span className="inline-flex items-center gap-1 font-mono text-[9.5px] font-semibold tracking-wider text-[#5C4432] uppercase">
                        <Scissors className="h-3 w-3" />
                        Mode Pemutaran Audio
                      </span>
                      <div className="mt-1.5 grid grid-cols-2 gap-2">
                        {(
                          [
                            { id: 'full', label: 'Full Song' },
                            { id: 'snippet', label: 'Sebagian Lagu' },
                          ] as const
                        ).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setEditing({ ...editing, clipMode: opt.id })}
                            className={`cursor-pointer rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                              editing.clipMode === opt.id
                                ? 'border-[#4A2E1B] bg-[#4A2E1B] text-[#FAF5EC]'
                                : 'border-[#4A2E1B]/18 bg-white text-[#4A2E1B] hover:bg-[#F5ECE0]'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      {editing.clipMode === 'snippet' && (
                        <div className="mt-3">
                          <SnippetTrimmer
                            audioUrl={editing.audioUrl || undefined}
                            durationLabel={editing.duration}
                            startSec={editing.clipStartSec}
                            endSec={editing.clipEndSec}
                            onChange={(nextStart, nextEnd) =>
                              setEditing((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      clipStartSec: nextStart,
                                      clipEndSec: nextEnd,
                                    }
                                  : prev
                              )
                            }
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column: Release Type Switch + Metadata + Multi-Genre + Dynamic Fields */}
                <div className="space-y-3.5 lg:col-span-7">
                  <div className="rounded-2xl border border-[#4A2E1B]/15 bg-[#F4ECE0]/80 p-3.5">
                    <span className="font-mono text-[10px] font-semibold tracking-wider text-[#5C4432] uppercase">
                      Jenis Koleksi / Rilisan *
                    </span>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {RELEASE_TYPES.map((rt) => (
                        <button
                          key={rt}
                          type="button"
                          onClick={() => handleReleaseTypeChange(rt)}
                          className={`cursor-pointer rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                            editing.releaseType === rt
                              ? 'border-[#4A2E1B] bg-[#4A2E1B] text-[#FAF5EC] shadow-xs'
                              : 'border-[#4A2E1B]/18 bg-white text-[#4A2E1B] hover:bg-[#FAF5EC]'
                          }`}
                        >
                          {rt === 'Song' ? 'Lagu Favorit (Song)' : rt}
                        </button>
                      ))}
                    </div>

                    {/* Single vs Multi-Track Option for Live Version & Cover */}
                    {isFlexibleReleaseType(editing.releaseType) && (
                      <div className="mt-3 border-t border-[#4A2E1B]/10 pt-3">
                        <span className="font-mono text-[9.5px] font-semibold tracking-wider text-[#5C4432] uppercase">
                          Format {editing.releaseType}
                        </span>
                        <div className="mt-1.5 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setEditing({ ...editing, singleOrMulti: 'single' })
                            }
                            className={`cursor-pointer rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                              editing.singleOrMulti === 'single'
                                ? 'border-[#4A2E1B] bg-[#4A2E1B] text-[#FAF5EC]'
                                : 'border-[#4A2E1B]/18 bg-white text-[#4A2E1B] hover:bg-[#FAF5EC]'
                            }`}
                          >
                            1 Lagu (Favorite Lyrics)
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setEditing({ ...editing, singleOrMulti: 'multi' })
                            }
                            className={`cursor-pointer rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                              editing.singleOrMulti === 'multi'
                                ? 'border-[#4A2E1B] bg-[#4A2E1B] text-[#FAF5EC]'
                                : 'border-[#4A2E1B]/18 bg-white text-[#4A2E1B] hover:bg-[#FAF5EC]'
                            }`}
                          >
                            Banyak Lagu (Tracklist &amp; Fav Song)
                          </button>
                        </div>
                      </div>
                    )}

                    <p className="mt-2 text-[11px] text-[#6E5643]">
                      {isSingleMode
                        ? 'Mode 1 Lagu: menggunakan Favorite Lyrics, di katalog pengunjung tombolnya otomatis "Details".'
                        : `Mode Multi-Track (${editing.releaseType}): gunakan daftar tracklist & Favorite Song, di katalog pengunjung tombolnya otomatis "Tracklist".`}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="font-mono text-[10px] font-semibold tracking-wider text-[#5C4432] uppercase">
                        {isSingleMode ? 'Judul Lagu *' : `Judul ${editing.releaseType} *`}
                      </span>
                      <input
                        type="text"
                        required
                        value={editing.title}
                        onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                        placeholder={isSingleMode ? 'e.g. Cornerstone' : 'e.g. Currents'}
                        className="mt-1 w-full rounded-xl border border-[#4A2E1B]/18 bg-white px-3 py-2 text-sm text-[#241A13] outline-none focus:border-[#4A2E1B]"
                      />
                    </label>

                    <label className="block">
                      <span className="font-mono text-[10px] font-semibold tracking-wider text-[#5C4432] uppercase">
                        Nama Penyanyi / Band *
                      </span>
                      <input
                        type="text"
                        required
                        value={editing.artist}
                        onChange={(e) => setEditing({ ...editing, artist: e.target.value })}
                        placeholder="e.g. Tame Impala"
                        className="mt-1 w-full rounded-xl border border-[#4A2E1B]/18 bg-white px-3 py-2 text-sm text-[#241A13] outline-none focus:border-[#4A2E1B]"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {isSingleMode && (
                      <label className="col-span-2 block sm:col-span-1">
                        <span className="font-mono text-[10px] font-semibold tracking-wider text-[#5C4432] uppercase">
                          Dari Album (Opsional)
                        </span>
                        <input
                          type="text"
                          value={editing.album}
                          onChange={(e) => setEditing({ ...editing, album: e.target.value })}
                          placeholder="e.g. Humbug"
                          className="mt-1 w-full rounded-xl border border-[#4A2E1B]/18 bg-white px-3 py-2 text-sm text-[#241A13] outline-none focus:border-[#4A2E1B]"
                        />
                      </label>
                    )}

                    <label className="block">
                      <span className="font-mono text-[10px] font-semibold tracking-wider text-[#5C4432] uppercase">
                        Tahun Rilis *
                      </span>
                      <input
                        type="number"
                        min={1900}
                        max={2100}
                        required
                        value={editing.releaseYear}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            releaseYear: parseInt(e.target.value, 10) || 2026,
                          })
                        }
                        className="mt-1 w-full rounded-xl border border-[#4A2E1B]/18 bg-white px-3 py-2 text-sm text-[#241A13] outline-none focus:border-[#4A2E1B]"
                      />
                    </label>

                    <label className="block">
                      <span className="font-mono text-[10px] font-semibold tracking-wider text-[#5C4432] uppercase">
                        {isSingleMode ? 'Durasi Lagu *' : 'Total Durasi'}
                      </span>
                      <input
                        type="text"
                        required
                        value={editing.duration}
                        onChange={(e) => setEditing({ ...editing, duration: e.target.value })}
                        placeholder={isSingleMode ? '03:45' : '42:10'}
                        className="mt-1 w-full rounded-xl border border-[#4A2E1B]/18 bg-white px-3 py-2 font-mono text-sm text-[#241A13] outline-none focus:border-[#4A2E1B]"
                      />
                    </label>

                    {!isSingleMode && (
                      <div className="col-span-2 sm:col-span-1">
                        <span className="block font-mono text-[10px] font-semibold tracking-wider text-[#5C4432] uppercase">
                          Slot Kontainer Rak
                        </span>
                        <ThemedDropdown
                          value={editing.rackSlot !== null ? String(editing.rackSlot) : ''}
                          options={RACK_SLOT_OPTIONS}
                          onChange={(val) =>
                            setEditing({
                              ...editing,
                              rackSlot: val ? parseInt(val, 10) : null,
                            })
                          }
                          ariaLabel="Pilih slot kontainer rak"
                          size="sm"
                          className="mt-1"
                        />
                      </div>
                    )}
                  </div>

                  {/* Multi-Genre Selector Chips + Inline Quick Add */}
                  <div className="rounded-2xl border border-[#4A2E1B]/15 bg-white/85 p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] font-semibold tracking-wider text-[#5C4432] uppercase">
                        Genre (Bisa Pilih Lebih dari Satu) *
                      </span>
                      <span className="font-mono text-[9.5px] font-semibold text-[#7A5230]">
                        {editing.selectedGenres.length} dipilih
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {genreNames.map((gName) => {
                        const active = editing.selectedGenres.some(
                          (s) => s.toLowerCase() === gName.toLowerCase()
                        );
                        return (
                          <button
                            key={gName}
                            type="button"
                            onClick={() => toggleEditingGenre(gName)}
                            className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold transition ${
                              active
                                ? 'border-[#4A2E1B] bg-[#4A2E1B] text-[#FAF5EC] shadow-xs'
                                : 'border-[#4A2E1B]/18 bg-[#FAF5EC] text-[#5C4432] hover:border-[#4A2E1B]/45 hover:bg-white'
                            }`}
                          >
                            {active && <Check className="h-2.5 w-2.5" />}
                            <span>{gName}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-2.5 flex gap-2 border-t border-[#4A2E1B]/10 pt-2.5">
                      <input
                        type="text"
                        value={inlineGenreInput}
                        onChange={(e) => setInlineGenreInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void handleAddInlineGenre();
                          }
                        }}
                        placeholder="Tambah genre baru & langsung pilih..."
                        className="flex-1 rounded-xl border border-[#4A2E1B]/16 bg-[#FAF5EC]/70 px-3 py-1.5 text-xs text-[#241A13] outline-none focus:border-[#4A2E1B] focus:bg-white"
                      />
                      <button
                        type="button"
                        disabled={genreBusy || !inlineGenreInput.trim()}
                        onClick={() => void handleAddInlineGenre()}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-[#4A2E1B]/20 bg-[#F2E7D7] px-3 py-1.5 text-xs font-semibold text-[#4A2E1B] hover:bg-[#E7D6BE] disabled:opacity-45"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Tambah</span>
                      </button>
                    </div>
                  </div>

                  {isSingleMode && (
                    <div>
                      <span className="block font-mono text-[10px] font-semibold tracking-wider text-[#5C4432] uppercase">
                        Slot Kontainer Rak
                      </span>
                      <ThemedDropdown
                        value={editing.rackSlot !== null ? String(editing.rackSlot) : ''}
                        options={RACK_SLOT_OPTIONS}
                        onChange={(val) =>
                          setEditing({
                            ...editing,
                            rackSlot: val ? parseInt(val, 10) : null,
                          })
                        }
                        ariaLabel="Pilih slot kontainer rak"
                        size="sm"
                        className="mt-1"
                      />
                    </div>
                  )}

                  {/* CONDITIONAL SECTION: Single Song vs Multi-Track */}
                  {isSingleMode ? (
                    <label className="block">
                      <span className="font-mono text-[10px] font-semibold tracking-wider text-[#5C4432] uppercase">
                        Favorite Lyrics (Opsional — Kosongkan Jika Tidak Ada)
                      </span>
                      <textarea
                        rows={2}
                        value={editing.favoriteLyric}
                        onChange={(e) =>
                          setEditing({ ...editing, favoriteLyric: e.target.value })
                        }
                        placeholder="Kutipan lirik favorit yang tampil di jurnal meja, liner notes & katalog lo-fi..."
                        className="mt-1 w-full resize-none rounded-xl border border-[#4A2E1B]/18 bg-white px-3 py-2 text-sm text-[#241A13] outline-none focus:border-[#4A2E1B]"
                      />
                    </label>
                  ) : (
                    <>
                      <label className="block">
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold tracking-wider text-[#5C4432] uppercase">
                          <Star className="h-3 w-3 text-[#B58A52]" />
                          Favorite Song (Opsional — Dari {editing.releaseType} Ini)
                        </span>
                        <input
                          type="text"
                          list="orihour-album-tracklist-datalist"
                          value={editing.favoriteSong}
                          onChange={(e) =>
                            setEditing({ ...editing, favoriteSong: e.target.value })
                          }
                          placeholder="Pilih dari daftar lagu di bawah atau ketik judul lagu favorit..."
                          className="mt-1 w-full rounded-xl border border-[#4A2E1B]/18 bg-white px-3 py-2 text-sm text-[#241A13] outline-none focus:border-[#4A2E1B]"
                        />
                        <datalist id="orihour-album-tracklist-datalist">
                          {editing.tracks
                            .filter((t) => t.title.trim())
                            .map((t) => (
                              <option key={t.id} value={t.title.trim()} />
                            ))}
                        </datalist>
                      </label>

                      {/* Tracklist Builder + Batch Folder / ZIP / Multi-MP3 Upload */}
                      <div className="rounded-2xl border border-[#4A2E1B]/15 bg-white/85 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-[0.14em] text-[#7A5230] uppercase">
                              <ListMusic className="h-3.5 w-3.5" />
                              DAFTAR LAGU ({editing.tracks.length} TRACK)
                            </p>
                            <p className="mt-0.5 text-[11px] text-[#735D4B]">
                              Upload folder atau file .ZIP kumpulan lagu untuk menangkap judul &amp; MP3 otomatis (judul tetap bisa diedit).
                            </p>
                          </div>

                          {/* Hidden Inputs for Folder and ZIP/Multi-Audio */}
                          <input
                            ref={bindFolderInputRef}
                            type="file"
                            multiple
                            className="hidden"
                            onChange={(e) => void handleBatchAudioSelection(e)}
                          />
                          <input
                            ref={zipOrMultiInputRef}
                            type="file"
                            multiple
                            accept=".zip,application/zip,audio/mpeg,audio/mp3,audio/mp4,audio/wav,audio/ogg,audio/flac"
                            className="hidden"
                            onChange={(e) => void handleBatchAudioSelection(e)}
                          />
                        </div>

                        {/* Action Bar: Folder Upload, ZIP/Multi-MP3 Upload, Manual Add & Bulk Delete */}
                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            disabled={Boolean(batchUploadProgress)}
                            onClick={() => folderInputRef.current?.click()}
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#4A2E1B] px-3 py-1.5 text-[11px] font-semibold text-[#FAF5EC] shadow-xs transition hover:bg-[#3A2213] disabled:opacity-50"
                          >
                            <FolderUp className="h-3.5 w-3.5" />
                            <span>Upload Folder Lagu</span>
                          </button>

                          <button
                            type="button"
                            disabled={Boolean(batchUploadProgress)}
                            onClick={() => zipOrMultiInputRef.current?.click()}
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#4A2E1B]/25 bg-[#F2E7D7] px-3 py-1.5 text-[11px] font-semibold text-[#4A2E1B] transition hover:bg-[#E7D6BE] disabled:opacity-50"
                          >
                            <FileArchive className="h-3.5 w-3.5" />
                            <span>Upload ZIP / Multi-MP3</span>
                          </button>

                          <button
                            type="button"
                            disabled={Boolean(batchUploadProgress)}
                            onClick={handleAddTrackRow}
                            className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-[#4A2E1B]/20 bg-white px-3 py-1.5 text-[11px] font-semibold text-[#4A2E1B] hover:bg-[#FAF5EC] disabled:opacity-50"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>Tambah Manual</span>
                          </button>

                          {editing.tracks.length > 0 && (
                            <button
                              type="button"
                              onClick={toggleSelectAllTracks}
                              className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-[#4A2E1B]/20 bg-[#FAF5EC] px-2.5 py-1.5 text-[11px] font-semibold text-[#4A2E1B] hover:bg-[#EFE4D3]"
                            >
                              {allTracksSelected ? (
                                <CheckSquare className="h-3 w-3" />
                              ) : (
                                <Square className="h-3 w-3" />
                              )}
                              <span>{allTracksSelected ? 'Batal' : 'Pilih Semua'}</span>
                            </button>
                          )}

                          {selectedTrackIds.size > 0 && (
                            <button
                              type="button"
                              onClick={requestRemoveSelectedTracks}
                              className="inline-flex cursor-pointer items-center gap-1 rounded-xl bg-[#6E1D2C] px-2.5 py-1.5 text-[11px] font-semibold text-[#FAF5EC] hover:bg-[#571622]"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Hapus ({selectedTrackIds.size})</span>
                            </button>
                          )}
                        </div>

                        {/* Live Batch Upload Progress Indicator */}
                        {batchUploadProgress && (
                          <div className="mt-3 rounded-xl border border-[#C89B54]/45 bg-[#FFF8EB] p-3 text-xs text-[#3A2213]">
                            <div className="flex items-center justify-between gap-2 font-semibold">
                              <span className="inline-flex min-w-0 items-center gap-2">
                                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#7A5230]" />
                                <span className="truncate">
                                  Mengunggah: {batchUploadProgress.currentName}
                                </span>
                              </span>
                              <span className="shrink-0 font-mono text-[10.5px] text-[#7A5230]">
                                {batchUploadProgress.done}/{batchUploadProgress.total}
                              </span>
                            </div>
                            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#4A2E1B]/12">
                              <div
                                className="h-full rounded-full bg-[#4A2E1B] transition-[width] duration-200"
                                style={{
                                  width: `${Math.max(
                                    6,
                                    Math.round(
                                      (batchUploadProgress.done /
                                        Math.max(1, batchUploadProgress.total)) *
                                        100
                                    )
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}

                        <div className="mt-3 space-y-2.5">
                          {editing.tracks.length === 0 ? (
                            <p className="rounded-xl border border-dashed border-[#4A2E1B]/20 bg-[#FAF5EC] py-4 text-center text-xs text-[#8A7360]">
                              Belum ada lagu di daftar. Upload folder/ZIP kumpulan lagu atau klik &ldquo;Tambah Manual&rdquo;.
                            </p>
                          ) : (
                            editing.tracks.map((trk, idx) => {
                              const trkSelected = selectedTrackIds.has(trk.id);
                              return (
                                <div
                                  key={trk.id}
                                  className={`space-y-2.5 rounded-xl border p-3 transition ${
                                    trkSelected
                                      ? 'border-[#4A2E1B] bg-[#F3E8D7]/80'
                                      : 'border-[#4A2E1B]/12 bg-[#FAF5EC]/85'
                                  }`}
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={trkSelected}
                                      onChange={() => toggleTrackSelect(trk.id)}
                                      aria-label={`Pilih track nomor ${idx + 1}`}
                                      className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-[#4A2E1B]"
                                    />
                                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#4A2E1B]/12 font-mono text-[10px] font-bold text-[#4A2E1B]">
                                      {idx + 1}
                                    </span>
                                    <input
                                      type="text"
                                      value={trk.title}
                                      onChange={(e) =>
                                        updateTrackRow(trk.id, { title: e.target.value })
                                      }
                                      placeholder={`Judul lagu #${idx + 1}`}
                                      className="min-w-[140px] flex-1 rounded-lg border border-[#4A2E1B]/15 bg-white px-2.5 py-1.5 text-xs text-[#241A13] outline-none focus:border-[#4A2E1B]"
                                    />
                                    <input
                                      type="text"
                                      value={trk.duration}
                                      onChange={(e) =>
                                        updateTrackRow(trk.id, { duration: e.target.value })
                                      }
                                      placeholder="03:30"
                                      className="w-16 rounded-lg border border-[#4A2E1B]/15 bg-white px-2 py-1.5 font-mono text-xs text-[#241A13] outline-none focus:border-[#4A2E1B]"
                                    />

                                    <input
                                      ref={(el) => {
                                        trackAudioRefs.current[trk.id] = el;
                                      }}
                                      type="file"
                                      accept="audio/mpeg,audio/mp3,audio/mp4,audio/wav,audio/ogg,audio/flac"
                                      className="hidden"
                                      onChange={(e) => handleTrackAudioSelect(trk.id, e)}
                                    />
                                    <button
                                      type="button"
                                      disabled={uploadingTrackId === trk.id}
                                      onClick={() => trackAudioRefs.current[trk.id]?.click()}
                                      className={`inline-flex cursor-pointer items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold disabled:opacity-50 ${
                                        trk.audioUrl
                                          ? 'border-emerald-700/25 bg-emerald-500/10 text-emerald-900 hover:bg-emerald-500/20'
                                          : 'border-[#4A2E1B]/20 bg-white text-[#4A2E1B] hover:bg-[#EFE5D5]'
                                      }`}
                                    >
                                      <Upload className="h-3 w-3" />
                                      <span>
                                        {uploadingTrackId === trk.id
                                          ? 'Upload...'
                                          : trk.audioUrl
                                          ? 'Ganti MP3'
                                          : 'MP3'}
                                      </span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => removeTrackRow(trk.id)}
                                      className="cursor-pointer rounded-lg p-1.5 text-[#8A7360] hover:bg-[#6E1D2C]/10 hover:text-[#6E1D2C]"
                                      title="Hapus lagu ini"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>

                                  <div className="flex flex-wrap items-center justify-between gap-2 pl-8 text-[10.5px]">
                                    <ThemedDropdown
                                      value={trk.clipMode || 'full'}
                                      options={CLIP_MODE_OPTIONS}
                                      onChange={(val) =>
                                        updateTrackRow(trk.id, {
                                          clipMode: val as ClipMode,
                                        })
                                      }
                                      ariaLabel={`Mode putar track ${idx + 1}`}
                                      size="xs"
                                      className="w-40"
                                    />

                                    {trk.title.trim() && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setEditing({
                                            ...editing,
                                            favoriteSong: trk.title.trim(),
                                          })
                                        }
                                        className={`cursor-pointer font-mono text-[10px] font-semibold ${
                                          editing.favoriteSong.trim().toLowerCase() ===
                                          trk.title.trim().toLowerCase()
                                            ? 'text-[#7A5230] underline'
                                            : 'text-[#8A7360] hover:text-[#4A2E1B]'
                                        }`}
                                      >
                                        {editing.favoriteSong.trim().toLowerCase() ===
                                        trk.title.trim().toLowerCase()
                                          ? '★ Lagu Favorit'
                                          : 'Jadikan Favorit'}
                                      </button>
                                    )}
                                  </div>

                                  {trk.clipMode === 'snippet' && (
                                    <div className="pl-8">
                                      <SnippetTrimmer
                                        compact
                                        audioUrl={trk.audioUrl || undefined}
                                        durationLabel={trk.duration}
                                        startSec={trk.clipStartSec ?? 0}
                                        endSec={trk.clipEndSec ?? 30}
                                        onChange={(nextStart, nextEnd) =>
                                          updateTrackRow(trk.id, {
                                            clipStartSec: nextStart,
                                            clipEndSec: nextEnd,
                                          })
                                        }
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Curator Notes */}
                  <label className="block">
                    <span className="font-mono text-[10px] font-semibold tracking-wider text-[#5C4432] uppercase">
                      Curator Liner Notes (Opsional — Kosongkan Jika Tidak Ada)
                    </span>
                    <textarea
                      rows={3}
                      value={editing.linerNotes}
                      onChange={(e) =>
                        setEditing({ ...editing, linerNotes: e.target.value })
                      }
                      placeholder="Cerita personal, suasana lagu/album, atau catatan kurator..."
                      className="orihour-scroll mt-1 w-full resize-none rounded-xl border border-[#4A2E1B]/18 bg-white px-3 py-2 text-sm text-[#241A13] outline-none focus:border-[#4A2E1B]"
                    />
                  </label>
                </div>
              </div>

              {/* Error Banner Inside Modal */}
              {errorMsg && (
                <div className="mx-6 mb-3 flex shrink-0 items-center justify-between gap-2 rounded-xl border border-[#6E1D2C]/25 bg-[#6E1D2C]/10 px-4 py-2.5 text-xs font-semibold text-[#571622]">
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

              {/* Modal Footer */}
              <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-[#4A2E1B]/12 bg-[#F4ECE0] px-6 py-4">
                <button
                  type="button"
                  disabled={Boolean(batchUploadProgress)}
                  onClick={() => setEditing(null)}
                  className="cursor-pointer rounded-xl border border-[#4A2E1B]/20 bg-white px-4 py-2 text-xs font-semibold text-[#4A2E1B] hover:bg-[#EFE5D5] disabled:opacity-45"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving || isUploadingAny}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#4A2E1B] px-5 py-2 text-xs font-semibold text-[#FAF5EC] shadow-md transition hover:bg-[#3A2213] disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{saving ? 'Menyimpan...' : 'Simpan Koleksi'}</span>
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

      {/* Interactive 1:1 Cover Crop, Rotate & Auto-Enhance Modal */}
      {editing && (
        <ImageCropEnhanceModal
          file={cropFile}
          title="Crop, Rotate & Enhance Cover Vinyl (1:1)"
          targetWidth={1024}
          targetHeight={1024}
          vinylPreview={{
            title: editing.title,
            artist: editing.artist,
            releaseYear: editing.releaseYear,
            labelColor: editing.labelColor,
            showCoverOverlay: editing.showCoverOverlay,
          }}
          onCancel={() => setCropFile(null)}
          onConfirm={handleConfirmCrop}
        />
      )}

      {/* Orihour-Themed Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(confirmState)}
        title={confirmState?.title || ''}
        description={confirmState?.description || ''}
        confirmLabel={confirmState?.confirmLabel || 'Hapus'}
        busy={bulkDeletingVinyls || genreBusy}
        onCancel={() => setConfirmState(null)}
        onConfirm={() => {
          if (confirmState) void confirmState.onConfirm();
        }}
      />
    </div>
  );
}