import { api } from '@/lib/api';
import { requireRole, MANAGE } from '@/lib/auth';
import { actionSchema } from '@/lib/validators';
import { addAction } from '@/lib/services/capa';
export const POST = api(async (req, { params }) => { const s = await requireRole(...MANAGE); return addAction(s, Number(params.id), actionSchema.parse(await req.json())); });
