import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, sanitizePlainText } from '@/lib/security';
import { mapPostcardRow, PostcardRow } from '@/lib/supabase/mappers';
import {
  createSupabaseServerClient,
  isSupabaseServerConfigured,
} from '@/lib/supabase/server';
import { POSTCARD_LIMITS } from '@/types/orihour';

const ALLOWED_PIN_COLORS = new Set([
  '#4A2E1B',
  '#7A5230',
  '#842536',
  '#2563EB',
  '#0D9488',
  '#C89B54',
  '#7C3AED',
]);

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    // Max 5 postcard submissions per IP within 10 minutes
    const rate = checkRateLimit(`postcards:${ip}`, 5, 10 * 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json(
        {
          error: `Terlalu banyak pengiriman. Coba lagi dalam ${rate.retryAfterSec} detik.`,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(rate.retryAfterSec) },
        }
      );
    }

    const body = await req.json();

    // Anti-bot Honeypot check (hidden field must stay completely empty)
    if (typeof body?.website === 'string' && body.website.trim().length > 0) {
      return NextResponse.json({ error: 'Permintaan ditolak.' }, { status: 400 });
    }

    // Anti-bot minimum human interaction time (>= 1.5s since modal opened)
    if (typeof body?.formLoadedAt === 'number') {
      const elapsed = Date.now() - body.formLoadedAt;
      if (elapsed < 1500) {
        return NextResponse.json(
          { error: 'Mohon isi formulir dengan tenang sebelum mengirim.' },
          { status: 429 }
        );
      }
    }

    const songTitle = sanitizePlainText(body?.songTitle, POSTCARD_LIMITS.songTitle);
    const artist = sanitizePlainText(body?.artist, POSTCARD_LIMITS.artist);
    const senderName = sanitizePlainText(body?.senderName, POSTCARD_LIMITS.senderName);
    const reason = sanitizePlainText(body?.reason, POSTCARD_LIMITS.reason);
    const rawColor = typeof body?.pinColor === 'string' ? body.pinColor.trim() : '#4A2E1B';
    const pinColor = ALLOWED_PIN_COLORS.has(rawColor) ? rawColor : '#4A2E1B';

    if (!songTitle || !artist || !senderName || !reason) {
      return NextResponse.json(
        { error: 'Semua kolom wajib diisi.' },
        { status: 400 }
      );
    }

    const now = new Date();
    const dateLabel = now
      .toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      .toUpperCase();

    if (!isSupabaseServerConfigured()) {
      return NextResponse.json({
        postcard: {
          id: `pc-${Date.now()}`,
          songTitle,
          artist,
          senderName,
          reason,
          dateLabel,
          pinColor,
          isPinned: false,
          pinOrder: null,
          isHidden: false,
          createdAt: now.toISOString(),
        },
        persisted: false,
      });
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('guestbook_postcards')
      .insert({
        song_title: songTitle,
        artist,
        sender_name: senderName,
        reason,
        date_label: dateLabel,
        pin_color: pinColor,
        is_pinned: false,
        pin_order: null,
        is_hidden: false,
      })
      .select('*')
      .single();

    if (error) {
      console.error('[POST /api/postcards] Insert error:', error);
      return NextResponse.json(
        { error: 'Gagal menyimpan kartu pos ke papan.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      postcard: mapPostcardRow(data as PostcardRow),
      persisted: true,
    });
  } catch (err) {
    console.error('[POST /api/postcards] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Format permintaan tidak valid.' },
      { status: 400 }
    );
  }
}