import { api } from '@/lib/api';
import { requireRole } from '@/lib/auth';
import { spc } from '@/lib/services/spc';
export const dynamic = 'force-dynamic';
export const GET = api(async (req, { params }) => { const s = await requireRole(); const q = new URL(req.url).searchParams;
  return spc(s.orgId, Number(params.id), q.get('from') ?? undefined, q.get('to') ?? undefined); });
