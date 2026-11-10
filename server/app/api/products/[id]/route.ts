import { api } from '@/lib/api';
import { requireRole, MANAGE } from '@/lib/auth';
import { products } from '@/lib/crud';
import { productSchema } from '@/lib/validators';
export const PUT = api(async (req, { params }) => { const s = await requireRole(...MANAGE); return products.update(s.orgId, Number(params.id), productSchema.partial().parse(await req.json())); });
