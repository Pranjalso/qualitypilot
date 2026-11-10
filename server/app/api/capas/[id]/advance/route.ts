import { api } from '@/lib/api';
import { requireRole, OPERATE } from '@/lib/auth';
import { advanceCapa } from '@/lib/services/capa';
export const POST = api(async (_r, { params }) => { const s = await requireRole(...OPERATE); return advanceCapa(s, Number(params.id)); });
