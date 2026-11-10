import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE, Role, Session, tokenFrom, verifySession } from './session';
import { one, query } from './db';
export type { Session } from './session';

export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
export async function getSession(): Promise<Session | null> {
  const s = await verifySession(tokenFrom(headers().get('authorization'), cookies().get(COOKIE)?.value));
  if (!s) return null;
  const m = await one(`SELECT m.role FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.org_id=$1 AND m.user_id=$2 AND u.active`, [s.orgId, s.uid]);
  return m ? { ...s, role: m.role } : null;
}
export async function requirePage() { const s = await getSession(); if (!s) redirect('/login'); return s; }
export async function requireRole(...roles: Role[]): Promise<Session> {
  const s = await getSession();
  if (!s) throw new HttpError(401, 'Not authenticated');
  if (roles.length && !roles.includes(s.role)) throw new HttpError(403, 'Your role cannot do this');
  return s;
}
export const MANAGE: Role[] = ['ADMIN', 'QA_MANAGER'];                       // masters, plans, approvals, dispositions
export const INSPECT: Role[] = ['ADMIN', 'QA_MANAGER', 'INSPECTOR'];          // perform inspections, raise NCR
export const OPERATE: Role[] = ['ADMIN', 'QA_MANAGER', 'INSPECTOR', 'PRODUCTION']; // create lots, work CAPA actions
export async function audit(org: number, user: number | null, action: string, entity: string, id: unknown, detail?: unknown) {
  await query(`INSERT INTO audit_log(org_id,user_id,action,entity,entity_id,detail) VALUES ($1,$2,$3,$4,$5,$6)`, [org, user, action, entity, String(id ?? ''), detail ? JSON.stringify(detail) : null]);
}
