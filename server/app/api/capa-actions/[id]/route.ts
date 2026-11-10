import { api } from '@/lib/api';
import { requireRole, OPERATE } from '@/lib/auth';
import { actionUpdateSchema } from '@/lib/validators';
import { updateAction } from '@/lib/services/capa';
export const PUT = api(async (req, { params }) => { const s = await requireRole(...OPERATE); return updateAction(s, Number(params.id), actionUpdateSchema.parse(await req.json())); });
