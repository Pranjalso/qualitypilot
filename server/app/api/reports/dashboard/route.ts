import { api } from '@/lib/api';
import { requireRole } from '@/lib/auth';
import { dashboard } from '@/lib/services/reports';
export const dynamic = 'force-dynamic';
export const GET = api(async () => { const s = await requireRole(); return dashboard(s.orgId); });
