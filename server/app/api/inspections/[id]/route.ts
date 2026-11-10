import { api } from '@/lib/api';
import { requireRole } from '@/lib/auth';
import { getInspection } from '@/lib/services/inspections';
export const GET = api(async (_r, { params }) => { const s = await requireRole(); return getInspection(s.orgId, Number(params.id)); });
