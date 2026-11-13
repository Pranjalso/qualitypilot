import { query, one, tx } from '../db';
import { HttpError, Session } from '../auth';

export const listNcrs = (org: number, status?: string) => query(
  `SELECT n.id, n.ncr_no, n.source, n.title, n.severity, n.status, n.disposition, n.qty_affected, n.cost_of_poor_quality, n.raised_at, n.capa_id,
          l.lot_no, p.code AS product_code, s.name AS supplier, n.customer, u.name AS raised_by_name, c.capa_no,
          (CURRENT_DATE - n.raised_at::date) AS age_days
     FROM ncrs n LEFT JOIN lots l ON l.id=n.lot_id LEFT JOIN products p ON p.id=n.product_id LEFT JOIN suppliers s ON s.id=n.supplier_id
     LEFT JOIN users u ON u.id=n.raised_by LEFT JOIN capas c ON c.id=n.capa_id
    WHERE n.org_id=$1 AND ($2::text IS NULL OR ($2='OPEN' AND n.status NOT IN ('CLOSED','CANCELLED')) OR n.status::text=$2)
    ORDER BY CASE WHEN n.status IN ('CLOSED','CANCELLED') THEN 1 ELSE 0 END, n.id DESC LIMIT 400`, [org, status ?? null]);

export async function getNcr(org: number, id: number) {
  const n = await one(`SELECT n.*, l.lot_no, l.quantity AS lot_qty, l.status AS lot_status, p.code AS product_code, p.name AS product_name, s.name AS supplier,
                              i.insp_no, u.name AS raised_by_name, d.name AS disposed_by_name, cl.name AS closed_by_name, c.capa_no, c.status AS capa_status
                         FROM ncrs n LEFT JOIN lots l ON l.id=n.lot_id LEFT JOIN products p ON p.id=n.product_id LEFT JOIN suppliers s ON s.id=n.supplier_id
                         LEFT JOIN inspections i ON i.id=n.inspection_id LEFT JOIN users u ON u.id=n.raised_by LEFT JOIN users d ON d.id=n.disposed_by
                         LEFT JOIN users cl ON cl.id=n.closed_by LEFT JOIN capas c ON c.id=n.capa_id WHERE n.org_id=$1 AND n.id=$2`, [org, id]);
  if (!n) throw new HttpError(404, 'NCR not found');
  const defects = n.inspection_id ? await query(`SELECT d.quantity, d.remarks, d.photo_url, dc.code, dc.name FROM inspection_defects d JOIN defect_codes dc ON dc.id=d.defect_code_id WHERE inspection_id=$1`, [n.inspection_id]) : [];
  return { ...n, defects };
}

