'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import * as THREE from 'three';
import { Disc3 } from 'lucide-react';
import {
  DEFAULT_ROOM_CONFIG,
  INITIAL_POSTCARDS,
  INITIAL_VINYLS,
} from '@/data/mockVinyls';
import {
  extractUniqueGenres,
  hasMultipleTracks,
  isSingleSongRelease,
  sortPostcardsForBoard,
} from '@/lib/genreUtils';
import { computeAtmosphere } from '@/lib/timeAtmosphere';
import { audioEngine } from '@/lib/audioEngine';
import {
  CameraFocusTarget,
  GenreItem,
  GuestbookPostcard,
  MAX_PINBOARD_VISIBLE,
  RoomConfig,
  TrackItem,
  VinylRecord,
  WeatherType,
} from '@/types/orihour';
import EntryGate from '@/components/hud/EntryGate';
import MinimalHud from '@/components/hud/MinimalHud';
import LinerNotesModal from '@/components/hud/LinerNotesModal';
import PlaylistModal from '@/components/hud/PlaylistModal';
import PlaylistTrackModal from '@/components/hud/PlaylistTrackModal';
import PinboardModal, { PostcardSubmissionPayload } from '@/components/hud/PinboardModal';
import LofiCatalogView from '@/components/lofi/LofiCatalogView';

const OrihourCanvas = dynamic(() => import('@/components/room-3d/OrihourCanvas'), {
  ssr: false,
});

function getCurrentLocalHourDecimal(): number {
  const now = new Date();
  return now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
}

function resolveDefaultTrack(vinyl: VinylRecord): TrackItem | null {
  if (isSingleSongRelease(vinyl)) return null;
  const tracks = vinyl.tracks || [];
  if (tracks.length === 0) return null;

  if (vinyl.favoriteSong?.trim()) {
    const match = tracks.find(
      (t) => t.title.trim().toLowerCase() === vinyl.favoriteSong!.trim().toLowerCase()
    );
    if (match) return match;
  }
  return tracks[0];
}

function getSourceKey(vinyl: VinylRecord, track: TrackItem | null): string {
  return track ? `${vinyl.id}:${track.id}` : vinyl.id;
}

