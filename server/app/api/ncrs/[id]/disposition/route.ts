import { api } from '@/lib/api';
import { requireRole, MANAGE } from '@/lib/auth';
import { dispositionSchema } from '@/lib/validators';
import { disposition } from '@/lib/services/ncr';
export const POST = api(async (req, { params }) => { const s = await requireRole(...MANAGE); return disposition(s, Number(params.id), dispositionSchema.parse(await req.json())); });
