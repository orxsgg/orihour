'use client';

import React, { useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  SlidersHorizontal,
  RotateCcw,
  Library,
  Pin,
  ChevronRight,
  Settings2,
} from 'lucide-react';
import {
  CameraFocusTarget,
  TrackItem,
  VinylRecord,
  WeatherType,
} from '@/types/orihour';
import { hasMultipleTracks } from '@/lib/genreUtils';

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

const NAV_ITEMS: { id: CameraFocusTarget; label: string }[] = [
  { id: 'ROOM', label: 'ROOM' },
  { id: 'TURNTABLE', label: 'TURNTABLE' },
  { id: 'CRATE', label: 'RACK' },
  { id: 'WALLET', label: 'WALLET' },
  { id: 'NOTES', label: 'NOTEPAD' },
  { id: 'WINDOW', label: 'WINDOW' },
  { id: 'CLOCK', label: 'CLOCK' },
];

const WEATHER_ORDER: WeatherType[] = ['CLEAR', 'CLOUDY', 'RAIN', 'BREEZY'];

export default function MinimalHud(props: MinimalHudProps) {
  const [showMixer, setShowMixer] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(true);
  const [musicVol, setMusicVol] = useState(0.75);
  const [rainVol, setRainVol] = useState(0.35);
  const [crackleVol, setCrackleVol] = useState(0.22);

  const formattedTime = (() => {
    const mins = Math.floor((((props.hourDecimal % 24) + 24) % 24) * 60);
    const hh = String(Math.floor(mins / 60)).padStart(2, '0');
    const mm = String(mins % 60).padStart(2, '0');
    return `${hh}:${mm}`;
  })();

  const handleMixerChange = (m: number, r: number, c: number) => {
    setMusicVol(m);
    setRainVol(r);
    setCrackleVol(c);
    props.onUpdateVolumes(m, r, c);
  };

  const nextWeather = () => {
    const idx = WEATHER_ORDER.indexOf(props.weather);
    props.onChangeWeather(WEATHER_ORDER[(idx + 1) % WEATHER_ORDER.length]);
  };

  const hasRecord = Boolean(props.activeVinyl);
  const showTrackNav = Boolean(
    props.activeVinyl &&
      hasMultipleTracks(props.activeVinyl) &&
      props.onPrevTrack &&
      props.onNextTrack
  );
  const displayTitle = props.activeTrack
    ? `${props.activeTrack.title} (${props.activeVinyl?.title ?? ''})`
    : props.activeVinyl?.title ?? '';

  return (
    <>
      {/* Top Borderless Editorial Bar */}
      <header className="pointer-events-none fixed top-0 right-0 left-0 z-20 flex flex-wrap items-center justify-between gap-3 px-6 py-5">
        <button
          type="button"
          onClick={() => props.onChangeFocus('DESK')}
          className="pointer-events-auto cursor-pointer font-mono text-sm font-bold tracking-[0.22em] text-[#FAF5EC] uppercase drop-shadow-[0_1px_6px_rgba(0,0,0,0.7)] transition hover:text-[#E6C79C]"
        >
          ORIHOUR
        </button>

        <nav className="pointer-events-auto flex flex-wrap items-center gap-4 font-mono text-[11px] font-semibold tracking-[0.14em] text-[#FAF5EC]/92 drop-shadow-[0_1px_6px_rgba(0,0,0,0.7)]">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => props.onChangeFocus(item.id)}
              className={`cursor-pointer transition hover:text-white ${
                props.cameraFocus === item.id
                  ? 'text-[#E6C79C] underline underline-offset-4'
                  : ''
              }`}
            >
              {item.label}
            </button>
          ))}

          <span className="h-3 w-px bg-[#FAF5EC]/30" />

          <button
            type="button"
            onClick={props.onOpenCollection}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[#FAF5EC]/35 bg-[#2A1A10]/65 px-3 py-1 text-[10.5px] text-[#FAF5EC] backdrop-blur-md transition hover:border-[#E6C79C] hover:bg-[#4A2E1B]"
          >
            <Library className="h-3 w-3" />
            <span>COLLECTION ({props.vinylCount})</span>
          </button>

          <button
            type="button"
            onClick={props.onOpenPinboard}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-[10.5px] backdrop-blur-md transition ${
              props.cameraFocus === 'PINBOARD'
                ? 'border-[#E6C79C] bg-[#4A2E1B] text-[#FAF5EC]'
                : 'border-[#FAF5EC]/35 bg-[#2A1A10]/65 text-[#FAF5EC] hover:border-[#E6C79C] hover:bg-[#4A2E1B]'
            }`}
          >
            <Pin className="h-3 w-3" />
            <span>PINBOARD ({props.postcardCount})</span>
          </button>
        </nav>
      </header>

      {/* Time Scrubber Popover */}
      {props.showTimeScrubber && (
        <div className="fixed top-16 right-6 z-30 w-72 rounded-xl border border-[#E6C79C]/30 bg-[#1F140D]/88 p-4 text-[#FAF5EC] shadow-2xl backdrop-blur-xl">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[11px] font-semibold">
              {formattedTime} · {props.phaseLabel}
            </span>
            <button
              type="button"
              onClick={props.onResetLiveTime}
              className="inline-flex cursor-pointer items-center gap-1 rounded bg-[#FAF5EC]/15 px-2 py-0.5 font-mono text-[10px] hover:bg-[#FAF5EC]/25"
            >
              <RotateCcw className="h-3 w-3" />
              LIVE
            </button>
          </div>
          <input
            type="range"
            min={0}
            max={23.98}
            step={0.05}
            value={props.hourDecimal}
            onChange={(e) => props.onScrubHour(parseFloat(e.target.value))}
            className="w-full cursor-pointer accent-[#D4AA63]"
          />
          <div className="mt-1 flex justify-between font-mono text-[9px] text-[#FAF5EC]/60">
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>23:59</span>
          </div>
        </div>
      )}

      {/* Ambient Sound Mixer Popover */}
      {showMixer && controlsOpen && (
        <div className="fixed right-6 bottom-16 z-30 w-64 rounded-xl border border-[#E6C79C]/30 bg-[#1F140D]/90 p-4 text-[#FAF5EC] shadow-2xl backdrop-blur-xl">
          <p className="mb-3 font-mono text-[11px] font-semibold tracking-wider text-[#E6C79C]">
            AMBIENT MIXER
          </p>
          <div className="space-y-2.5">
            {[
              {
                label: 'MUSIC',
                val: musicVol,
                set: (v: number) => handleMixerChange(v, rainVol, crackleVol),
              },
              {
                label: 'RAIN',
                val: rainVol,
                set: (v: number) => handleMixerChange(musicVol, v, crackleVol),
              },
              {
                label: 'CRACKLE',
                val: crackleVol,
                set: (v: number) => handleMixerChange(musicVol, rainVol, v),
              },
            ].map((row) => (
              <label key={row.label} className="block">
                <div className="mb-1 flex justify-between font-mono text-[10px] text-[#FAF5EC]/78">
                  <span>{row.label}</span>
                  <span>{Math.round(row.val * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={row.val}
                  onChange={(e) => row.set(parseFloat(e.target.value))}
                  className="w-full cursor-pointer accent-[#D4AA63]"
                />
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Subtle Hover Tooltip */}
      {props.hoverLabel && (
        <div className="pointer-events-none fixed bottom-16 left-1/2 z-30 -translate-x-1/2 rounded-md border border-[#E6C79C]/25 bg-[#1C120C]/85 px-3 py-1 font-mono text-[11px] text-[#FAF5EC] backdrop-blur-md">
          {props.hoverLabel}
        </div>
      )}

      {/* Bottom Corner Micro-Controls */}
      <footer className="pointer-events-none fixed right-0 bottom-0 left-0 z-20 flex flex-wrap items-end justify-between gap-3 px-6 py-4">
        {/* Bottom-Left Player:
            - Multi-track (>1 song): Prev / Play-Pause / Next + Title on top, proportional seek bar underneath
            - Single track (1 song) or empty: exact original layout (Play/Pause left, title + slim bar on right) */}
        {showTrackNav ? (
          <div className="pointer-events-auto flex flex-col gap-1.5 text-[#FAF5EC] drop-shadow-[0_1px_6px_rgba(0,0,0,0.75)]">
            <div className="flex items-center gap-2.5">
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={props.onPrevTrack}
                  className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-[#E6C79C]/38 bg-[#2A1A10]/65 backdrop-blur-md transition hover:border-[#FAF5EC] hover:bg-[#4A2E1B]"
                  aria-label="Previous track"
                  title="Previous track"
                >
                  <SkipBack className="h-2.5 w-2.5 fill-current text-[#FAF5EC]" />
                </button>

                <button
                  type="button"
                  onClick={props.onTogglePlay}
                  className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-[#E6C79C]/45 bg-[#2A1A10]/65 backdrop-blur-md transition hover:border-[#FAF5EC] hover:bg-[#4A2E1B]"
                  aria-label={props.isPlaying ? 'Pause' : 'Resume'}
                  title={props.isPlaying ? 'Pause' : 'Play / Resume'}
                >
                  {props.isPlaying ? (
                    <Pause className="h-3 w-3 text-[#FAF5EC]" />
                  ) : (
                    <Play className="ml-0.5 h-3 w-3 text-[#FAF5EC]" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={props.onNextTrack}
                  className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-[#E6C79C]/38 bg-[#2A1A10]/65 backdrop-blur-md transition hover:border-[#FAF5EC] hover:bg-[#4A2E1B]"
                  aria-label="Next track"
                  title="Next track"
                >
                  <SkipForward className="h-2.5 w-2.5 fill-current text-[#FAF5EC]" />
                </button>
              </div>

              <button
                type="button"
                onClick={props.onOpenLinerNotes}
                className="block max-w-[200px] cursor-pointer truncate text-left leading-none transition hover:text-[#E6C79C] sm:max-w-[280px]"
              >
                <p className="truncate font-mono text-[11px] font-semibold tracking-wide text-[#FAF5EC]">
                  {displayTitle}
                  <span className="font-normal text-[#FAF5EC]/72">
                    {' '}
                    - {props.activeVinyl?.artist}
                  </span>
                </p>
              </button>
            </div>

            {/* Proportional Seekable Bar Directly Underneath Prev / Play-Pause / Next */}
            <div className="group relative flex h-2 w-60 items-center sm:w-72">
              <div className="pointer-events-none h-[2px] w-full overflow-hidden rounded-full bg-[#FAF5EC]/25 transition-all group-hover:h-[3px]">
                <div
                  className="h-full rounded-full bg-[#E6C79C] transition-[width] duration-75"
                  style={{ width: `${Math.round(props.progressRatio * 100)}%` }}
                />
              </div>
              <input
                type="range"
                min={0}
                max={1000}
                step={1}
                value={Math.round(props.progressRatio * 1000)}
                onChange={(e) => props.onSeekProgress(parseInt(e.target.value, 10) / 1000)}
                aria-label="Seek track position"
                className="absolute inset-0 -top-1.5 h-5 w-full cursor-pointer opacity-0"
              />
              <span
                className="pointer-events-none absolute top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FAF5EC] shadow-[0_0_4px_rgba(20,12,8,0.85)] transition-transform group-hover:scale-125"
                style={{ left: `${Math.round(props.progressRatio * 100)}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="pointer-events-auto flex items-center gap-2.5 text-[#FAF5EC] drop-shadow-[0_1px_6px_rgba(0,0,0,0.75)]">
            <button
              type="button"
              onClick={props.onTogglePlay}
              disabled={!hasRecord}
              className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[#E6C79C]/45 bg-[#2A1A10]/65 backdrop-blur-md transition hover:border-[#FAF5EC] hover:bg-[#4A2E1B] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={props.isPlaying ? 'Pause' : 'Resume'}
              title={props.isPlaying ? 'Pause' : 'Play / Resume'}
            >
              {props.isPlaying ? (
                <Pause className="h-3 w-3 text-[#FAF5EC]" />
              ) : (
                <Play className="ml-0.5 h-3 w-3 text-[#FAF5EC]" />
              )}
            </button>

            <div className="flex min-w-0 flex-col justify-center">
              <button
                type="button"
                onClick={() => {
                  if (hasRecord) props.onOpenLinerNotes();
                  else props.onChangeFocus('CRATE');
                }}
                className="block max-w-[240px] cursor-pointer truncate text-left leading-none transition hover:text-[#E6C79C] sm:max-w-[320px]"
              >
                <p className="truncate font-mono text-[11px] font-semibold tracking-wide text-[#FAF5EC]">
                  {props.activeVinyl ? (
                    <>
                      {displayTitle}
                      <span className="font-normal text-[#FAF5EC]/72">
                        {' '}
                        - {props.activeVinyl.artist}
                      </span>
                    </>
                  ) : (
                    <span className="text-[#FAF5EC]/75">
                      No Record on Platter · Pick from Rack
                    </span>
                  )}
                </p>
              </button>

              {/* Slim 2px Seekable Bar aligned cleanly under the title */}
              <div className="group relative mt-1.5 flex h-2 w-44 items-center sm:w-48">
                <div className="pointer-events-none h-[2px] w-full overflow-hidden rounded-full bg-[#FAF5EC]/25 transition-all group-hover:h-[3px]">
                  <div
                    className="h-full rounded-full bg-[#E6C79C] transition-[width] duration-75"
                    style={{ width: `${Math.round(props.progressRatio * 100)}%` }}
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  max={1000}
                  step={1}
                  disabled={!hasRecord}
                  value={Math.round(props.progressRatio * 1000)}
                  onChange={(e) => props.onSeekProgress(parseInt(e.target.value, 10) / 1000)}
                  aria-label="Seek track position"
                  className="absolute inset-0 -top-1.5 h-5 w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                />
                {hasRecord && (
                  <span
                    className="pointer-events-none absolute top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FAF5EC] shadow-[0_0_4px_rgba(20,12,8,0.85)] transition-transform group-hover:scale-125"
                    style={{ left: `${Math.round(props.progressRatio * 100)}%` }}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Bottom-Right: Collapsible Settings Row + Always-visible Back-to-Desk button */}
        <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-2 font-mono text-[10.5px] font-semibold tracking-wider text-[#FAF5EC]">
          {props.cameraFocus !== 'DESK' && (
            <button
              type="button"
              onClick={() => props.onChangeFocus('DESK')}
              className="cursor-pointer rounded-lg border border-[#E6C79C]/45 bg-[#2A1A10]/80 px-2.5 py-1 backdrop-blur-md transition hover:bg-[#4A2E1B]"
            >
              {props.cameraFocus === 'NOTES'
                ? 'PUT DOWN NOTEPAD · ESC'
                : props.cameraFocus === 'WALLET'
                ? 'CLOSE WALLET · ESC'
                : 'BACK TO DESK · ESC'}
            </button>
          )}

          {controlsOpen && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={props.onToggleTimeScrubber}
                className="cursor-pointer rounded-lg border border-[#FAF5EC]/25 bg-[#2A1A10]/65 px-2.5 py-1 backdrop-blur-md transition hover:border-[#E6C79C] hover:bg-[#4A2E1B]"
              >
                {formattedTime} {props.isLiveTime ? 'LIVE' : 'SCRUB'}
              </button>

              <button
                type="button"
                onClick={nextWeather}
                className="cursor-pointer rounded-lg border border-[#FAF5EC]/25 bg-[#2A1A10]/65 px-2.5 py-1 backdrop-blur-md transition hover:border-[#E6C79C] hover:bg-[#4A2E1B]"
              >
                {props.weather}
              </button>

              <button
                type="button"
                onClick={props.onToggleLamp}
                className="cursor-pointer rounded-lg border border-[#FAF5EC]/25 bg-[#2A1A10]/65 px-2.5 py-1 backdrop-blur-md transition hover:border-[#E6C79C] hover:bg-[#4A2E1B]"
              >
                LAMP {props.lampOn ? 'ON' : 'OFF'}
              </button>

              <button
                type="button"
                onClick={() => setShowMixer((prev) => !prev)}
                className={`cursor-pointer rounded-lg border px-2.5 py-1 backdrop-blur-md transition ${
                  showMixer
                    ? 'border-[#E6C79C] bg-[#4A2E1B]'
                    : 'border-[#FAF5EC]/25 bg-[#2A1A10]/65 hover:border-[#E6C79C] hover:bg-[#4A2E1B]'
                }`}
                title="Ambient Sound Mixer"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={props.onSwitchToLofi}
                className="cursor-pointer rounded-lg border border-[#FAF5EC]/25 bg-[#2A1A10]/65 px-2.5 py-1 backdrop-blur-md transition hover:border-[#E6C79C] hover:bg-[#4A2E1B]"
              >
                LO-FI
              </button>

              <button
                type="button"
                onClick={props.onToggleSound}
                className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#FAF5EC]/25 bg-[#2A1A10]/65 px-2.5 py-1 backdrop-blur-md transition hover:border-[#E6C79C] hover:bg-[#4A2E1B]"
              >
                {props.soundEnabled ? (
                  <Volume2 className="h-3.5 w-3.5" />
                ) : (
                  <VolumeX className="h-3.5 w-3.5" />
                )}
                <span>{props.soundEnabled ? 'SOUND ON' : 'SOUND OFF'}</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setControlsOpen((prev) => {
                if (prev) setShowMixer(false);
                return !prev;
              });
            }}
            className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#E6C79C]/40 bg-[#4A2E1B]/85 px-2.5 py-1 text-[#FAF5EC] backdrop-blur-md transition hover:bg-[#3A2213]"
            title={controlsOpen ? 'Hide settings options' : 'Show settings options'}
          >
            {controlsOpen ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <>
                <Settings2 className="h-3.5 w-3.5" />
                <span>OPTIONS</span>
              </>
            )}
          </button>
        </div>
      </footer>
    </>
  );
}