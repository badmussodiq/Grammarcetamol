import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password'];
const STAFF_ROLES = ['SUPER_ADMIN', 'MODERATOR', 'CUSTOMER_SUPPORT'];

/**
 * Not a cryptographic check — this only reads the JWT payload, it doesn't verify
 * the RS256 signature (that needs a library the Edge runtime doesn't cheaply
 * support here). The actual security boundary is the backend's @PreAuthorize
 * checks on every admin endpoint. This is a UX guard so a student's cookie
 * bounces to /login instead of loading a broken, permission-less admin shell.
 */
function rolesFromToken(token: string): string[] {
  try {
    const payload = token.split('.')[1];
    let base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const json = JSON.parse(atob(base64));
    return Array.isArray(json.roles) ? json.roles : [];
  } catch {
    return [];
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (isPublic) return NextResponse.next();

  const token = request.cookies.get('access_token')?.value;
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const roles = rolesFromToken(token);
  const isStaff = roles.some((r) => STAFF_ROLES.includes(r));
  if (!isStaff) {
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('access_token');
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
