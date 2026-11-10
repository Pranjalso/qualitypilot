import { api } from '@/lib/api';
import { requireRole, MANAGE } from '@/lib/auth';
import { approvePlan } from '@/lib/services/plans';
export const POST = api(async (_r, { params }) => { const s = await requireRole(...MANAGE); return approvePlan(s.orgId, s.uid, Number(params.id)); });
