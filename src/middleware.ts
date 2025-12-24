import { NextResponse, type NextRequest } from 'next/server';

// Allowlist of paths that remain accessible
const allowedPrefixes = [
  '/waitlist',
  '/api/otp',
  '/_next',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.json',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow if the path matches any allowed prefix
  const isAllowed = allowedPrefixes.some((prefix) => pathname.startsWith(prefix));

  if (isAllowed) {
    return NextResponse.next();
  }

  // Block all other API routes with 403
  if (pathname.startsWith('/api')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Redirect all other paths to /waitlist
  const url = request.nextUrl.clone();
  url.pathname = '/waitlist';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
