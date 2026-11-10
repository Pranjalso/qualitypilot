import { api } from '@/lib/api';
import { requireRole, MANAGE } from '@/lib/auth';
import { workOrders } from '@/lib/crud';
import { workOrderSchema } from '@/lib/validators';
export const PUT = api(async (req, { params }) => { const s = await requireRole(...MANAGE); return workOrders.update(s.orgId, Number(params.id), workOrderSchema.partial().parse(await req.json())); });
