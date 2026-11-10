import { api } from '@/lib/api';
import { requireRole, MANAGE } from '@/lib/auth';
import { query, one } from '@/lib/db';
import { lineSchema } from '@/lib/validators';
export const dynamic = 'force-dynamic';
export const GET = api(async () => { const s = await requireRole(); return query(`SELECT l.*, p.code AS plant FROM production_lines l JOIN plants p ON p.id=l.plant_id WHERE p.org_id=$1 ORDER BY l.code`, [s.orgId]); });
export const POST = api(async req => { const s = await requireRole(...MANAGE); const d = lineSchema.parse(await req.json());
  return one(`INSERT INTO production_lines(plant_id,code,name) SELECT id,$2,$3 FROM plants WHERE id=$1 AND org_id=$4 RETURNING *`, [d.plant_id, d.code, d.name, s.orgId]); });
