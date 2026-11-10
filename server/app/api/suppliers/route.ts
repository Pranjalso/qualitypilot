import { api } from '@/lib/api';
import { requireRole, MANAGE } from '@/lib/auth';
import { suppliers } from '@/lib/crud';
import { supplierSchema } from '@/lib/validators';
export const dynamic = 'force-dynamic';
export const GET = api(async () => { const s = await requireRole(); return suppliers.list(s.orgId); });
export const POST = api(async req => { const s = await requireRole(...MANAGE); return suppliers.create(s.orgId, supplierSchema.parse(await req.json())); });
