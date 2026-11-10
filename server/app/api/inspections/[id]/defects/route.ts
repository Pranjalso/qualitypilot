import { api } from '@/lib/api';
import { requireRole, INSPECT } from '@/lib/auth';
import { defectEntrySchema } from '@/lib/validators';
import { addDefect } from '@/lib/services/inspections';
export const POST = api(async (req, { params }) => { const s = await requireRole(...INSPECT); return addDefect(s.orgId, Number(params.id), defectEntrySchema.parse(await req.json())); });
