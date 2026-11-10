import { requirePage } from '@/lib/auth';
import { listLots } from '@/lib/services/inspections';
import { query } from '@/lib/db';
import LotsClient from './LotsClient';

export const dynamic = 'force-dynamic';

export default async function LotsPage() {
  const s = await requirePage();

  const [initialLots, products, suppliers, lines, workOrders] = await Promise.all([
    listLots(s.orgId, {}),
    query(`SELECT id, code, name FROM products WHERE org_id=$1 AND active ORDER BY code`, [s.orgId]),
    query(`SELECT id, code, name, approval FROM suppliers WHERE org_id=$1 ORDER BY name`, [s.orgId]),
    query(`SELECT l.id, l.code, l.name FROM production_lines l JOIN plants p ON p.id=l.plant_id WHERE p.org_id=$1 ORDER BY l.code`, [s.orgId]),
    query(`SELECT id, wo_no, product_id FROM work_orders WHERE org_id=$1 AND status <> 'CLOSED' ORDER BY id DESC`, [s.orgId]),
  ]);

  const initialLookups = {
    products,
    suppliers,
    lines,
    work_orders: workOrders,
  };

  const initialUser = {
    id: s.uid,
    name: s.name,
    role: s.role,
  };

  return (
    <LotsClient
      initialLots={initialLots}
      initialLookups={initialLookups}
      initialUser={initialUser}
    />
  );
}
