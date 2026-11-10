import { api } from '@/lib/api';
import { requireRole } from '@/lib/auth';
import { listInspections } from '@/lib/services/inspections';
export const dynamic = 'force-dynamic';
export const GET = api(async req => { const s = await requireRole(); const q = new URL(req.url).searchParams;
  return listInspections(s.orgId, { from: q.get('from') ?? undefined, to: q.get('to') ?? undefined, stage: q.get('stage') ?? undefined, result: q.get('result') ?? undefined }); });
