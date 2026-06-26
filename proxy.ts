import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Next.js 16+: middleware.ts is renamed to proxy.ts
// The exported function must also be named `proxy` (not `middleware`)
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Apply cookie options (httpOnly, secure, sameSite, etc.) correctly
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

  // IMPORTANT: Must call getUser() (server-verified) NOT getSession() (client-only, spoofable)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protected routes
  const protectedRoutes = ['/dashboard', '/settings', '/calendar', '/influencers', '/admin'];
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
  if (user && (isAuth || request.nextUrl.pathname === '/')) {
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
