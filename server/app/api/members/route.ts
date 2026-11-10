import bcrypt from 'bcryptjs';
import { api } from '@/lib/api';
import { requireRole, HttpError } from '@/lib/auth';
import { query, tx } from '@/lib/db';
import { memberSchema } from '@/lib/validators';
export const dynamic = 'force-dynamic';
export const GET = api(async () => { const s = await requireRole();
  return query(`SELECT u.id, u.name, u.email, u.employee_code, m.role FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.org_id=$1 ORDER BY m.role, u.name`, [s.orgId]); });
export const POST = api(async req => { const s = await requireRole('ADMIN'); const d = memberSchema.parse(await req.json());
  return tx(async c => { let { rows: [u] } = await c.query(`SELECT id FROM users WHERE lower(email)=lower($1)`, [d.email]);
    if (!u) { if (!d.name || !d.password) throw new HttpError(400, 'New user needs a name and password (8+ chars)');
      ({ rows: [u] } = await c.query(`INSERT INTO users(name,email,password_hash,last_org_id) VALUES ($1,lower($2),$3,$4) RETURNING id`, [d.name, d.email, await bcrypt.hash(d.password, 10), s.orgId])); }
    await c.query(`INSERT INTO memberships VALUES ($1,$2,$3) ON CONFLICT (org_id,user_id) DO UPDATE SET role=EXCLUDED.role`, [s.orgId, u.id, d.role]); return { ok: true }; }); });
