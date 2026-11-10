import { requireRole } from '@/lib/auth';
import { query } from '@/lib/db';
import SupplierQualityClient from './SupplierQualityClient';

export const dynamic = 'force-dynamic';

export default async function SupplierQualityPage() {
  const s = await requireRole();
  const initialData = await query<any>(
    `SELECT * FROM v_supplier_quality WHERE org_id=$1 ORDER BY ppm DESC, name`,
    [s.orgId]
  );

  return <SupplierQualityClient initialData={initialData} />;
}
