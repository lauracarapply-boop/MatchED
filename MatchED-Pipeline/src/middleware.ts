import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow the admin login page without auth
  if (pathname === '/admin/login') {
    return NextResponse.next();
  }

  // Protect admin routes
  if (pathname.startsWith('/admin')) {
    // For MVP, we'll use a simple header or cookie check
    const authHeader = request.headers.get('authorization');
    const adminToken = request.cookies.get('admin_token')?.value;
    const adminSecret = process.env.ADMIN_SECRET;

    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : adminToken;

    if (!token || !adminSecret || token !== adminSecret) {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
  ],
};