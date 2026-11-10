import { NextResponse } from 'next/server';
import { z } from 'zod';
import { api } from '@/lib/api';
import { requireRole, HttpError } from '@/lib/auth';
import { one } from '@/lib/db';
import { COOKIE, signSession } from '@/lib/session';
export const POST = api(async req => {
  const s = await requireRole(); const { org_id } = z.object({ org_id: z.coerce.number() }).parse(await req.json());
  const m = await one(`SELECT role FROM memberships WHERE org_id=$1 AND user_id=$2`, [org_id, s.uid]);
  if (!m) throw new HttpError(403, 'No access'); await one(`UPDATE users SET last_org_id=$1 WHERE id=$2`, [org_id, s.uid]);
  const token = await signSession({ ...s, orgId: org_id, role: m.role });
  const res = NextResponse.json({ token, role: m.role });
  res.cookies.set(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 30 * 86400 });
  return res;
});
