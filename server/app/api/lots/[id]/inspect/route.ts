import { api } from '@/lib/api';
import { requireRole, INSPECT } from '@/lib/auth';
import { startInspection } from '@/lib/services/inspections';
export const POST = api(async (_r, { params }) => { const s = await requireRole(...INSPECT); return startInspection(s.orgId, s.uid, Number(params.id)); });
