'use client';

import React, { useState } from 'react';
import {
  Disc3,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Sun,
  Cloud,
  CloudRain,
  Wind,
  LampDesk,
  Volume2,
  VolumeX,
  SlidersHorizontal,
  Clock,
  BookOpen,
  Library,
  Pin,
  LayoutGrid,
  Compass,
  RotateCcw,
  Wallet,
  Music2,
} from 'lucide-react';
import {
  CameraFocusTarget,
  TrackItem,
  VinylRecord,
  WeatherType,
} from '@/types/orihour';
import { hasMultipleTracks } from '@/lib/genreUtils';
import { getSleeveDataUrl } from '@/components/room-3d/textures';

interface MinimalHudProps {
  activeVinyl: VinylRecord | null;
  activeTrack: TrackItem | null;
  vinylCount: number;
  postcardCount: number;
  isPlaying: boolean;
  progressRatio: number;
  cameraFocus: CameraFocusTarget;
  weather: WeatherType;
  lampOn: boolean;
  soundEnabled: boolean;
  hourDecimal: number;
  isLiveTime: boolean;
  phaseLabel: string;
  showTimeScrubber: boolean;
  hoverLabel: string | null;
  onChangeFocus: (focus: CameraFocusTarget) => void;
  onChangeWeather: (weather: WeatherType) => void;
  onToggleLamp: () => void;
  onToggleSound: () => void;
  onTogglePlay: () => void;
  onPrevTrack?: () => void;
  onNextTrack?: () => void;
  onSeekProgress: (ratio: number) => void;
  onToggleTimeScrubber: () => void;
  onScrubHour: (hour: number) => void;
  onResetLiveTime: () => void;
  onUpdateVolumes: (music: number, rain: number, crackle: number) => void;
  onOpenLinerNotes: () => void;
  onOpenCollection: () => void;
  onOpenPinboard: () => void;
  onSwitchToLofi: () => void;
}

const FOCUS_TABS: { id: CameraFocusTarget; label: string }[] = [
  { id: 'DESK', label: 'Room' },
  { id: 'TURNTABLE', label: 'Turntable' },
  { id: 'CRATE', label: 'Rack' },
  { id: 'NOTES', label: 'Journal' },
  { id: 'PINBOARD', label: 'Pinboard' },
  { id: 'WALLET', label: 'Pass' },
];

const WEATHER_OPTIONS: {
  id: WeatherType;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'CLEAR', label: 'Clear', Icon: Sun },
  { id: 'CLOUDY', label: 'Cloudy', Icon: Cloud },
  { id: 'RAIN', label: 'Rain', Icon: CloudRain },
  { id: 'BREEZY', label: 'Breezy', Icon: Wind },
];

