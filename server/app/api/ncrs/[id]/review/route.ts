import { api } from '@/lib/api';
import { requireRole, MANAGE } from '@/lib/auth';
import { reviewNcr } from '@/lib/services/ncr';
export const POST = api(async (_r, { params }) => { const s = await requireRole(...MANAGE); return reviewNcr(s, Number(params.id)); });
