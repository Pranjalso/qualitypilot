import { api } from '@/lib/api';
import { requireRole, OPERATE } from '@/lib/auth';
import { lotSchema } from '@/lib/validators';
import { createLot, listLots } from '@/lib/services/inspections';
export const dynamic = 'force-dynamic';
/** ?status=QUEUE (pending + in inspection) | ACCEPTED | ON_HOLD … &stage=IQC&q= */
export const GET = api(async req => { const s = await requireRole(); const q = new URL(req.url).searchParams;
  return listLots(s.orgId, { status: q.get('status') ?? undefined, stage: q.get('stage') ?? undefined, q: q.get('q') ?? undefined }); });
export const POST = api(async req => { const s = await requireRole(...OPERATE); return createLot(s.orgId, s.uid, lotSchema.parse(await req.json())); });
