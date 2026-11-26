'use client';

import React, { useState } from 'react';
import {
  Volume2,
  VolumeX,
  ArrowRight,
  Disc3,
  Clock,
  CloudSun,
  CloudRain,
  Wind,
  Sun,
  Library,
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

export default function EntryGate({
  visible,
  isNightHud,
  hourDecimal,
  phaseLabel,
  weather,
  vinylCount,
  featuredTitle,
  featuredArtist,
  onEnterRoom,
  onEnterLofi,
}: EntryGateProps) {
  const [soundOn, setSoundOn] = useState(true);

  if (!visible) return null;

  const formattedTime = (() => {
    const mins = Math.floor((((hourDecimal % 24) + 24) % 24) * 60);
    const hh = String(Math.floor(mins / 60)).padStart(2, '0');
    const mm = String(mins % 60).padStart(2, '0');
    return `${hh}:${mm}`;
  })();

  const WeatherIcon =
    weather === 'RAIN'
      ? CloudRain
      : weather === 'CLOUDY'
      ? CloudSun
      : weather === 'BREEZY'
      ? Wind
      : Sun;

  return (
    <div className="orihour-scroll fixed inset-0 z-40 flex items-center justify-center overflow-y-auto p-4 sm:p-6">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-gradient-to-t from-[#120C08]/38 via-transparent to-[#120C08]/18"
      />

      {/* Lightweight GPU-friendly frosted glass card (single moderate backdrop blur, zero stacked blur-3xl orbs) */}
      <section
        className={`relative isolate my-auto w-full max-w-[492px] overflow-hidden rounded-[26px] border p-6 sm:p-7 ${
          isNightHud
            ? 'border-[#F3E2CC]/22 bg-[#1D1510]/84 text-[#F7F1E6] shadow-[0_28px_72px_-16px_rgba(6,4,2,0.72),inset_0_1px_0_rgba(255,236,210,0.2)]'
            : 'border-white/85 bg-[#FAF5EC]/84 text-[#241A13] shadow-[0_28px_68px_-16px_rgba(24,16,10,0.32),inset_0_1px_0_rgba(255,255,255,0.92)]'
        }`}
        style={{
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          backgroundImage: isNightHud
            ? 'radial-gradient(circle at 92% 6%, rgba(181,138,82,0.14), transparent 44%), radial-gradient(circle at 8% 96%, rgba(74,46,27,0.24), transparent 48%)'
            : 'radial-gradient(circle at 92% 6%, rgba(181,138,82,0.14), transparent 44%), radial-gradient(circle at 8% 96%, rgba(74,46,27,0.08), transparent 48%)',
        }}
      >
        <div className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold tracking-[0.12em] uppercase ${
                isNightHud
                  ? 'border-[#F3E2CC]/20 bg-[#F3E2CC]/10 text-[#E6C79C]'
                  : 'border-[#4A2E1B]/18 bg-white/70 text-[#4A2E1B]'
              }`}
            >
              <Disc3
                className={`h-3.5 w-3.5 animate-spin ${
                  isNightHud ? 'text-[#D4AA63]' : 'text-[#4A2E1B]'
                }`}
                style={{ animationDuration: '8s' }}
              />
              PERSONAL LISTENING ROOM
            </span>

            <div
              className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold ${
                isNightHud
                  ? 'border-[#F3E2CC]/15 bg-[#F3E2CC]/8 text-[#DFD2C3]'
                  : 'border-white/80 bg-white/65 text-[#3A2B20]'
              }`}
            >
              <span className="inline-flex items-center gap-1">
                <Clock className={`h-3 w-3 ${isNightHud ? 'text-[#D4AA63]' : 'text-[#4A2E1B]'}`} />
                {formattedTime}
              </span>
              <span
                className={`h-2.5 w-px ${isNightHud ? 'bg-[#F3E2CC]/25' : 'bg-[#3A2B20]/20'}`}
              />
              <span className="inline-flex items-center gap-1">
                <WeatherIcon
                  className={`h-3 w-3 ${isNightHud ? 'text-[#D4AA63]' : 'text-[#7A5230]'}`}
                />
                {weather}
              </span>
            </div>
          </div>

          <div className="mt-5">
            <h1
              className={`font-serif text-[2.85rem] leading-none font-normal tracking-[0.16em] uppercase not-italic sm:text-[3.3rem] ${
                isNightHud ? 'text-[#FAF5EC]' : 'text-[#241A13]'
              }`}
            >
              ORI
              <span className={`${isNightHud ? 'text-[#D4AA63]' : 'text-[#6E462C]'} not-italic`}>
                HOUR
              </span>
            </h1>
            <p
              className={`mt-2.5 text-[13px] leading-relaxed font-medium ${
                isNightHud ? 'text-[#D6C9BA]' : 'text-[#46362B]'
              }`}
            >
              Step inside a quiet 3D listening room - pull records from the rack, drop the needle, pin a song postcard, and watch the window shift with the hour.
            </p>
          </div>

          <div
            className={`mt-4 flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-2.5 ${
              isNightHud
                ? 'border-[#F3E2CC]/14 bg-[#F3E2CC]/7 shadow-[inset_0_1px_0_rgba(255,238,215,0.08)]'
                : 'border-white/80 bg-white/65 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]'
            }`}
          >
            <div className="min-w-0">
              <p
                className={`font-mono text-[9.5px] font-semibold tracking-[0.14em] uppercase ${
                  isNightHud ? 'text-[#C8B29A]' : 'text-[#7A624E]'
                }`}
              >
                {featuredTitle ? 'ON THE PLATTER' : 'EMPTY PLATTER'} · {vinylCount} ITEMS ·{' '}
                {phaseLabel}
              </p>
              <p
                className={`mt-0.5 truncate font-serif text-[17px] leading-snug ${
                  isNightHud ? 'text-[#FAF5EC]' : 'text-[#241A13]'
                }`}
              >
                {featuredTitle ? (
                  <>
                    {featuredTitle}
                    <span
                      className={`font-sans text-xs font-medium ${
                        isNightHud ? 'text-[#C6B8A8]' : 'text-[#5C4432]'
                      }`}
                    >
                      {' '}
                      - {featuredArtist}
                    </span>
                  </>
                ) : (
                  <span
                    className={`font-sans text-xs font-medium ${
                      isNightHud ? 'text-[#C6B8A8]' : 'text-[#5C4432]'
                    }`}
                  >
                    Turntable is resting - pick a vinyl from the rack inside
                  </span>
                )}
              </p>
            </div>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#120E0B] ring-1 ring-[#F3E2CC]/25 shadow-inner">
              <span
                className={`h-2.5 w-2.5 rounded-full ring-2 ring-white/40 ${
                  featuredTitle ? 'bg-[#B58A52]' : 'bg-[#64748B]'
                }`}
              />
            </span>
          </div>

          <div
            className={`mt-2.5 flex items-center justify-between rounded-2xl border px-3.5 py-2.5 ${
              isNightHud
                ? 'border-[#F3E2CC]/12 bg-[#F3E2CC]/6'
                : 'border-white/75 bg-white/55'
            }`}
          >
            <div className="pr-3">
              <p
                className={`font-sans text-xs font-semibold ${
                  isNightHud ? 'text-[#F5EDE1]' : 'text-[#241A13]'
                }`}
              >
                Room Audio &amp; Turntable
              </p>
              <p className={`text-[11px] ${isNightHud ? 'text-[#BAA997]' : 'text-[#5C4432]'}`}>
                Vinyl music, analog needle crackle, and window rain ambience
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={soundOn}
              onClick={() => setSoundOn((prev) => !prev)}
              className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-1.5 font-mono text-[11px] font-semibold transition-colors ${
                soundOn
                  ? isNightHud
                    ? 'border-[#D4AA63]/60 bg-[#D4AA63]/20 text-[#FAF2E4] shadow-sm'
                    : 'border-[#4A2E1B] bg-[#4A2E1B] text-[#FAF5EC] shadow-sm'
                  : isNightHud
                  ? 'border-[#F3E2CC]/18 bg-white/5 text-[#B4A392] hover:bg-white/10'
                  : 'border-[#4A2E1B]/18 bg-white/75 text-[#5C4432] hover:bg-white'
              }`}
            >
              {soundOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
              {soundOn ? 'ON' : 'OFF'}
            </button>
          </div>

          <button
            type="button"
            onClick={() => onEnterRoom(soundOn)}
            className="group mt-4 flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl bg-[#4A2E1B] px-6 py-3 font-sans text-sm font-semibold tracking-wide text-[#FAF5EC] shadow-[0_14px_30px_-8px_rgba(74,46,27,0.55),inset_0_1px_0_rgba(255,245,230,0.22)] transition-colors hover:bg-[#3A2213] hover:shadow-[0_18px_36px_-8px_rgba(58,34,19,0.7)]"
          >
            <span>Enter the Room</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </button>

          <div
            className={`mt-4 flex items-center justify-between border-t pt-3.5 ${
              isNightHud ? 'border-[#F3E2CC]/14' : 'border-[#4A2E1B]/14'
            }`}
          >
            <span
              className={`font-mono text-[10px] tracking-[0.12em] uppercase ${
                isNightHud ? 'text-[#AE9C8A]' : 'text-[#6B5442]'
              }`}
            >
              3D INTERACTIVE · 360° VIEW
            </span>
            <button
              type="button"
              onClick={onEnterLofi}
              className={`inline-flex cursor-pointer items-center gap-1.5 font-mono text-[11px] font-semibold transition-colors ${
                isNightHud
                  ? 'text-[#DFD2C3] hover:text-[#E6C79C]'
                  : 'text-[#3A2213] hover:text-[#7A5230]'
              }`}
            >
              <Library className="h-3.5 w-3.5" />
              <span>Open LO-FI Collection</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}