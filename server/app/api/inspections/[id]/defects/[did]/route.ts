import { api } from '@/lib/api';
import { requireRole, INSPECT } from '@/lib/auth';
import { removeDefect } from '@/lib/services/inspections';
export const DELETE = api(async (_r, { params }) => { const s = await requireRole(...INSPECT); return removeDefect(s.orgId, Number(params.id), Number(params.did)); });
