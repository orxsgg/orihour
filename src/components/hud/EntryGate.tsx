'use client';

import React, { useState } from 'react';
import {
  ArrowRight,
  Clock,
  Cloud,
  CloudRain,
  Disc3,
  Headphones,
  LayoutGrid,
  Sun,
  Volume2,
  VolumeX,
  Wind,
} from 'lucide-react';
import { WeatherType } from '@/types/orihour';

interface EntryGateProps {
  visible: boolean;
  isNightHud: boolean;
  hourDecimal: number;
  phaseLabel: string;
  weather: WeatherType;
  vinylCount: number;
  featuredTitle: string | null;
  featuredArtist: string | null;
  onEnterRoom: (withSound: boolean) => void;
  onEnterLofi: () => void;
}

function formatClock(hourDecimal: number): string {
  const totalMins = Math.floor((((hourDecimal % 24) + 24) % 24) * 60);
  const hh = String(Math.floor(totalMins / 60)).padStart(2, '0');
  const mm = String(totalMins % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

export default function EntryGate({
  visible,
  hourDecimal,
  phaseLabel,
  weather,
  vinylCount,
  featuredTitle,
  featuredArtist,
  onEnterRoom,
  onEnterLofi,
}: EntryGateProps) {
  const [withSound, setWithSound] = useState(true);

  const WeatherIcon =
    weather === 'RAIN'
      ? CloudRain
      : weather === 'CLOUDY'
      ? Cloud
      : weather === 'BREEZY'
      ? Wind
      : Sun;

  return (
    <div
      className={`fixed inset-0 z-30 flex items-center justify-center p-4 sm:p-6 transition-opacity duration-500 ${
        visible ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <div className="orihour-scroll max-h-[92dvh] w-full max-w-[440px] overflow-y-auto rounded-[28px] border border-[#E6C79C]/26 bg-[#1C140E]/82 p-5 text-[#FAF5EC] shadow-[0_32px_90px_-14px_rgba(0,0,0,0.85)] backdrop-blur-2xl sm:p-7">
        {/* Top Meta Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E6C79C]/25 bg-[#FAF5EC]/8 px-2.5 py-1 font-mono text-[9.5px] font-semibold tracking-[0.16em] text-[#E6C79C] uppercase">
            <Disc3 className="h-3 w-3 shrink-0" />
            PERSONAL LISTENING ROOM
          </span>

          <div className="flex items-center gap-1.5 font-mono text-[10px] font-semibold text-[#EADBC4]">
            <span className="inline-flex items-center gap-1 rounded-full border border-[#FAF5EC]/15 bg-[#FAF5EC]/8 px-2.5 py-1">
              <Clock className="h-3 w-3 text-[#D4AA63]" />
              {formatClock(hourDecimal)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-[#FAF5EC]/15 bg-[#FAF5EC]/8 px-2.5 py-1 uppercase">
              <WeatherIcon className="h-3 w-3 text-[#D4AA63]" />
              {weather}
            </span>
          </div>
        </div>

        {/* Brand Heading */}
        <h1 className="mt-4 bg-gradient-to-b from-[#FFF7E8] via-[#F2D9AE] to-[#CFA360] bg-clip-text font-serif text-4xl leading-none tracking-[0.14em] text-transparent sm:text-5xl">
          ORIHOUR
        </h1>

        <p className="mt-2.5 text-xs leading-relaxed text-[#E3D5C1]/85 sm:text-[13px]">
          Step inside a quiet 3D listening room — pull records from the rack, drop the
          needle, pin a song postcard, and watch the window shift with the hour.
        </p>

        {/* Turntable Status Summary Card */}
        <div className="mt-4 rounded-2xl border border-[#E6C79C]/18 bg-[#FAF5EC]/6 px-4 py-3">
          <p className="font-mono text-[9.5px] font-semibold tracking-[0.14em] text-[#D4AA63] uppercase">
            {featuredTitle ? 'ON PLATTER' : 'EMPTY PLATTER'} · {vinylCount} ITEMS ·{' '}
            {phaseLabel.toUpperCase()}
          </p>
          <p className="mt-1 truncate text-xs text-[#FAF5EC]/90">
            {featuredTitle
              ? `${featuredTitle}${featuredArtist ? ` — ${featuredArtist}` : ''}`
              : 'Turntable is resting — pick a vinyl from the rack inside.'}
          </p>
        </div>

        {/* Sound Preference Toggle */}
        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-[#FAF5EC]/14 bg-[#FAF5EC]/5 px-4 py-3">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FAF5EC]">
              <Headphones className="h-3.5 w-3.5 shrink-0 text-[#D4AA63]" />
              <span>Room Audio &amp; Turntable</span>
            </p>
            <p className="mt-0.5 text-[11px] text-[#D9C9B2]/75">
              Vinyl music, analog needle crackle, and window ambience
            </p>
          </div>

          <button
            type="button"
            onClick={() => setWithSound((prev) => !prev)}
            className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[10px] font-semibold transition ${
              withSound
                ? 'border-[#D4AA63]/60 bg-[#4A2E1B] text-[#FAF5EC]'
                : 'border-[#FAF5EC]/20 bg-transparent text-[#D9C9B2]'
            }`}
            aria-label={withSound ? 'Mute room audio on entry' : 'Enable room audio on entry'}
          >
            {withSound ? (
              <>
                <Volume2 className="h-3.5 w-3.5 text-[#E6C79C]" />
                <span>ON</span>
              </>
            ) : (
              <>
                <VolumeX className="h-3.5 w-3.5" />
                <span>OFF</span>
              </>
            )}
          </button>
        </div>

        {/* Primary CTA */}
        <button
          type="button"
          onClick={() => onEnterRoom(withSound)}
          className="mt-5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#4A2E1B] px-5 py-3.5 text-sm font-semibold text-[#FAF5EC] shadow-[0_14px_32px_rgba(0,0,0,0.45)] ring-1 ring-[#E6C79C]/35 transition hover:bg-[#5C3A23]"
        >
          <span>Enter the Room</span>
          <ArrowRight className="h-4 w-4" />
        </button>

        {/* Bottom Footer Row — Responsive Stack on Tiny Phones */}
        <div className="mt-4 flex flex-col items-center justify-between gap-2.5 border-t border-[#FAF5EC]/12 pt-3.5 sm:flex-row">
          <span className="font-mono text-[9.5px] tracking-[0.14em] text-[#D9C9B2]/70 uppercase">
            3D INTERACTIVE · 360° VIEW
          </span>

          <button
            type="button"
            onClick={onEnterLofi}
            className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap font-mono text-[11px] font-semibold text-[#E6C79C] transition hover:text-[#FFF5E2]"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>Open Lo-Fi Collection</span>
          </button>
        </div>
      </div>
    </div>
  );
}