import { api } from '@/lib/api';
import { requireRole, MANAGE } from '@/lib/auth';
import { suppliers } from '@/lib/crud';
import { supplierSchema } from '@/lib/validators';
export const PUT = api(async (req, { params }) => { const s = await requireRole(...MANAGE); return suppliers.update(s.orgId, Number(params.id), supplierSchema.partial().parse(await req.json())); });
