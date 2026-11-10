import { api } from '@/lib/api';
import { requireRole, MANAGE } from '@/lib/auth';
import { capaSchema } from '@/lib/validators';
import { createCapa, listCapas } from '@/lib/services/capa';
export const dynamic = 'force-dynamic';
export const GET = api(async req => { const s = await requireRole(); return listCapas(s.orgId, new URL(req.url).searchParams.get('status') ?? undefined); });
export const POST = api(async req => { const s = await requireRole(...MANAGE); return createCapa(s, capaSchema.parse(await req.json())); });
