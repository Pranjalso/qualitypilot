import { api } from '@/lib/api';
import { requireRole } from '@/lib/auth';
import { myActions } from '@/lib/services/capa';
export const dynamic = 'force-dynamic';
export const GET = api(async () => { const s = await requireRole(); return myActions(s.orgId, s.uid); });