export async function createNcr(s: Session, d: any) {
  if (d.lot_id) {
    const l = await one(`SELECT * FROM lots WHERE id=$1 AND org_id=$2`, [d.lot_id, s.orgId]);
    if (!l) throw new HttpError(422, 'Unknown lot');
    d.product_id ??= l.product_id; d.supplier_id ??= l.supplier_id;
    if (['ACCEPTED', 'PENDING', 'IN_INSPECTION'].includes(l.status)) await one(`UPDATE lots SET status='ON_HOLD' WHERE id=$1`, [l.id]);   // quarantine
  }
  if (d.source === 'CUSTOMER_COMPLAINT' && !d.customer) throw new HttpError(400, 'Customer name is required for a complaint');
  return one(`INSERT INTO ncrs(org_id,ncr_no,source,lot_id,product_id,supplier_id,customer,title,description,qty_affected,severity,photo_url,raised_by)
              VALUES ($1,next_no($1,'NCR'),$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [s.orgId, d.source, d.lot_id, d.product_id, d.supplier_id, d.customer, d.title, d.description, d.qty_affected, d.severity, d.photo_url ?? null, s.uid]);
}

export async function reviewNcr(s: Session, id: number) {
  const r = await one(`UPDATE ncrs SET status='UNDER_REVIEW' WHERE id=$1 AND org_id=$2 AND status='OPEN' RETURNING *`, [id, s.orgId]);
  if (!r) throw new HttpError(422, 'Only OPEN NCRs can move to review');
  return r;
}

/**
 * Material Review Board decision (QA manager) — updates the lot:
 *  REWORK → lot back to PENDING for re-inspection · SCRAP / RETURN_TO_SUPPLIER → qty rejected
 *  SORT_100 → qty rejected after sorting, balance accepted · USE_AS_IS / REGRADE → accepted under concession
 */
export async function disposition(s: Session, id: number, d: any) {
  return tx(async c => {
    const { rows: [n] } = await c.query(`SELECT * FROM ncrs WHERE id=$1 AND org_id=$2 FOR UPDATE`, [id, s.orgId]);
    if (!n) throw new HttpError(404, 'NCR not found');
    if (!['OPEN', 'UNDER_REVIEW'].includes(n.status)) throw new HttpError(422, `NCR is already ${n.status}`);
    if (n.raised_by === s.uid) throw new HttpError(403, 'Segregation of duties: Disposition must be given by someone other than the person who raised the NCR');
    if (d.disposition === 'RETURN_TO_SUPPLIER' && !n.supplier_id) throw new HttpError(422, 'Return to supplier applies only to supplier material');
    if (d.disposition === 'USE_AS_IS' && n.severity === 'CRITICAL') throw new HttpError(422, 'A CRITICAL non-conformance cannot be used as-is');
    if (n.lot_id) {
      const { rows: [lot] } = await c.query(`SELECT * FROM lots WHERE id=$1 FOR UPDATE`, [n.lot_id]);
      const q = Number(lot.quantity), dq = Number(d.disposition_qty);
      if (dq > q) throw new HttpError(422, `Disposition quantity exceeds lot quantity ${q}`);
      switch (d.disposition) {
        case 'REWORK': await c.query(`UPDATE lots SET status='PENDING' WHERE id=$1`, [lot.id]); break;
        case 'SCRAP': case 'RETURN_TO_SUPPLIER': case 'SORT_100':
          await c.query(`UPDATE lots SET status=$2, rejected_qty=$3, accepted_qty=$4 WHERE id=$1`, [lot.id, dq >= q ? 'REJECTED' : 'CONDITIONAL', dq, q - dq]); break;
        default: await c.query(`UPDATE lots SET status='CONDITIONAL', accepted_qty=quantity, rejected_qty=0 WHERE id=$1`, [lot.id]);
      }
    }
    const { rows: [r] } = await c.query(
      `UPDATE ncrs SET status='DISPOSITIONED', disposition=$2, disposition_qty=$3, disposition_note=$4, cost_of_poor_quality=$5, disposed_by=$6, disposed_at=now()
        WHERE id=$1 RETURNING *`, [id, d.disposition, d.disposition_qty, d.note, d.cost_of_poor_quality, s.uid]);
    return r;
  });
}

/** Close: CRITICAL NCRs, and repeats (3+ NCRs on same product in 90 days), must have a CAPA */
export async function closeNcr(s: Session, id: number) {
  return tx(async c => {
    const { rows: [n] } = await c.query(`SELECT * FROM ncrs WHERE id=$1 AND org_id=$2 FOR UPDATE`, [id, s.orgId]);
    if (!n) throw new HttpError(404, 'NCR not found');
    if (n.status !== 'DISPOSITIONED') throw new HttpError(422, 'Give a disposition before closing');
    const { rows: [rep] } = await c.query(`SELECT COUNT(*)::int k FROM ncrs WHERE product_id=$1 AND raised_at > now() - interval '90 days'`, [n.product_id]);
    if (!n.capa_id && (n.severity === 'CRITICAL' || rep.k >= 3))
      throw new HttpError(422, n.severity === 'CRITICAL' ? 'CRITICAL NCRs need a CAPA before closure' : `Repeat issue (${rep.k} NCRs on this product in 90 days) — link a CAPA before closure`);
    const { rows: [r] } = await c.query(`UPDATE ncrs SET status='CLOSED', closed_by=$2, closed_at=now() WHERE id=$1 RETURNING *`, [id, s.uid]);
    return r;
  });
}
export async function cancelNcr(s: Session, id: number) {
  const r = await one(`UPDATE ncrs SET status='CANCELLED', closed_by=$3, closed_at=now() WHERE id=$1 AND org_id=$2 AND status IN ('OPEN','UNDER_REVIEW') RETURNING *`, [id, s.orgId, s.uid]);
  if (!r) throw new HttpError(422, 'Only open NCRs without a disposition can be cancelled');
  return r;
}
