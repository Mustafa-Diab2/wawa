import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/signup'];
  const isPublicRoute = publicRoutes.some(route => req.nextUrl.pathname.startsWith(route));

  // Get session token from cookies
  const sessionToken = req.cookies.get('sb-access-token') || req.cookies.get('sb-refresh-token');

  // If no session token and trying to access protected route
  if (!sessionToken && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // If has session token and trying to access login/signup
  if (sessionToken && isPublicRoute) {
    return NextResponse.redirect(new URL('/chat', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|api).*)',
  ],
};
