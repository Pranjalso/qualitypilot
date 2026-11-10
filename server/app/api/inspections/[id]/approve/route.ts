import { api } from '@/lib/api';
import { requireRole, MANAGE } from '@/lib/auth';
import { approveInspection } from '@/lib/services/inspections';
export const POST = api(async (_r, { params }) => { const s = await requireRole(...MANAGE); return approveInspection(s, Number(params.id)); });
