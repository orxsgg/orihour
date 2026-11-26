import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function isSupabaseServerConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export async function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Supabase server environment variables are not configured.');
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component where setting cookies is ignored
        }
      },
    },
  });
}

/**
 * Verifies the currently logged-in Supabase session belongs to the authorized admin.
 */
export async function requireAdminUser() {
  if (!isSupabaseServerConfigured()) {
    return { supabase: null, user: null, error: 'Supabase is not configured' };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { supabase, user: null, error: 'Unauthorized' };
  }

  const allowedEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (allowedEmail && user.email?.toLowerCase() !== allowedEmail) {
    return { supabase, user: null, error: 'Forbidden: account is not the room admin' };
  }

  return { supabase, user, error: null };
}