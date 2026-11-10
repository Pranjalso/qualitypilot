import { NextRequest, NextResponse } from 'next/server';
import { COOKIE, tokenFrom, verifySession } from '@/lib/session';

// Public endpoints and assets that do not require authentication
const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/register',
  '/favicon.ico',
];

function cors(req: NextRequest, res: NextResponse) {
  const origin = req.headers.get('origin');
  const allowed = (process.env.CORS_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean);
  if (origin && allowed.includes(origin)) {
    res.headers.set('Access-Control-Allow-Origin', origin);
    res.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.headers.set('Vary', 'Origin');
  }
  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Handle CORS preflight for API requests
  if (req.method === 'OPTIONS' && pathname.startsWith('/api/')) {
    return cors(req, new NextResponse(null, { status: 204 }));
  }

  // Allow static assets, images, and public paths
  const isPublic = PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));

  // Extract session token from either Authorization header or HTTP-only cookie
  const token = tokenFrom(req.headers.get('authorization'), req.cookies.get(COOKIE)?.value);
  const session = await verifySession(token);

  // If user is already authenticated and visits /login, redirect to dashboard or original returnUrl
  if (session && pathname === '/login') {
    const returnUrl = req.nextUrl.searchParams.get('returnUrl');
    const destination = returnUrl && returnUrl.startsWith('/') ? returnUrl : '/';
    return NextResponse.redirect(new URL(destination, req.url));
  }

  // If the path is public, allow access
  if (isPublic) {
    return cors(req, NextResponse.next());
  }

  // Protected route check
  if (!session) {
    // API routes return 401 JSON error
    if (pathname.startsWith('/api/')) {
      return cors(
        req,
        NextResponse.json({ error: 'Not authenticated', code: 'UNAUTHORIZED' }, { status: 401 })
      );
    }

    // Page routes redirect to /login with encoded returnUrl preserving search parameters
    const fullOriginalUrl = pathname + (search || '');
    const loginUrl = new URL('/login', req.url);
    if (pathname !== '/') {
      loginUrl.searchParams.set('returnUrl', fullOriginalUrl);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Set user context headers for downstream request handling
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-user-id', String(session.uid));
  requestHeaders.set('x-org-id', String(session.orgId));
  requestHeaders.set('x-user-role', session.role);

  return cors(
    req,
    NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  );
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

