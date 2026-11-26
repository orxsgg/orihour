'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Disc3, Lock, Mail, ArrowRight, AlertCircle } from 'lucide-react';
import {
  createSupabaseBrowserClient,
  isSupabaseConfigured,
} from '@/lib/supabase/client';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState<number>(0);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());

  const configured = isSupabaseConfigured();

  // Redirect automatically if a valid session already exists
  useEffect(() => {
    if (!configured) return;
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        router.replace('/admin');
      }
    });
  }, [configured, router]);

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const timer = setInterval(() => setNowTick(Date.now()), 500);
    return () => clearInterval(timer);
  }, [cooldownUntil]);

  const remainingCooldownSec = Math.max(0, Math.ceil((cooldownUntil - nowTick) / 1000));

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (remainingCooldownSec > 0) {
      setErrorMsg(`Terlalu banyak percobaan gagal. Tunggu ${remainingCooldownSec} detik.`);
      return;
    }

    if (!configured) {
      setErrorMsg('Konfigurasi .env.local Supabase belum lengkap.');
      return;
    }

    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        const nextFails = failedAttempts + 1;
        setFailedAttempts(nextFails);
        if (nextFails >= 4) {
          const until = Date.now() + 30_000;
          setCooldownUntil(until);
          setNowTick(Date.now());
          setErrorMsg('Percobaan gagal berulang. Tunggu 30 detik sebelum mencoba lagi.');
        } else {
          setErrorMsg('Email atau password salah. Pastikan akun sudah dibuat di Supabase Users.');
        }
        setLoading(false);
        return;
      }

      setFailedAttempts(0);
      router.replace('/admin');
      router.refresh();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Terjadi kesalahan saat masuk.'
      );
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-gradient-to-br from-[#F7F1E7] via-[#EFE5D6] to-[#E5D6C2] p-6 text-[#241A13]">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -top-32 -left-24 h-96 w-96 rounded-full bg-[#4A2E1B]/12 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -right-24 -bottom-32 h-96 w-96 rounded-full bg-[#B58A52]/20 blur-3xl"
      />

      <section
        className="relative z-10 w-full max-w-md rounded-[28px] border border-[#E5D7C3] bg-[#FAF5EC]/86 p-8 shadow-[0_28px_80px_-20px_rgba(32,20,12,0.22),inset_0_1px_0_rgba(255,255,255,0.95)]"
        style={{
          backdropFilter: 'blur(22px)',
          WebkitBackdropFilter: 'blur(22px)',
        }}
      >
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#4A2E1B]/15 bg-white/85 px-3 py-1 font-mono text-[10.5px] font-semibold tracking-[0.16em] text-[#4A2E1B] uppercase">
            <Disc3 className="h-3.5 w-3.5" />
            ORIHOUR CONSOLE
          </span>
          <span className="font-mono text-[10px] font-semibold tracking-[0.14em] text-[#7D6654] uppercase">
            PRIVATE ACCESS
          </span>
        </div>

        <h1 className="mt-5 font-serif text-4xl leading-none tracking-[0.06em] text-[#241A13]">
          Curator Sign In
        </h1>
        <p className="mt-2 text-sm text-[#655040]">
          Masuk dengan akun admin Supabase untuk mengelola koleksi vinyl, cover, poster, dan pinboard.
        </p>

        {errorMsg && (
          <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-[#4A2E1B]/25 bg-[#4A2E1B]/10 px-4 py-3 text-xs font-medium text-[#3A2213]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <label className="block">
            <span className="font-mono text-[10.5px] font-semibold tracking-[0.14em] text-[#5C4432] uppercase">
              Admin Email
            </span>
            <div className="relative mt-1.5">
              <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#8C735F]" />
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="curator@orihour.room"
                className="w-full rounded-2xl border border-[#4A2E1B]/18 bg-white py-3 pr-4 pl-10 text-sm text-[#241A13] placeholder-[#9B8776] outline-none transition focus:border-[#4A2E1B]"
              />
            </div>
          </label>

          <label className="block">
            <span className="font-mono text-[10.5px] font-semibold tracking-[0.14em] text-[#5C4432] uppercase">
              Password
            </span>
            <div className="relative mt-1.5">
              <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#8C735F]" />
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-2xl border border-[#4A2E1B]/18 bg-white py-3 pr-4 pl-10 text-sm text-[#241A13] placeholder-[#9B8776] outline-none transition focus:border-[#4A2E1B]"
              />
            </div>
          </label>

          <button
            type="submit"
            disabled={loading || remainingCooldownSec > 0}
            className="group mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#4A2E1B] px-5 py-3 text-sm font-semibold text-[#FAF5EC] shadow-[0_14px_30px_-10px_rgba(74,46,27,0.52)] transition hover:bg-[#3A2213] disabled:cursor-not-allowed disabled:opacity-55"
          >
            <span>
              {remainingCooldownSec > 0
                ? `Tunggu ${remainingCooldownSec} detik...`
                : loading
                ? 'Memverifikasi...'
                : 'Masuk ke Panel Admin'}
            </span>
            {!loading && remainingCooldownSec === 0 && (
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            )}
          </button>
        </form>
      </section>
    </main>
  );
}