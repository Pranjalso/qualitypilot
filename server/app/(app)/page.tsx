import { requirePage } from '@/lib/auth';
import { dashboard } from '@/lib/services/reports';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const s = await requirePage();
  const initialData = await dashboard(s.orgId);
  return <DashboardClient initialData={initialData} />;
}
