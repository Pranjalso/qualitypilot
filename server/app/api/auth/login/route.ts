import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { one, query } from '@/lib/db';
import { COOKIE, signSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const p = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
  const u = await one(`SELECT * FROM users WHERE lower(email)=lower($1) AND active`, [p.data.email]);
  if (!u || !(await bcrypt.compare(p.data.password, u.password_hash))) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  const orgs = await query(`SELECT o.id, o.name, m.role FROM memberships m JOIN organizations o ON o.id=m.org_id WHERE m.user_id=$1 ORDER BY o.name`, [u.id]);
  if (!orgs.length) return NextResponse.json({ error: 'No organisation access' }, { status: 403 });
  const o = orgs.find(x => x.id === u.last_org_id) ?? orgs[0];
  const token = await signSession({ uid: u.id, name: u.name, email: u.email, orgId: o.id, role: o.role });
  const res = NextResponse.json({ token, user: { id: u.id, name: u.name, email: u.email }, org: o, orgs });
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false, // allow standard HTTP during localhost testing
    path: '/',
    maxAge: 30 * 86400,
  });
  return res;
}
