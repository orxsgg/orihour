import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

function applySecurityHeaders(response: NextResponse, isAdminRoute: boolean) {
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  );
  if (isAdminRoute) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    response.headers.set('Cache-Control', 'no-store, max-age=0');
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminRoute = pathname.startsWith('/admin');
  const isAdminApi = pathname.startsWith('/api/admin');

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  applySecurityHeaders(response, isAdminRoute || isAdminApi);

  // Public routes only receive security headers (zero auth overhead)
  if (!isAdminRoute && !isAdminApi) {
    return response;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    if (isAdminApi) {
      return NextResponse.json({ error: 'Server auth not configured' }, { status: 503 });
    }
    if (pathname !== '/admin/login') {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/admin/login';
      return NextResponse.redirect(loginUrl);
    }
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({
          request: { headers: request.headers },
        });
        applySecurityHeaders(response, true);
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // Always verify session token directly with Supabase Auth server
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const allowedEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const isAuthorized =
    Boolean(user) &&
    (!allowedEmail || user?.email?.toLowerCase() === allowedEmail);

  if (isAdminApi) {
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return response;
  }

  if (pathname === '/admin/login') {
    if (isAuthorized) {
      const adminUrl = request.nextUrl.clone();
      adminUrl.pathname = '/admin';
      return NextResponse.redirect(adminUrl);
    }
    return response;
  }

  if (!isAuthorized) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/admin/login';
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};