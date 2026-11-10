import { api } from '@/lib/api';
import { requireRole } from '@/lib/auth';
import { getPlan } from '@/lib/services/plans';
export const GET = api(async (_r, { params }) => { const s = await requireRole(); return getPlan(s.orgId, Number(params.id)); });
