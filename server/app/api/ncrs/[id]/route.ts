import { api } from '@/lib/api';
import { requireRole } from '@/lib/auth';
import { getNcr } from '@/lib/services/ncr';
export const GET = api(async (_r, { params }) => { const s = await requireRole(); return getNcr(s.orgId, Number(params.id)); });
