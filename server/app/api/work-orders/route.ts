import { api } from '@/lib/api';
import { requireRole, MANAGE } from '@/lib/auth';
import { workOrders } from '@/lib/crud';
import { workOrderSchema } from '@/lib/validators';
export const dynamic = 'force-dynamic';
export const GET = api(async () => { const s = await requireRole(); return workOrders.list(s.orgId); });
export const POST = api(async req => { const s = await requireRole('ADMIN','QA_MANAGER','PRODUCTION'); return workOrders.create(s.orgId, workOrderSchema.parse(await req.json())); });
