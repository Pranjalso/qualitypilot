import { api } from '@/lib/api';
import { requireRole, MANAGE } from '@/lib/auth';
import { instruments } from '@/lib/crud';
import { instrumentSchema } from '@/lib/validators';
export const PUT = api(async (req, { params }) => { const s = await requireRole(...MANAGE); return instruments.update(s.orgId, Number(params.id), instrumentSchema.partial().parse(await req.json())); });
