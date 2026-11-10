import { NextResponse } from 'next/server';
import { COOKIE } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST() {
  const r = NextResponse.json({ ok: true, message: 'Logged out successfully' });
  
  // Clear the session cookie immediately across all paths and subdomains
  r.cookies.set(COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(0),
    maxAge: 0,
  });

  return r;
}

export async function GET(req: Request) {
  // Allow GET logout redirect for standard browser links if needed
  const url = new URL('/login', req.url);
  const r = NextResponse.redirect(url);
  r.cookies.set(COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(0),
    maxAge: 0,
  });
  return r;
}


