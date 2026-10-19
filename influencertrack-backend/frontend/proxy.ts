import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Next.js 16+: middleware.ts is renamed to proxy.ts
// The exported function must also be named `proxy` (not `middleware`)
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // ── Local Development Only UI Preview Bypass ──
  // CRITICAL SECURITY RULE: Guarded strictly by process.env.NODE_ENV === 'development'
  const isDev = process.env.NODE_ENV === 'development';
  const devPreviewParam = isDev ? request.nextUrl.searchParams.get('dev_preview') : null;
  const hasDevPreviewQuery = devPreviewParam === 'true';
  const hasDevBypassCookie = isDev && request.cookies.get('collabo_dev_bypass')?.value === 'true';
  const hasDevBypassEnv = isDev && process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === 'true';
  const isDevBypass = isDev && (hasDevPreviewQuery || hasDevBypassCookie || hasDevBypassEnv);

  // If query param ?dev_preview=true is present in development, persist via cookie for subsequent navigations
  if (isDev && hasDevPreviewQuery) {
    supabaseResponse.cookies.set('collabo_dev_bypass', 'true', {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      maxAge: 86400, // 24 hours
    });
  } else if (isDev && devPreviewParam === 'false') {
    supabaseResponse.cookies.delete('collabo_dev_bypass');
  }

  let user: { id: string; email?: string; user_metadata?: Record<string, any> } | null = null;

  if (isDevBypass) {
    user = {
      id: 'dev-user',
      email: 'dev@mycollabo.online',
      user_metadata: { full_name: 'Dev Preview User' },
    };
  } else {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    // Check for test session cookie in non-production E2E testing
    const testSessionCookie = request.cookies.get('collabo-test-session');
    if (process.env.NODE_ENV !== 'production' && testSessionCookie) {
      try {
        user = JSON.parse(decodeURIComponent(testSessionCookie.value));
      } catch {
        user = { id: 'test-user-id-001', email: 'test@mycollabo.online' };
      }
    } else {
      // IMPORTANT: Must call getUser() (server-verified) NOT getSession() (client-only, spoofable)
      const { data } = await supabase.auth.getUser();
      user = data?.user ?? null;
    }
  }

  // Protected routes
  const protectedRoutes = ['/dashboard', '/settings', '/calendar', '/influencers', '/billing', '/admin'];
  const isProtected = protectedRoutes.some(route => request.nextUrl.pathname.startsWith(route));

  // Unauthenticated user trying to access protected routes → redirect to login
  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Auth routes
  const authRoutes = ['/login', '/signup', '/forgot-password', '/reset-password'];
  const isAuth = authRoutes.some(route => request.nextUrl.pathname.startsWith(route));

  // Authenticated user visiting auth pages → redirect to dashboard
  if (user && isAuth) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, logo files, and common static assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
