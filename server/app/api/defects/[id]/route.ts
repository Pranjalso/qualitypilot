import { api } from '@/lib/api';
import { requireRole, MANAGE } from '@/lib/auth';
import { defects } from '@/lib/crud';
import { defectSchema } from '@/lib/validators';
export const PUT = api(async (req, { params }) => { const s = await requireRole(...MANAGE); return defects.update(s.orgId, Number(params.id), defectSchema.partial().parse(await req.json())); });
