import { api } from '@/lib/api';
import { requireRole, OPERATE } from '@/lib/auth';
import { ncrSchema } from '@/lib/validators';
import { createNcr, listNcrs } from '@/lib/services/ncr';
export const dynamic = 'force-dynamic';
export const GET = api(async req => { const s = await requireRole(); return listNcrs(s.orgId, new URL(req.url).searchParams.get('status') ?? undefined); });
export const POST = api(async req => { const s = await requireRole(...OPERATE); return createNcr(s, ncrSchema.parse(await req.json())); });
