import { api } from '@/lib/api';
import { requireRole, MANAGE } from '@/lib/auth';
import { advanceCapa } from '@/lib/services/capa';
export const POST = api(async (_r, { params }) => { const s = await requireRole(...MANAGE); return advanceCapa(s, Number(params.id)); });
