import { api } from '@/lib/api';
import { requireRole } from '@/lib/auth';
import { iso2859LevelII } from '@/lib/sampling';
export const dynamic = 'force-dynamic';
export const GET = api(async req => { await requireRole(); return iso2859LevelII(Number(new URL(req.url).searchParams.get('lot') ?? 0)); });
