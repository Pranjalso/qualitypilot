import { z } from 'zod';
import { api } from '@/lib/api';
import { requireRole, INSPECT } from '@/lib/auth';
import { submitInspection } from '@/lib/services/inspections';
export const POST = api(async (req, { params }) => { const s = await requireRole(...INSPECT);
  const d = z.object({ remarks: z.string().optional().nullable() }).parse(await req.json().catch(() => ({}))); return submitInspection(s, Number(params.id), d.remarks ?? null); });
