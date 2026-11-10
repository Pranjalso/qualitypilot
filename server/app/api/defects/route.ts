import { api } from '@/lib/api';
import { requireRole, MANAGE } from '@/lib/auth';
import { defects } from '@/lib/crud';
import { defectSchema } from '@/lib/validators';
export const dynamic = 'force-dynamic';
export const GET = api(async () => { const s = await requireRole(); return defects.list(s.orgId); });
export const POST = api(async req => { const s = await requireRole(...MANAGE); return defects.create(s.orgId, defectSchema.parse(await req.json())); });