export default function OrihourHomePage() {
  const [webglSupported, setWebglSupported] = useState(true);
  const [dataReady, setDataReady] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [loadProgress, setLoadProgress] = useState(10);
  const [curtainFading, setCurtainFading] = useState(false);
  const [curtainMounted, setCurtainMounted] = useState(true);
  const [hasEntered, setHasEntered] = useState(false);

  // Smooth Lo-Fi overlay states (keeps 3D canvas mounted behind for zero black flash & smooth camera)
  const [lofiMode, setLofiMode] = useState(false);
  const [lofiMounted, setLofiMounted] = useState(false);
  const [lofiVisible, setLofiVisible] = useState(false);
  const [lofiSource, setLofiSource] = useState<'ENTRY' | 'ROOM'>('ENTRY');
  const lofiCloseTimerRef = useRef<number | null>(null);

  const [soundEnabled, setSoundEnabled] = useState(true);

  const [roomConfig, setRoomConfig] = useState<RoomConfig>(DEFAULT_ROOM_CONFIG);
  const [vinyls, setVinyls] = useState<VinylRecord[]>(INITIAL_VINYLS);
  const [genres, setGenres] = useState<GenreItem[]>(() =>
    extractUniqueGenres(INITIAL_VINYLS).map((name, i) => ({
      id: `init-${i}`,
      name,
    }))
  );
  const [activeVinyl, setActiveVinyl] = useState<VinylRecord | null>(INITIAL_VINYLS[0]);
  const [activeTrack, setActiveTrack] = useState<TrackItem | null>(() =>
    resolveDefaultTrack(INITIAL_VINYLS[0])
  );
  const [previousVinyl, setPreviousVinyl] = useState<VinylRecord | null>(null);
  const [postcards, setPostcards] = useState<GuestbookPostcard[]>(
    sortPostcardsForBoard(INITIAL_POSTCARDS).slice(0, MAX_PINBOARD_VISIBLE)
  );

  // Turntable playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [rackReadyToShift, setRackReadyToShift] = useState(false);
  const [transferOrigin, setTransferOrigin] = useState(() => new THREE.Vector3(-1.04, 1.82, -0.14));
  const [progressRatio, setProgressRatio] = useState(0);

  // Separate Collection Preview Card playback state
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [selectedCollectionItem, setSelectedCollectionItem] = useState<VinylRecord | null>(null);
  const [cardSubTrack, setCardSubTrack] = useState<TrackItem | null>(null);
  const [cardPlayingKey, setCardPlayingKey] = useState<string | null>(null);
  const [isCardPlaying, setIsCardPlaying] = useState(false);
  const [cardProgressRatio, setCardProgressRatio] = useState(0);

  // Desk Wallet state
  const [walletOpen, setWalletOpen] = useState(false);

  const [cameraFocus, setCameraFocus] = useState<CameraFocusTarget>('ENTRY');
  const [weather, setWeather] = useState<WeatherType>('CLEAR');
  const [weatherBadgeText, setWeatherBadgeText] = useState<string | null>(null);
  const hasManualWeather = useRef(false);
  const weatherRef = useRef<WeatherType>('CLEAR');
  const lofiModeRef = useRef(false);
  const startPlaybackRef = useRef<
    ((vinyl: VinylRecord, trackOverride?: TrackItem | null) => void) | null
  >(null);

  weatherRef.current = weather;
  lofiModeRef.current = lofiMode;

  const [isLiveTime, setIsLiveTime] = useState(true);
  const [hourDecimal, setHourDecimal] = useState<number>(12.0);
  const [lampOverride, setLampOverride] = useState<boolean | null>(null);

  const [showTimeScrubber, setShowTimeScrubber] = useState(false);
  const [linerModalOpen, setLinerModalOpen] = useState(false);
  const [pinboardOpen, setPinboardOpen] = useState(false);
  const [hoverLabel, setHoverLabel] = useState<string | null>(null);

  const applyWeatherResponse = useCallback(
    (data: {
      weather?: WeatherType;
      source?: string;
      locationName?: string;
      description?: string;
      tempC?: number | null;
    } | null) => {
      if (!data || hasManualWeather.current) return;
      const nextWeather = data.weather;
      if (
        nextWeather === 'CLEAR' ||
        nextWeather === 'CLOUDY' ||
        nextWeather === 'RAIN' ||
        nextWeather === 'BREEZY'
      ) {
        setWeather(nextWeather);
        const parts: string[] = [];
        if (data.source) parts.push(data.source);
        if (data.locationName) parts.push(data.locationName);
        if (data.description) parts.push(data.description);
        if (typeof data.tempC === 'number') parts.push(`${Math.round(data.tempC)}°C`);
        setWeatherBadgeText(parts.length > 0 ? parts.join(' · ') : null);
      }
    },
    []
  );

  const openLofi = useCallback((source: 'ENTRY' | 'ROOM') => {
    if (lofiCloseTimerRef.current !== null) {
      window.clearTimeout(lofiCloseTimerRef.current);
      lofiCloseTimerRef.current = null;
    }
    setLofiSource(source);
    setLofiMode(true);
    setLofiMounted(true);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setLofiVisible(true);
      });
    });
  }, []);

  const closeLofi = useCallback(() => {
    setLofiVisible(false);
    setLofiMode(false);
    if (lofiSource === 'ENTRY') {
      setHasEntered(false);
      setCameraFocus('ENTRY');
    } else {
      setHasEntered(true);
      setCameraFocus('DESK');
    }
    if (lofiCloseTimerRef.current !== null) {
      window.clearTimeout(lofiCloseTimerRef.current);
    }
    lofiCloseTimerRef.current = window.setTimeout(() => {
      setLofiMounted(false);
      lofiCloseTimerRef.current = null;
    }, 320);
  }, [lofiSource]);

  const handleSceneReady = useCallback(() => {
    setSceneReady(true);
  }, []);

  useEffect(() => {
    return () => {
      if (lofiCloseTimerRef.current !== null) {
        window.clearTimeout(lofiCloseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (sceneReady) {
      setLoadProgress(100);
      const fadeTimer = window.setTimeout(() => setCurtainFading(true), 240);
      const unmountTimer = window.setTimeout(() => setCurtainMounted(false), 620);
      return () => {
        window.clearTimeout(fadeTimer);
        window.clearTimeout(unmountTimer);
      };
    }

    const target = dataReady ? 90 : 48;
    const interval = window.setInterval(() => {
      setLoadProgress((prev) => {
        if (prev >= target) return prev;
        const step = Math.max(1.2, (target - prev) * 0.14);
        return Math.min(target, prev + step);
      });
    }, 55);

    return () => window.clearInterval(interval);
  }, [dataReady, sceneReady]);

  const stopCardPlayback = useCallback(() => {
    setCardPlayingKey((current) => {
      if (current !== null) {
        audioEngine.stopRecord();
      }
      return null;
    });
    setIsCardPlaying(false);
    setCardProgressRatio(0);
    setCardSubTrack(null);
  }, []);

  useEffect(() => {
    setHourDecimal(getCurrentLocalHourDecimal());

    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2');
      if (!gl) {
        setWebglSupported(false);
        setLofiSource('ENTRY');
        setLofiMode(true);
        setLofiMounted(true);
        setLofiVisible(true);
        setDataReady(true);
        setSceneReady(true);
      }
    } catch {
      setWebglSupported(false);
      setLofiSource('ENTRY');
      setLofiMode(true);
      setLofiMounted(true);
      setLofiVisible(true);
      setDataReady(true);
      setSceneReady(true);
    }

    const dataSafetyTimer = window.setTimeout(() => {
      setDataReady(true);
    }, 1200);

    const sceneSafetyTimer = window.setTimeout(() => {
      setSceneReady(true);
    }, 3400);

    let active = true;

    fetch('/api/room-data', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        if (data) {
          const nextConfig: RoomConfig = data.config || DEFAULT_ROOM_CONFIG;
          const nextVinyls: VinylRecord[] = Array.isArray(data.vinyls)
            ? data.vinyls
            : INITIAL_VINYLS;
          const nextPostcards: GuestbookPostcard[] = Array.isArray(data.postcards)
            ? sortPostcardsForBoard(data.postcards).slice(0, MAX_PINBOARD_VISIBLE)
            : sortPostcardsForBoard(INITIAL_POSTCARDS).slice(0, MAX_PINBOARD_VISIBLE);
          const nextGenres: GenreItem[] = Array.isArray(data.genres)
            ? data.genres
            : extractUniqueGenres(nextVinyls).map((name, i) => ({
                id: `gnr-${i}`,
                name,
              }));

          setRoomConfig(nextConfig);
          setVinyls(nextVinyls);
          setPostcards(nextPostcards);
          setGenres(nextGenres);

          if (nextConfig.activeTurntableVinylId) {
            const found =
              nextVinyls.find((v) => v.id === nextConfig.activeTurntableVinylId) ?? null;
            setActiveVinyl(found);
            setActiveTrack(found ? resolveDefaultTrack(found) : null);
          } else {
            setActiveVinyl(null);
            setActiveTrack(null);
          }
        }
        setDataReady(true);
      })
      .catch(() => {
        if (active) setDataReady(true);
      });

    // 1) Fast initial IP-based weather (BMKG for ID / Open-Meteo global)
    fetch('/api/weather', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active) applyWeatherResponse(data);
      })
      .catch(() => {});

    // 2) Refine with exact browser geolocation if permitted (solves ISP IP routing mismatch like Kasongan vs Palangka Raya/Jakarta)
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!active || hasManualWeather.current) return;
          const { latitude, longitude } = pos.coords;
          fetch(
            `/api/weather?lat=${encodeURIComponent(latitude.toFixed(5))}&lon=${encodeURIComponent(
              longitude.toFixed(5)
            )}`,
            { cache: 'no-store' }
          )
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
              if (active) applyWeatherResponse(data);
            })
            .catch(() => {});
        },
        () => {
          // Silently keep IP-based weather when user denies or GPS unavailable
        },
        {
          enableHighAccuracy: false,
          timeout: 6500,
          maximumAge: 10 * 60 * 1000,
        }
      );
    }

    return () => {
      active = false;
      window.clearTimeout(dataSafetyTimer);
      window.clearTimeout(sceneSafetyTimer);
    };
  }, [applyWeatherResponse]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const TRACK_FLAG = 'orihour_visit_tracked_v1';
    if (window.sessionStorage.getItem(TRACK_FLAG)) return;
    window.sessionStorage.setItem(TRACK_FLAG, '1');

    const timer = window.setTimeout(() => {
      const sessionId =
        window.sessionStorage.getItem('orihour_sid') ||
        (typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `sid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
      window.sessionStorage.setItem('orihour_sid', sessionId);

      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      const screenSize = `${window.innerWidth}x${window.innerHeight}`;

      fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          sessionId,
          path: window.location.pathname || '/',
          referrer: document.referrer || '',
          timezone,
          screenSize,
          viewMode: lofiModeRef.current ? 'LO-FI' : '3D',
          weather: weatherRef.current,
        }),
      }).catch(() => {});
    }, 1800);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isLiveTime) return;
    const timer = setInterval(() => {
      setHourDecimal(getCurrentLocalHourDecimal());
    }, 5000);
    return () => clearInterval(timer);
  }, [isLiveTime]);

  const atmosphere = useMemo(
    () => computeAtmosphere(hourDecimal, weather),
    [hourDecimal, weather]
  );

  const lampOn = lampOverride !== null ? lampOverride : atmosphere.autoLampOn;

  useEffect(() => {
    if (hasEntered) {
      audioEngine.syncWeatherAmbience(weather);
    }
  }, [weather, hasEntered]);

  const handleChangeFocus = useCallback((nextFocus: CameraFocusTarget) => {
    setCameraFocus(nextFocus);
    setWalletOpen(nextFocus === 'WALLET');
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && hasEntered && !lofiMode) {
        stopCardPlayback();
        setLinerModalOpen(false);
        setCollectionOpen(false);
        setSelectedCollectionItem(null);
        setPinboardOpen(false);
        setShowTimeScrubber(false);
        setWalletOpen(false);
        setCameraFocus('DESK');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hasEntered, lofiMode, stopCardPlayback]);

  const handleManualWeatherChange = useCallback((next: WeatherType) => {
    hasManualWeather.current = true;
    setWeather(next);
    setWeatherBadgeText(`Manual · ${next}`);
  }, []);

  const handleCycleWeather = useCallback(() => {
    hasManualWeather.current = true;
    const order: WeatherType[] = ['CLEAR', 'CLOUDY', 'RAIN', 'BREEZY'];
    setWeather((prev) => {
      const next = order[(order.indexOf(prev) + 1) % order.length];
      setWeatherBadgeText(`Manual · ${next}`);
      return next;
    });
  }, []);

  const startTurntablePlayback = useCallback(
    (vinyl: VinylRecord, trackOverride?: TrackItem | null) => {
      setCardPlayingKey(null);
      setIsCardPlaying(false);
      setCardProgressRatio(0);

      const resolvedTrack =
        trackOverride !== undefined ? trackOverride : resolveDefaultTrack(vinyl);
      setActiveTrack(resolvedTrack);

      audioEngine.triggerNeedleDrop();
      setIsPlaying(true);
      setProgressRatio(0);
      audioEngine.playRecord(
        vinyl,
        (ratio) => setProgressRatio(ratio),
        () => {
          if (hasMultipleTracks(vinyl) && resolvedTrack) {
            const tracks = vinyl.tracks || [];
            const currentIdx = tracks.findIndex((t) => t.id === resolvedTrack.id);
            if (currentIdx >= 0 && currentIdx + 1 < tracks.length) {
              const nextTrack = tracks[currentIdx + 1];
              setProgressRatio(0);
              window.setTimeout(() => {
                startPlaybackRef.current?.(vinyl, nextTrack);
              }, 180);
              return;
            }
          }
          setIsPlaying(false);
          setProgressRatio(0);
        },
        resolvedTrack
      );
    },
    []
  );

  startPlaybackRef.current = startTurntablePlayback;

  const handleSelectVinyl = useCallback(
    (vinyl: VinylRecord, origin?: THREE.Vector3, subTrack?: TrackItem | null) => {
      if (isTransferring) return;

      setCardPlayingKey(null);
      setIsCardPlaying(false);
      setCardProgressRatio(0);
      setWalletOpen(false);

      const nextTrack =
        subTrack !== undefined ? subTrack : resolveDefaultTrack(vinyl);

      if (activeVinyl && vinyl.id === activeVinyl.id) {
        const sameTrack = (activeTrack?.id ?? null) === (nextTrack?.id ?? null);
        if (sameTrack) {
          if (isPlaying) {
            audioEngine.pauseRecord();
            setIsPlaying(false);
          } else {
            const key = getSourceKey(vinyl, nextTrack);
            if (audioEngine.hasPausedSource(key) && audioEngine.resumeRecord()) {
              setIsPlaying(true);
            } else {
              startTurntablePlayback(vinyl, nextTrack);
            }
          }
          return;
        }

        startTurntablePlayback(vinyl, nextTrack);
        return;
      }

      audioEngine.stopRecord();
      setIsPlaying(false);
      setProgressRatio(0);
      setPreviousVinyl(activeVinyl);
      setActiveVinyl(vinyl);
      setActiveTrack(nextTrack);

      if (lofiMode) {
        startTurntablePlayback(vinyl, nextTrack);
        return;
      }

      if (origin) {
        setTransferOrigin(origin.clone());
      } else {
        setTransferOrigin(new THREE.Vector3(-0.38, 2.48, -0.22));
      }
      setRackReadyToShift(false);
      setCameraFocus('TURNTABLE');
      setIsTransferring(true);
    },
    [activeVinyl, activeTrack, isPlaying, isTransferring, lofiMode, startTurntablePlayback]
  );

  const handleRackCleared = useCallback(() => {
    setRackReadyToShift(true);
  }, []);

  const handleTransferComplete = useCallback(() => {
    setIsTransferring(false);
    setRackReadyToShift(false);
    setPreviousVinyl(null);
    if (activeVinyl) {
      startTurntablePlayback(activeVinyl, activeTrack);
    }
  }, [activeVinyl, activeTrack, startTurntablePlayback]);

  const handleTogglePlay = useCallback(() => {
    if (isTransferring || !activeVinyl) return;
    if (isPlaying) {
      audioEngine.pauseRecord();
      setIsPlaying(false);
      return;
    }

    const key = getSourceKey(activeVinyl, activeTrack);
    if (audioEngine.hasPausedSource(key) && audioEngine.resumeRecord()) {
      setIsPlaying(true);
    } else {
      startTurntablePlayback(activeVinyl, activeTrack);
    }
  }, [activeVinyl, activeTrack, isPlaying, isTransferring, startTurntablePlayback]);

  const handleSelectActiveAlbumTrack = useCallback(
    (track: TrackItem) => {
      if (!activeVinyl) return;
      if (activeTrack?.id === track.id) {
        handleTogglePlay();
        return;
      }
      startTurntablePlayback(activeVinyl, track);
    },
    [activeVinyl, activeTrack, handleTogglePlay, startTurntablePlayback]
  );

  const handleStepActiveTrack = useCallback(
    (delta: -1 | 1) => {
      if (isTransferring || !activeVinyl || !hasMultipleTracks(activeVinyl)) return;
      const tracks = activeVinyl.tracks || [];
      if (tracks.length < 2) return;

      audioEngine.unlockAndInit(soundEnabled);
      const currentIdx = activeTrack
        ? tracks.findIndex((t) => t.id === activeTrack.id)
        : 0;
      const safeIdx = currentIdx >= 0 ? currentIdx : 0;
      const nextIdx = (safeIdx + delta + tracks.length) % tracks.length;
      startTurntablePlayback(activeVinyl, tracks[nextIdx]);
    },
    [activeVinyl, activeTrack, isTransferring, soundEnabled, startTurntablePlayback]
  );

  const handleSeekTurntable = useCallback(
    (ratio: number) => {
      if (!activeVinyl) return;
      const clamped = Math.max(0, Math.min(1, ratio));
      setProgressRatio(clamped);

      const key = getSourceKey(activeVinyl, activeTrack);
      if (isPlaying || audioEngine.hasPausedSource(key)) {
        audioEngine.seekToRatio(clamped);
      } else {
        startTurntablePlayback(activeVinyl, activeTrack);
        window.setTimeout(() => audioEngine.seekToRatio(clamped), 80);
      }
    },
    [activeVinyl, activeTrack, isPlaying, startTurntablePlayback]
  );

  const handleToggleCollectionCardPlay = useCallback(
    (vinyl: VinylRecord, subTrack?: TrackItem | null) => {
      const targetSub =
        subTrack !== undefined ? subTrack : cardSubTrack ?? resolveDefaultTrack(vinyl);
      const targetKey = getSourceKey(vinyl, targetSub);

      if (cardPlayingKey === targetKey && isCardPlaying) {
        audioEngine.pauseRecord();
        setIsCardPlaying(false);
        return;
      }

      if (cardPlayingKey === targetKey && !isCardPlaying && audioEngine.hasPausedSource(targetKey)) {
        if (audioEngine.resumeRecord()) {
          setIsCardPlaying(true);
          return;
        }
      }

      if (isPlaying) {
        audioEngine.stopRecord();
        setIsPlaying(false);
        setProgressRatio(0);
      }

      audioEngine.unlockAndInit(soundEnabled);
      setCardSubTrack(targetSub);
      setCardPlayingKey(targetKey);
      setIsCardPlaying(true);
      setCardProgressRatio(0);
      audioEngine.playRecord(
        vinyl,
        (ratio) => setCardProgressRatio(ratio),
        () => {
          setIsCardPlaying(false);
          setCardPlayingKey(null);
          setCardProgressRatio(0);
        },
        targetSub
      );
    },
    [cardSubTrack, cardPlayingKey, isCardPlaying, isPlaying, soundEnabled]
  );

  const handleSeekCardProgress = useCallback(
    (ratio: number) => {
      if (!selectedCollectionItem) return;
      const clamped = Math.max(0, Math.min(1, ratio));
      setCardProgressRatio(clamped);

      if (cardPlayingKey && (isCardPlaying || audioEngine.hasPausedSource(cardPlayingKey))) {
        audioEngine.seekToRatio(clamped);
      } else {
        handleToggleCollectionCardPlay(selectedCollectionItem, cardSubTrack);
        window.setTimeout(() => audioEngine.seekToRatio(clamped), 80);
      }
    },
    [
      selectedCollectionItem,
      cardPlayingKey,
      isCardPlaying,
      cardSubTrack,
      handleToggleCollectionCardPlay,
    ]
  );

  const handleAddPostcard = useCallback(async (entry: PostcardSubmissionPayload) => {
    const res = await fetch('/api/postcards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to save your postcard. Please try again.');
    }

    const nextCard = data.postcard as GuestbookPostcard;
    setPostcards((prev) =>
      sortPostcardsForBoard([nextCard, ...prev]).slice(0, MAX_PINBOARD_VISIBLE)
    );
  }, []);

  const handleEnterRoom = (withSound: boolean) => {
    setSoundEnabled(withSound);
    audioEngine.unlockAndInit(withSound);
    audioEngine.syncWeatherAmbience(weather);
    setHasEntered(true);
    setCameraFocus('DESK');
  };

  return (
    <main className="relative h-[100dvh] w-screen overflow-hidden bg-[#120E0B] select-none">
      {/* Persistent 3D Canvas — stays mounted during Lo-Fi mode so return transition is instant & smooth */}
      <div className="fixed inset-0 z-0 h-[100dvh] w-screen">
        {dataReady && webglSupported && (
          <OrihourCanvas
            config={roomConfig}
            vinyls={vinyls}
            activeVinyl={activeVinyl}
            previousVinyl={previousVinyl}
            postcards={postcards}
            isPlaying={isPlaying}
            isTransferring={isTransferring}
            rackReadyToShift={rackReadyToShift}
            walletOpen={walletOpen}
            transferOrigin={transferOrigin}
            cameraFocus={cameraFocus}
            isEntryMode={!hasEntered}
            hourDecimal={hourDecimal}
            isLiveTime={isLiveTime}
            weather={weather}
            lampOn={lampOn}
            atmosphere={atmosphere}
            onSceneReady={handleSceneReady}
            onSelectVinyl={(vinyl, origin) => handleSelectVinyl(vinyl, origin)}
            onRackCleared={handleRackCleared}
            onTransferComplete={handleTransferComplete}
            onTogglePlay={handleTogglePlay}
            onToggleLamp={() => setLampOverride((prev) => !(prev ?? atmosphere.autoLampOn))}
            onCycleWeather={handleCycleWeather}
            onClickClock={() => {
              setWalletOpen(false);
              setCameraFocus('CLOCK');
              setShowTimeScrubber((prev) => !prev);
            }}
            onFocusNotepad={() => handleChangeFocus('NOTES')}
            onOpenLinerNotes={() => {
              if (activeVinyl) setLinerModalOpen(true);
            }}
            onClickPinboard={() => {
              setWalletOpen(false);
              setCameraFocus('PINBOARD');
              setPinboardOpen(true);
            }}
            onOpenWallet={() => handleChangeFocus('WALLET')}
            onHoverLabel={setHoverLabel}
          />
        )}
      </div>

      {/* Smooth 0% -> 100% Preload Curtain */}
      {curtainMounted && (
        <div
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#120E0B] transition-opacity duration-350 ${
            curtainFading ? 'pointer-events-none opacity-0' : 'opacity-100'
          }`}
        >
          <Disc3 className="h-7 w-7 text-[#D4AA63] opacity-90" />
          <p className="mt-3 font-mono text-[11px] tracking-[0.28em] text-[#E6C79C] uppercase">
            {roomConfig.siteName}
          </p>
          <div className="mt-3.5 h-[2px] w-36 overflow-hidden rounded-full bg-[#E6C79C]/20">
            <div
              className="h-full rounded-full bg-[#D4AA63] transition-[width] duration-200 ease-out"
              style={{ width: `${Math.round(loadProgress)}%` }}
            />
          </div>
          <p className="mt-2 font-mono text-[9.5px] tracking-[0.2em] text-[#C9B99F]/70">
            {Math.round(loadProgress)}%
          </p>
        </div>
      )}

      {!hasEntered ? (
        <EntryGate
          visible={curtainFading && !lofiVisible}
          isNightHud={atmosphere.isNightHud}
          hourDecimal={hourDecimal}
          phaseLabel={atmosphere.phaseLabel}
          weather={weather}
          vinylCount={vinyls.length}
          featuredTitle={activeVinyl?.title ?? null}
          featuredArtist={activeVinyl?.artist ?? null}
          onEnterRoom={handleEnterRoom}
          onEnterLofi={() => openLofi('ENTRY')}
        />
      ) : (
        <>
          <MinimalHud
            activeVinyl={activeVinyl}
            activeTrack={activeTrack}
            vinylCount={vinyls.length}
            postcardCount={postcards.length}
            isPlaying={isPlaying}
            progressRatio={progressRatio}
            cameraFocus={cameraFocus}
            weather={weather}
            weatherBadgeText={weatherBadgeText}
            lampOn={lampOn}
            soundEnabled={soundEnabled}
            hourDecimal={hourDecimal}
            isLiveTime={isLiveTime}
            phaseLabel={atmosphere.phaseLabel}
            showTimeScrubber={showTimeScrubber}
            hoverLabel={hoverLabel}
            onChangeFocus={handleChangeFocus}
            onChangeWeather={handleManualWeatherChange}
            onToggleLamp={() => setLampOverride((prev) => !(prev ?? atmosphere.autoLampOn))}
            onToggleSound={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              audioEngine.setSoundEnabled(next);
            }}
            onTogglePlay={handleTogglePlay}
            onPrevTrack={() => handleStepActiveTrack(-1)}
            onNextTrack={() => handleStepActiveTrack(1)}
            onSeekProgress={handleSeekTurntable}
            onToggleTimeScrubber={() => setShowTimeScrubber((prev) => !prev)}
            onScrubHour={(h) => {
              setIsLiveTime(false);
              setHourDecimal(h);
            }}
            onResetLiveTime={() => {
              setIsLiveTime(true);
              setHourDecimal(getCurrentLocalHourDecimal());
            }}
            onUpdateVolumes={(m, r, c) => {
              audioEngine.setVolumes(m, r, c);
              audioEngine.syncWeatherAmbience(weather);
            }}
            onOpenLinerNotes={() => {
              if (activeVinyl) setLinerModalOpen(true);
            }}
            onOpenCollection={() => {
              setSelectedCollectionItem(null);
              setCollectionOpen(true);
            }}
            onOpenPinboard={() => {
              setWalletOpen(false);
              setCameraFocus('PINBOARD');
              setPinboardOpen(true);
            }}
            onSwitchToLofi={() => openLofi('ROOM')}
          />

          <LinerNotesModal
            open={linerModalOpen}
            activeVinyl={activeVinyl}
            activeTrack={activeTrack}
            isPlaying={isPlaying}
            progressRatio={progressRatio}
            onTogglePlay={handleTogglePlay}
            onSelectTrack={handleSelectActiveAlbumTrack}
            onSeekProgress={handleSeekTurntable}
            onClose={() => setLinerModalOpen(false)}
          />

          <PlaylistModal
            open={collectionOpen && !selectedCollectionItem}
            vinyls={vinyls}
            genres={genres}
            onClose={() => setCollectionOpen(false)}
            onViewTrackDetails={(item) => {
              setSelectedCollectionItem(item);
              setCardSubTrack(resolveDefaultTrack(item));
            }}
          />

          <PlaylistTrackModal
            track={selectedCollectionItem}
            activeSubTrack={cardSubTrack}
            isCardPlaying={isCardPlaying}
            cardProgressRatio={cardProgressRatio}
            onToggleCardPlay={handleToggleCollectionCardPlay}
            onSeekCardProgress={handleSeekCardProgress}
            onBackToCollection={() => {
              stopCardPlayback();
              setSelectedCollectionItem(null);
            }}
            onCloseAll={() => {
              stopCardPlayback();
              setSelectedCollectionItem(null);
              setCollectionOpen(false);
            }}
          />

          <PinboardModal
            open={pinboardOpen}
            postcards={postcards}
            onAddPostcard={handleAddPostcard}
            onClose={() => setPinboardOpen(false)}
          />
        </>
      )}

      {/* Smooth Cross-Fade Lo-Fi Catalog Overlay — Outer shell overflow-hidden so ONLY middle list scrolls */}
      {lofiMounted && (
        <div
          className={`fixed inset-0 z-40 overflow-hidden select-text transition-opacity duration-300 ease-out ${
            lofiVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          <LofiCatalogView
            config={roomConfig}
            vinyls={vinyls}
            genres={genres}
            activeVinyl={activeVinyl}
            activeTrack={activeTrack}
            isPlaying={isPlaying}
            progressRatio={progressRatio}
            returnTarget={lofiSource}
            onSelectAndPlay={(v, subTrack) => {
              audioEngine.unlockAndInit(soundEnabled);
              handleSelectVinyl(v, undefined, subTrack);
            }}
            onPrevTrack={() => handleStepActiveTrack(-1)}
            onNextTrack={() => handleStepActiveTrack(1)}
            onSeekProgress={handleSeekTurntable}
            onReturnTo3D={closeLofi}
          />
        </div>
      )}
    </main>
  );
}