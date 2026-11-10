import { api } from '@/lib/api';
import { requireRole, MANAGE } from '@/lib/auth';
import { products } from '@/lib/crud';
import { productSchema } from '@/lib/validators';
export const dynamic = 'force-dynamic';
export const GET = api(async () => { const s = await requireRole(); return products.list(s.orgId); });
export const POST = api(async req => { const s = await requireRole(...MANAGE); return products.create(s.orgId, productSchema.parse(await req.json())); });
