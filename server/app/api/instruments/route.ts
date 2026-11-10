import { api } from '@/lib/api';
import { requireRole, MANAGE } from '@/lib/auth';
import { query } from '@/lib/db';
import { instruments } from '@/lib/crud';
import { instrumentSchema } from '@/lib/validators';
export const dynamic = 'force-dynamic';
/** Instruments with live calibration status (OK · DUE_SOON · OVERDUE · OUT_OF_SERVICE) */
export const GET = api(async () => { const s = await requireRole(); return query(`SELECT * FROM v_instrument_status WHERE org_id=$1 ORDER BY CASE cal_status WHEN 'OVERDUE' THEN 0 WHEN 'OUT_OF_SERVICE' THEN 1 WHEN 'DUE_SOON' THEN 2 ELSE 3 END, code`, [s.orgId]); });
export const POST = api(async req => { const s = await requireRole(...MANAGE); return instruments.create(s.orgId, instrumentSchema.parse(await req.json())); });