function formatClock(hourDecimal: number): string {
  const totalMins = Math.floor((((hourDecimal % 24) + 24) % 24) * 60);
  const hh = String(Math.floor(totalMins / 60)).padStart(2, '0');
  const mm = String(totalMins % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

export default function MinimalHud({
  activeVinyl,
  activeTrack,
  vinylCount,
  postcardCount,
  isPlaying,
  progressRatio,
  cameraFocus,
  weather,
  lampOn,
  soundEnabled,
  hourDecimal,
  isLiveTime,
  phaseLabel,
  showTimeScrubber,
  hoverLabel,
  onChangeFocus,
  onChangeWeather,
  onToggleLamp,
  onToggleSound,
  onTogglePlay,
  onPrevTrack,
  onNextTrack,
  onSeekProgress,
  onToggleTimeScrubber,
  onScrubHour,
  onResetLiveTime,
  onUpdateVolumes,
  onOpenLinerNotes,
  onOpenCollection,
  onOpenPinboard,
  onSwitchToLofi,
}: MinimalHudProps) {
  const [mixerOpen, setMixerOpen] = useState(false);
  const [weatherOpen, setWeatherOpen] = useState(false);

  const [musicVol, setMusicVol] = useState(0.78);
  const [rainVol, setRainVol] = useState(0.35);
  const [crackleVol, setCrackleVol] = useState(0.22);

  const showTrackNav = Boolean(activeVinyl && hasMultipleTracks(activeVinyl));

  const activeWeatherInfo =
    WEATHER_OPTIONS.find((w) => w.id === weather) || WEATHER_OPTIONS[0];
  const ActiveWeatherIcon = activeWeatherInfo.Icon;

  const coverSrc = activeVinyl
    ? activeVinyl.coverUrl ||
      (typeof window !== 'undefined' ? getSleeveDataUrl(activeVinyl) : '')
    : '';

  const handleVolumeChange = (nextM: number, nextR: number, nextC: number) => {
    setMusicVol(nextM);
    setRainVol(nextR);
    setCrackleVol(nextC);
    onUpdateVolumes(nextM, nextR, nextC);
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-4 sm:p-5">
      {/* Top Bar: Left Camera Focus Navigation & Right Environment Controls */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* Camera Focus Pills */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-1 rounded-2xl border border-[#E5D7C3]/85 bg-[#FAF5EC]/82 p-1.5 shadow-[0_10px_28px_rgba(18,12,8,0.22)] backdrop-blur-xl">
          <span className="hidden items-center gap-1 px-2 font-mono text-[9.5px] font-semibold tracking-[0.14em] text-[#7A5230] uppercase md:inline-flex">
            <Compass className="h-3 w-3" />
            View
          </span>
          {FOCUS_TABS.map((tab) => {
            const active = cameraFocus === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChangeFocus(tab.id)}
                className={`inline-flex cursor-pointer items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-semibold transition ${
                  active
                    ? 'bg-[#4A2E1B] text-[#FAF5EC] shadow-xs'
                    : 'text-[#4A2E1B]/85 hover:bg-[#4A2E1B]/10 hover:text-[#241A13]'
                }`}
              >
                {tab.id === 'WALLET' && <Wallet className="h-3 w-3" />}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Controls: Weather, Lamp, Audio/Mixer, Clock, Lo-Fi */}
        <div className="pointer-events-auto relative flex flex-wrap items-center gap-1.5">
          {/* Weather Selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setWeatherOpen((prev) => !prev);
                setMixerOpen(false);
              }}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-2xl border border-[#E5D7C3]/85 bg-[#FAF5EC]/84 px-3 py-2 text-xs font-semibold text-[#241A13] shadow-[0_10px_28px_rgba(18,12,8,0.2)] backdrop-blur-xl transition hover:bg-[#FAF5EC]"
              title="Change weather"
            >
              <ActiveWeatherIcon className="h-3.5 w-3.5 text-[#7A5230]" />
              <span className="hidden sm:inline">{activeWeatherInfo.label}</span>
            </button>

            {weatherOpen && (
              <div className="absolute top-12 right-0 z-30 w-40 space-y-1 rounded-2xl border border-[#E5D7C3] bg-[#FAF5EC]/95 p-1.5 shadow-xl backdrop-blur-xl">
                {WEATHER_OPTIONS.map((opt) => {
                  const Icon = opt.Icon;
                  const active = weather === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        onChangeWeather(opt.id);
                        setWeatherOpen(false);
                      }}
                      className={`flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                        active
                          ? 'bg-[#4A2E1B] text-[#FAF5EC]'
                          : 'text-[#3A2213] hover:bg-[#EFE4D3]'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Desk Lamp Toggle */}
          <button
            type="button"
            onClick={onToggleLamp}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-semibold shadow-[0_10px_28px_rgba(18,12,8,0.2)] backdrop-blur-xl transition ${
              lampOn
                ? 'border-[#C89B54]/70 bg-[#4A2E1B] text-[#FAF5EC]'
                : 'border-[#E5D7C3]/85 bg-[#FAF5EC]/84 text-[#241A13] hover:bg-[#FAF5EC]'
            }`}
            title={lampOn ? 'Turn off desk lamp' : 'Turn on desk lamp'}
          >
            <LampDesk className="h-3.5 w-3.5" />
            <span className="hidden md:inline">{lampOn ? 'Lamp On' : 'Lamp Off'}</span>
          </button>

          {/* Time Scrubber Toggle */}
          <button
            type="button"
            onClick={onToggleTimeScrubber}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-2xl border px-3 py-2 font-mono text-[11px] font-semibold shadow-[0_10px_28px_rgba(18,12,8,0.2)] backdrop-blur-xl transition ${
              showTimeScrubber
                ? 'border-[#4A2E1B] bg-[#4A2E1B] text-[#FAF5EC]'
                : 'border-[#E5D7C3]/85 bg-[#FAF5EC]/84 text-[#241A13] hover:bg-[#FAF5EC]'
            }`}
            title="Adjust room time of day"
          >
            <Clock className="h-3.5 w-3.5" />
            <span>{formatClock(hourDecimal)}</span>
          </button>

          {/* Sound Toggle & Ambient Mixer */}
          <div className="relative flex items-center gap-1 rounded-2xl border border-[#E5D7C3]/85 bg-[#FAF5EC]/84 p-1 shadow-[0_10px_28px_rgba(18,12,8,0.2)] backdrop-blur-xl">
            <button
              type="button"
              onClick={onToggleSound}
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-xl text-[#4A2E1B] transition hover:bg-[#4A2E1B]/10"
              title={soundEnabled ? 'Mute audio' : 'Unmute audio'}
              aria-label={soundEnabled ? 'Mute audio' : 'Unmute audio'}
            >
              {soundEnabled ? (
                <Volume2 className="h-3.5 w-3.5" />
              ) : (
                <VolumeX className="h-3.5 w-3.5 text-[#8A7360]" />
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setMixerOpen((prev) => !prev);
                setWeatherOpen(false);
              }}
              className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-xl transition ${
                mixerOpen
                  ? 'bg-[#4A2E1B] text-[#FAF5EC]'
                  : 'text-[#4A2E1B] hover:bg-[#4A2E1B]/10'
              }`}
              title="Ambient sound mixer"
              aria-label="Ambient sound mixer"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </button>

            {mixerOpen && (
              <div className="absolute top-12 right-0 z-30 w-60 space-y-3 rounded-2xl border border-[#E5D7C3] bg-[#FAF5EC]/95 p-4 text-[#241A13] shadow-xl backdrop-blur-xl">
                <p className="font-mono text-[10px] font-semibold tracking-[0.14em] text-[#7A5230] uppercase">
                  SOUND MIXER
                </p>

                <label className="block">
                  <div className="flex justify-between font-mono text-[10px] text-[#5C4432]">
                    <span>Music</span>
                    <span>{Math.round(musicVol * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.02}
                    value={musicVol}
                    onChange={(e) =>
                      handleVolumeChange(parseFloat(e.target.value), rainVol, crackleVol)
                    }
                    className="mt-1 w-full cursor-pointer accent-[#4A2E1B]"
                  />
                </label>

                <label className="block">
                  <div className="flex justify-between font-mono text-[10px] text-[#5C4432]">
                    <span>Rain Ambience</span>
                    <span>{Math.round(rainVol * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.02}
                    value={rainVol}
                    onChange={(e) =>
                      handleVolumeChange(musicVol, parseFloat(e.target.value), crackleVol)
                    }
                    className="mt-1 w-full cursor-pointer accent-[#4A2E1B]"
                  />
                </label>

                <label className="block">
                  <div className="flex justify-between font-mono text-[10px] text-[#5C4432]">
                    <span>Vinyl Crackle</span>
                    <span>{Math.round(crackleVol * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.02}
                    value={crackleVol}
                    onChange={(e) =>
                      handleVolumeChange(musicVol, rainVol, parseFloat(e.target.value))
                    }
                    className="mt-1 w-full cursor-pointer accent-[#4A2E1B]"
                  />
                </label>
              </div>
            )}
          </div>

          {/* Switch to Lo-Fi Catalog */}
          <button
            type="button"
            onClick={onSwitchToLofi}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-2xl border border-[#E5D7C3]/85 bg-[#FAF5EC]/84 px-3 py-2 text-xs font-semibold text-[#4A2E1B] shadow-[0_10px_28px_rgba(18,12,8,0.2)] backdrop-blur-xl transition hover:bg-[#FAF5EC]"
            title="Switch to Lo-Fi Catalog View"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Lo-Fi View</span>
          </button>
        </div>
      </div>

      {/* Floating Center Hover Hint or Time Scrubber */}
      <div className="flex flex-col items-center gap-2">
        {showTimeScrubber && (
          <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-[#E5D7C3] bg-[#FAF5EC]/92 px-4 py-3 text-[#241A13] shadow-xl backdrop-blur-xl">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-mono text-[10.5px] font-semibold text-[#5C4432] uppercase">
                <Clock className="h-3.5 w-3.5 text-[#7A5230]" />
                <span>
                  {formatClock(hourDecimal)} · {phaseLabel}
                </span>
              </div>
              {!isLiveTime && (
                <button
                  type="button"
                  onClick={onResetLiveTime}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#4A2E1B]/20 bg-white px-2 py-0.5 font-mono text-[9.5px] font-semibold text-[#4A2E1B] hover:bg-[#EFE4D3]"
                >
                  <RotateCcw className="h-2.5 w-2.5" />
                  <span>Live Time</span>
                </button>
              )}
            </div>
            <input
              type="range"
              min={0}
              max={23.95}
              step={0.05}
              value={hourDecimal}
              onChange={(e) => onScrubHour(parseFloat(e.target.value))}
              aria-label="Time of day scrubber"
              className="mt-2 w-full cursor-pointer accent-[#4A2E1B]"
            />
          </div>
        )}

        {hoverLabel && (
          <div className="rounded-full border border-[#E5D7C3]/80 bg-[#1B130D]/78 px-3.5 py-1.5 font-mono text-[10.5px] font-medium tracking-wide text-[#FAF5EC] shadow-lg backdrop-blur-md">
            {hoverLabel}
          </div>
        )}
      </div>

      {/* Bottom Bar: Left Now Playing Player & Right Quick Actions */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        {/* Bottom-Left Compact Player (Prev/Next shown ONLY when release has > 1 track) */}
        <div className="pointer-events-auto w-full max-w-sm rounded-[22px] border border-[#E5D7C3]/90 bg-[#FAF5EC]/86 p-3 text-[#241A13] shadow-[0_18px_44px_rgba(14,9,5,0.34)] backdrop-blur-xl">
          {activeVinyl ? (
            <div className="space-y-2.5">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onOpenLinerNotes}
                  className="relative h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-black/10 bg-[#18110C] shadow-xs"
                  title="Open liner notes"
                >
                  <img
                    src={coverSrc}
                    alt={activeVinyl.title}
                    className="h-full w-full object-cover"
                  />
                </button>

                <div className="min-w-0 flex-1">
                  <p className="inline-flex items-center gap-1 font-mono text-[9px] font-semibold tracking-[0.14em] text-[#7A5230] uppercase">
                    <Music2 className="h-2.5 w-2.5" />
                    {isPlaying ? 'Now Playing' : 'On Turntable'}
                  </p>
                  <p className="truncate font-serif text-lg leading-tight text-[#241A13]">
                    {activeTrack ? activeTrack.title : activeVinyl.title}
                  </p>
                  <p className="truncate text-[11px] text-[#655040]">
                    {activeVinyl.artist}
                    {activeTrack ? ` · ${activeVinyl.title}` : ''}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onOpenLinerNotes}
                  className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-[#4A2E1B]/16 bg-white/85 text-[#4A2E1B] transition hover:bg-white"
                  title="Liner notes & tracklist"
                  aria-label="Open liner notes"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Playback Controls + Seek Bar */}
              <div className="flex items-center gap-2">
                <div className="flex shrink-0 items-center gap-1.5">
                  {showTrackNav && onPrevTrack && (
                    <button
                      type="button"
                      onClick={onPrevTrack}
                      className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-[#4A2E1B]/20 bg-white/90 text-[#4A2E1B] shadow-xs transition hover:bg-[#EFE4D3]"
                      aria-label="Previous track"
                      title="Previous track"
                    >
                      <SkipBack className="h-3 w-3 fill-current" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={onTogglePlay}
                    className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#4A2E1B] text-[#FAF5EC] shadow-xs transition hover:bg-[#3A2213]"
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? (
                      <Pause className="h-3.5 w-3.5" />
                    ) : (
                      <Play className="ml-0.5 h-3.5 w-3.5" />
                    )}
                  </button>

                  {showTrackNav && onNextTrack && (
                    <button
                      type="button"
                      onClick={onNextTrack}
                      className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-[#4A2E1B]/20 bg-white/90 text-[#4A2E1B] shadow-xs transition hover:bg-[#EFE4D3]"
                      aria-label="Next track"
                      title="Next track"
                    >
                      <SkipForward className="h-3 w-3 fill-current" />
                    </button>
                  )}
                </div>

                <div className="relative flex flex-1 items-center">
                  <div className="pointer-events-none h-1.5 w-full overflow-hidden rounded-full bg-[#4A2E1B]/15">
                    <div
                      className="h-full rounded-full bg-[#4A2E1B] transition-[width] duration-150"
                      style={{ width: `${Math.round(progressRatio * 100)}%` }}
                    />
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.005}
                    value={progressRatio}
                    onChange={(e) => onSeekProgress(parseFloat(e.target.value))}
                    aria-label="Seek playback"
                    className="absolute inset-0 h-5 w-full -translate-y-1.5 cursor-pointer opacity-0"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 py-1">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#4A2E1B]/12 text-[#4A2E1B]">
                  <Disc3 className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-mono text-[9.5px] font-semibold tracking-wider text-[#7A5230] uppercase">
                    EMPTY PLATTER
                  </p>
                  <p className="text-xs font-medium text-[#5C4432]">
                    Pick a vinyl from the rack to play
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenCollection}
                className="cursor-pointer rounded-xl bg-[#4A2E1B] px-3 py-1.5 text-[11px] font-semibold text-[#FAF5EC] transition hover:bg-[#3A2213]"
              >
                Browse
              </button>
            </div>
          )}
        </div>

        {/* Bottom-Right Quick Modals: Collection & Pinboard */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenCollection}
            className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-[#E5D7C3]/90 bg-[#FAF5EC]/86 px-3.5 py-2.5 text-xs font-semibold text-[#241A13] shadow-[0_12px_32px_rgba(14,9,5,0.28)] backdrop-blur-xl transition hover:bg-[#FAF5EC]"
          >
            <Library className="h-3.5 w-3.5 text-[#7A5230]" />
            <span>Collection</span>
            <span className="rounded-full bg-[#4A2E1B]/12 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#4A2E1B]">
              {vinylCount}
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenPinboard}
            className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-[#E5D7C3]/90 bg-[#FAF5EC]/86 px-3.5 py-2.5 text-xs font-semibold text-[#241A13] shadow-[0_12px_32px_rgba(14,9,5,0.28)] backdrop-blur-xl transition hover:bg-[#FAF5EC]"
          >
            <Pin className="h-3.5 w-3.5 text-[#7A5230]" />
            <span>Pinboard</span>
            <span className="rounded-full bg-[#4A2E1B]/12 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#4A2E1B]">
              {postcardCount}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}