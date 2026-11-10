import { api } from '@/lib/api';
import { requireRole, HttpError } from '@/lib/auth';
import { one, query } from '@/lib/db';
export const GET = api(async (_r, { params }) => { const s = await requireRole();
  const l = await one(`SELECT l.*, p.code AS product_code, p.name AS product_name, s.name AS supplier, pl.code AS line FROM lots l JOIN products p ON p.id=l.product_id
                        LEFT JOIN suppliers s ON s.id=l.supplier_id LEFT JOIN production_lines pl ON pl.id=l.line_id WHERE l.org_id=$1 AND l.id=$2`, [s.orgId, Number(params.id)]);
  if (!l) throw new HttpError(404, 'Lot not found');
  const inspections = await query(`SELECT i.id, i.insp_no, i.status, i.result, i.sample_size, i.defective_units, i.submitted_at, i.is_reinspection, u.name AS inspector FROM inspections i LEFT JOIN users u ON u.id=i.inspector_id WHERE lot_id=$1 ORDER BY id`, [l.id]);
  const ncrs = await query(`SELECT id, ncr_no, status, disposition, severity FROM ncrs WHERE lot_id=$1 ORDER BY id`, [l.id]);
  return { ...l, inspections, ncrs }; });
