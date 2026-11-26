import { NextResponse } from 'next/server';
import {
  DEFAULT_ROOM_CONFIG,
  INITIAL_POSTCARDS,
  INITIAL_VINYLS,
} from '@/data/mockVinyls';
import { extractUniqueGenres, sortPostcardsForBoard } from '@/lib/genreUtils';
import { fetchFullRoomPayload } from '@/lib/supabase/mappers';
import {
  createSupabaseServerClient,
  isSupabaseServerConfigured,
} from '@/lib/supabase/server';
import { MAX_PINBOARD_VISIBLE } from '@/types/orihour';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({
      source: 'fallback',
      config: DEFAULT_ROOM_CONFIG,
      vinyls: INITIAL_VINYLS,
      postcards: sortPostcardsForBoard(INITIAL_POSTCARDS).slice(0, MAX_PINBOARD_VISIBLE),
      genres: extractUniqueGenres(INITIAL_VINYLS).map((name, i) => ({
        id: `fallback-${i}`,
        name,
      })),
    });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const payload = await fetchFullRoomPayload(supabase, false);
    return NextResponse.json({
      source: 'supabase',
      ...payload,
    });
  } catch (err) {
    console.error('[GET /api/room-data] Falling back to local defaults:', err);
    return NextResponse.json({
      source: 'fallback',
      config: DEFAULT_ROOM_CONFIG,
      vinyls: INITIAL_VINYLS,
      postcards: sortPostcardsForBoard(INITIAL_POSTCARDS).slice(0, MAX_PINBOARD_VISIBLE),
      genres: extractUniqueGenres(INITIAL_VINYLS).map((name, i) => ({
        id: `fallback-${i}`,
        name,
      })),
    });
  }
}