import { api } from '@/lib/api';
import { requireRole, MANAGE } from '@/lib/auth';
import { capaUpdateSchema } from '@/lib/validators';
import { getCapa, updateCapa } from '@/lib/services/capa';
export const GET = api(async (_r, { params }) => { const s = await requireRole(); return getCapa(s.orgId, Number(params.id)); });
export const PUT = api(async (req, { params }) => { const s = await requireRole(...MANAGE); return updateCapa(s, Number(params.id), capaUpdateSchema.parse(await req.json())); });
