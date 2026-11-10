import { api } from '@/lib/api';
import { requireRole } from '@/lib/auth';
import { query } from '@/lib/db';
export const dynamic = 'force-dynamic';
export const GET = api(async () => { const s = await requireRole();
  const [products, suppliers, defects, instruments, lines, users, workOrders] = await Promise.all([
    query(`SELECT id, code, name FROM products WHERE org_id=$1 AND active ORDER BY code`, [s.orgId]),
    query(`SELECT id, code, name, approval FROM suppliers WHERE org_id=$1 ORDER BY name`, [s.orgId]),
    query(`SELECT id, code, name, severity, category FROM defect_codes WHERE org_id=$1 AND active ORDER BY code`, [s.orgId]),
    query(`SELECT id, code, name, type, cal_status, next_due FROM v_instrument_status WHERE org_id=$1 ORDER BY code`, [s.orgId]),
    query(`SELECT l.id, l.code, l.name FROM production_lines l JOIN plants p ON p.id=l.plant_id WHERE p.org_id=$1 ORDER BY l.code`, [s.orgId]),
    query(`SELECT u.id, u.name, m.role FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.org_id=$1 ORDER BY u.name`, [s.orgId]),
    query(`SELECT id, wo_no, product_id FROM work_orders WHERE org_id=$1 AND status <> 'CLOSED' ORDER BY id DESC`, [s.orgId]),
  ]);
  return { products, suppliers, defects, instruments, lines, users, work_orders: workOrders }; });
