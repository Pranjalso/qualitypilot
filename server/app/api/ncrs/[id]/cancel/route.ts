import { api } from '@/lib/api';
import { requireRole, MANAGE } from '@/lib/auth';
import { cancelNcr } from '@/lib/services/ncr';
export const POST = api(async (_r, { params }) => { const s = await requireRole(...MANAGE); return cancelNcr(s, Number(params.id)); });
