import { api } from '@/lib/api';
import { requireRole, INSPECT } from '@/lib/auth';
import { resultsSchema } from '@/lib/validators';
import { saveResults } from '@/lib/services/inspections';
export const PUT = api(async (req, { params }) => { const s = await requireRole(...INSPECT); return saveResults(s.orgId, Number(params.id), resultsSchema.parse(await req.json()).results); });
