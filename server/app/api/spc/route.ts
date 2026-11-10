import { api } from '@/lib/api';
import { requireRole } from '@/lib/auth';
import { spcCharacteristics } from '@/lib/services/spc';
export const dynamic = 'force-dynamic';
export const GET = api(async () => { const s = await requireRole(); return spcCharacteristics(s.orgId); });
