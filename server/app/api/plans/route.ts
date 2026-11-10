import { api } from '@/lib/api';
import { requireRole, MANAGE } from '@/lib/auth';
import { planSchema } from '@/lib/validators';
import { listPlans, savePlan } from '@/lib/services/plans';
export const dynamic = 'force-dynamic';
export const GET = api(async () => { const s = await requireRole(); return listPlans(s.orgId); });
export const POST = api(async req => { const s = await requireRole(...MANAGE); return savePlan(s.orgId, s.uid, planSchema.parse(await req.json())); });
