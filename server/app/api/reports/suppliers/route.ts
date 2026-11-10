import { api } from '@/lib/api';
import { requireRole } from '@/lib/auth';
import { query } from '@/lib/db';
export const dynamic = 'force-dynamic';
export const GET = api(async () => { const s = await requireRole(); return query(`SELECT * FROM v_supplier_quality WHERE org_id=$1 ORDER BY ppm DESC, name`, [s.orgId]); });
