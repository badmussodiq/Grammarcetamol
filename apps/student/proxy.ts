import type {NextRequest} from 'next/server';
import {NextResponse} from 'next/server';

const PROTECTED_PATHS = ['/dashboard', '/my-courses', '/profile', '/checkout', '/notifications', '/settings', '/transactions'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));

  if (!isProtected) return NextResponse.next();

  const hasSession = request.cookies.has('access_token');
  if (!hasSession) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('returnUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/my-courses/:path*',
    '/profile/:path*',
    '/checkout/:path*',
    '/notifications/:path*',
    '/settings/:path*',
    '/transactions/:path*',
  ],
};
