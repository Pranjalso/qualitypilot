import { PoolClient } from 'pg';
import { query, one, tx } from '../db';
import { HttpError, Session } from '../auth';
import { sampleSizeFor, HUNDRED_PERCENT_LIMIT } from '../sampling';

// ---------- lots ----------
export async function createLot(org: number, uid: number, d: any) {
  if (d.supplier_id) {
    const s = await one(`SELECT approval FROM suppliers WHERE id=$1 AND org_id=$2`, [d.supplier_id, org]);
    if (!s) throw new HttpError(422, 'Unknown supplier');
    if (s.approval === 'BLOCKED') throw new HttpError(422, 'Supplier is BLOCKED — material cannot be received');
  }
  return one(`INSERT INTO lots(org_id,lot_no,product_id,source,supplier_id,supplier_invoice,grn_no,work_order_id,line_id,shift,stage,quantity,lot_date,created_by)
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,COALESCE($13::date,CURRENT_DATE),$14) RETURNING *`,
    [org, d.lot_no, d.product_id, d.source, d.supplier_id, d.supplier_invoice, d.grn_no, d.work_order_id, d.line_id, d.shift, d.stage, d.quantity, d.lot_date ?? null, uid]);
}

export const listLots = (org: number, f: { status?: string; stage?: string; q?: string }) => query(
  `SELECT l.*, p.code AS product_code, p.name AS product_name, s.name AS supplier, pl.code AS line,
          (SELECT i.id FROM inspections i WHERE i.lot_id=l.id ORDER BY i.id DESC LIMIT 1) AS last_inspection_id,
          (SELECT i.result FROM inspections i WHERE i.lot_id=l.id ORDER BY i.id DESC LIMIT 1) AS last_result,
          EXISTS (SELECT 1 FROM inspection_plans ip WHERE ip.product_id=l.product_id AND ip.stage=l.stage AND ip.active) AS has_plan
     FROM lots l JOIN products p ON p.id=l.product_id LEFT JOIN suppliers s ON s.id=l.supplier_id LEFT JOIN production_lines pl ON pl.id=l.line_id
    WHERE l.org_id=$1 AND ($2::text IS NULL OR ($2='QUEUE' AND l.status IN ('PENDING','IN_INSPECTION')) OR l.status::text=$2)
      AND ($3::text IS NULL OR l.stage::text=$3) AND ($4::text IS NULL OR l.lot_no ILIKE '%'||$4||'%' OR p.code ILIKE '%'||$4||'%')
    ORDER BY CASE WHEN l.status IN ('PENDING','IN_INSPECTION') THEN 0 ELSE 1 END, l.lot_date DESC, l.id DESC LIMIT 400`,
  [org, f.status ?? null, f.stage ?? null, f.q || null]);

// ---------- inspections ----------
/** Start (or resume) inspection of a lot against the active plan for its product & stage */
export async function startInspection(org: number, uid: number, lotId: number) {
  return tx(async c => {
    const { rows: [lot] } = await c.query(`SELECT * FROM lots WHERE id=$1 AND org_id=$2 FOR UPDATE`, [lotId, org]);
    if (!lot) throw new HttpError(404, 'Lot not found');
    const { rows: [draft] } = await c.query(`SELECT id FROM inspections WHERE lot_id=$1 AND status='DRAFT'`, [lotId]);
    if (draft) return { id: draft.id, resumed: true };
    if (!['PENDING', 'IN_INSPECTION'].includes(lot.status)) throw new HttpError(422, `Lot is ${lot.status}; only pending lots can be inspected (rework re-opens a lot)`);
    const { rows: [plan] } = await c.query(`SELECT * FROM inspection_plans WHERE product_id=$1 AND stage=$2 AND active`, [lot.product_id, lot.stage]);
    if (!plan) throw new HttpError(422, `No active ${lot.stage} inspection plan for this product`);
    if (!plan.approved_by) throw new HttpError(422, 'The inspection plan is not approved by QA yet');
    const s = sampleSizeFor(plan, Number(lot.quantity));
    if (plan.sampling_method === 'HUNDRED' && s.sample_size > HUNDRED_PERCENT_LIMIT) throw new HttpError(422, `100% plans are limited to ${HUNDRED_PERCENT_LIMIT} units per lot`);
    const reinsp = (await c.query(`SELECT COUNT(*)::int n FROM inspections WHERE lot_id=$1`, [lotId])).rows[0].n > 0;
    const { rows: [i] } = await c.query(
      `INSERT INTO inspections(org_id,insp_no,lot_id,plan_id,stage,sample_size,accept_number,inspector_id,is_reinspection)
       VALUES ($1,next_no($1,$2),$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [org, lot.stage, lotId, plan.id, lot.stage, s.sample_size, plan.accept_number, uid, reinsp]);
    await c.query(`UPDATE lots SET status='IN_INSPECTION' WHERE id=$1`, [lotId]);
    return { id: i.id, resumed: false };
  });
}

export async function getInspection(org: number, id: number) {
  const i = await one(`SELECT i.*, l.lot_no, l.quantity AS lot_qty, l.source, l.supplier_invoice, l.grn_no, l.lot_date, l.status AS lot_status, l.shift,
                              p.code AS product_code, p.name AS product_name, p.drawing_no, p.revision, p.customer, s.name AS supplier, pl.code AS line,
                              ip.plan_no, ip.version AS plan_version, ip.sampling_method, ip.title AS plan_title,
                              u.name AS inspector, a.name AS approver, o.name AS org_name, o.address AS org_address, o.certifications,
                              (SELECT n.id FROM ncrs n WHERE n.inspection_id=i.id LIMIT 1) AS ncr_id,
                              (SELECT n.ncr_no FROM ncrs n WHERE n.inspection_id=i.id LIMIT 1) AS ncr_no
                         FROM inspections i JOIN lots l ON l.id=i.lot_id JOIN products p ON p.id=l.product_id JOIN inspection_plans ip ON ip.id=i.plan_id
                         LEFT JOIN suppliers s ON s.id=l.supplier_id LEFT JOIN production_lines pl ON pl.id=l.line_id
                         LEFT JOIN users u ON u.id=i.inspector_id LEFT JOIN users a ON a.id=i.approved_by JOIN organizations o ON o.id=i.org_id
                        WHERE i.org_id=$1 AND i.id=$2`, [org, id]);
  if (!i) throw new HttpError(404, 'Inspection not found');
  const characteristics = await query(`SELECT c.*, LEAST(COALESCE(c.samples, $2), $2) AS n FROM plan_characteristics c WHERE plan_id=$1 ORDER BY seq`, [i.plan_id, i.sample_size]);
  const results = await query(`SELECT r.characteristic_id, r.sample_no, r.value, r.ok, r.instrument_id, ins.code AS instrument FROM inspection_results r
                                LEFT JOIN instruments ins ON ins.id=r.instrument_id WHERE inspection_id=$1 ORDER BY characteristic_id, sample_no`, [id]);
  const defects = await query(`SELECT d.*, dc.code, dc.name, dc.severity, dc.category FROM inspection_defects d JOIN defect_codes dc ON dc.id=d.defect_code_id WHERE inspection_id=$1 ORDER BY d.id`, [id]);
  // per-characteristic summary (min / max / mean / NG count)
  const summary = characteristics.map(ch => {
    const rs = results.filter(r => r.characteristic_id === ch.id), vals = rs.map(r => r.value).filter((v): v is number => v != null);
    return { characteristic_id: ch.id, entered: rs.length, ng: rs.filter(r => r.ok === false).length,
      min: vals.length ? Math.min(...vals) : null, max: vals.length ? Math.max(...vals) : null, mean: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null };
  });
  return { ...i, characteristics, results, defects, summary };
}

async function lockDraft(c: PoolClient, org: number, id: number) {
  const { rows: [i] } = await c.query(`SELECT * FROM inspections WHERE id=$1 AND org_id=$2 FOR UPDATE`, [id, org]);
  if (!i) throw new HttpError(404, 'Inspection not found');
  if (i.status !== 'DRAFT') throw new HttpError(422, 'Inspection is already submitted');
  return i;
}

/** Bulk upsert measurements; DB trigger computes OK vs spec and blocks uncalibrated instruments */
export async function saveResults(org: number, id: number, results: any[]) {
  return tx(async c => {
    const i = await lockDraft(c, org, id);
    const { rows: chars } = await c.query(`SELECT id, LEAST(COALESCE(samples,$2),$2) AS n, type FROM plan_characteristics WHERE plan_id=$1`, [i.plan_id, i.sample_size]);
    for (const r of results) {
      const ch = chars.find(x => x.id === r.characteristic_id);
      if (!ch) throw new HttpError(422, 'Characteristic is not part of this plan');
      if (r.sample_no > ch.n) throw new HttpError(422, `Sample ${r.sample_no} exceeds the ${ch.n} samples required`);
      if (ch.type === 'VARIABLE' && r.value == null) { await c.query(`DELETE FROM inspection_results WHERE inspection_id=$1 AND characteristic_id=$2 AND sample_no=$3`, [id, r.characteristic_id, r.sample_no]); continue; }
      if (ch.type === 'ATTRIBUTE' && r.ok == null) { await c.query(`DELETE FROM inspection_results WHERE inspection_id=$1 AND characteristic_id=$2 AND sample_no=$3`, [id, r.characteristic_id, r.sample_no]); continue; }
      await c.query(`INSERT INTO inspection_results(inspection_id,characteristic_id,sample_no,value,ok,instrument_id,measured_at)
                     VALUES ($1,$2,$3,$4,$5,$6,now()) ON CONFLICT (inspection_id,characteristic_id,sample_no)
                     DO UPDATE SET value=EXCLUDED.value, ok=EXCLUDED.ok, instrument_id=EXCLUDED.instrument_id, measured_at=now()`,
        [id, r.characteristic_id, r.sample_no, ch.type === 'VARIABLE' ? r.value : null, ch.type === 'ATTRIBUTE' ? r.ok : null, r.instrument_id ?? null]);
    }
    const { rows: [n] } = await c.query(`SELECT COUNT(*)::int n FROM inspection_results WHERE inspection_id=$1`, [id]);
    return { saved: n.n };
  });
}

export async function addDefect(org: number, id: number, d: any) {
  return tx(async c => {
    await lockDraft(c, org, id);
    const { rows: [dc] } = await c.query(`SELECT id FROM defect_codes WHERE id=$1 AND org_id=$2`, [d.defect_code_id, org]);
    if (!dc) throw new HttpError(422, 'Unknown defect code');
    const { rows: [r] } = await c.query(`INSERT INTO inspection_defects(inspection_id,defect_code_id,quantity,characteristic_id,remarks,photo_url,photo_mime)
                                         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [id, d.defect_code_id, d.quantity, d.characteristic_id, d.remarks, d.photo_url ?? null, d.photo_mime]);
    return r;
  });
}
export async function removeDefect(org: number, id: number, defectId: number) {
  return tx(async c => { await lockDraft(c, org, id); await c.query(`DELETE FROM inspection_defects WHERE id=$1 AND inspection_id=$2`, [defectId, id]); return { ok: true }; });
}

/**
 * Submit → decision:
 *  • every characteristic must have all its samples recorded
 *  • a sample unit is DEFECTIVE if any characteristic is NOT OK on that unit
 *  • FAIL if a CRITICAL characteristic has any NG, or defective units > accept number (Ac)
 *  • PASS → lot ACCEPTED · FAIL → lot ON HOLD + NCR raised automatically
 */
export async function submitInspection(s: Session, id: number, remarks: string | null) {
  return tx(async c => {
    const i = await lockDraft(c, s.orgId, id);
    const { rows: chars } = await c.query(`SELECT c.*, LEAST(COALESCE(c.samples,$2),$2) AS n FROM plan_characteristics c WHERE plan_id=$1 ORDER BY seq`, [i.plan_id, i.sample_size]);
    const { rows: res } = await c.query(`SELECT characteristic_id, sample_no, ok FROM inspection_results WHERE inspection_id=$1`, [id]);
    const missing = chars.filter(ch => res.filter(r => r.characteristic_id === ch.id).length < ch.n);
    if (missing.length) throw new HttpError(422, `Incomplete: ${missing.map(m => `${m.name} (${res.filter(r => r.characteristic_id === m.id).length}/${m.n})`).join(', ')}`);
    const ng = res.filter(r => r.ok === false);
    const defectiveUnits = new Set(ng.map(r => r.sample_no)).size;
    const failedChars = chars.filter(ch => ng.some(r => r.characteristic_id === ch.id));
    const critical = failedChars.some(ch => ch.severity === 'CRITICAL');
    const pass = !critical && defectiveUnits <= i.accept_number;
    await c.query(`UPDATE inspections SET status='SUBMITTED', submitted_at=now(), result=$2, defective_units=$3, critical_fail=$4, remarks=$5 WHERE id=$1`,
      [id, pass ? 'PASS' : 'FAIL', defectiveUnits, critical, remarks]);
    const { rows: [lot] } = await c.query(`SELECT * FROM lots WHERE id=$1 FOR UPDATE`, [i.lot_id]);
    let ncrId: number | null = null;
    if (pass) await c.query(`UPDATE lots SET status='ACCEPTED', accepted_qty=quantity, rejected_qty=0 WHERE id=$1`, [lot.id]);
    else {
      await c.query(`UPDATE lots SET status='ON_HOLD' WHERE id=$1`, [lot.id]);
      const title = `${i.stage} reject: ${failedChars.map(f => f.name).join(', ')}`.slice(0, 200);
      const desc = `Lot ${lot.lot_no} failed ${i.stage} inspection: ${defectiveUnits} defective of ${i.sample_size} sampled (Ac ${i.accept_number})` +
        `${critical ? '; CRITICAL characteristic out of specification' : ''}. Failed: ${failedChars.map(f => `${f.name} [${f.lsl ?? '—'}…${f.usl ?? '—'} ${f.unit ?? ''}]`).join('; ')}.`;
      const { rows: [n] } = await c.query(
        `INSERT INTO ncrs(org_id,ncr_no,source,inspection_id,lot_id,product_id,supplier_id,title,description,qty_affected,severity,raised_by)
         VALUES ($1,next_no($1,'NCR'),$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [s.orgId, lot.source === 'SUPPLIER' ? 'SUPPLIER' : 'INSPECTION', id, lot.id, lot.product_id, lot.supplier_id, title, desc, lot.quantity, critical ? 'CRITICAL' : 'MAJOR', s.uid]);
      ncrId = n.id;
    }
    await c.query(`INSERT INTO audit_log(org_id,user_id,action,entity,entity_id,detail) VALUES ($1,$2,'SUBMIT','inspection',$3,$4)`,
      [s.orgId, s.uid, id, JSON.stringify({ result: pass ? 'PASS' : 'FAIL', defectiveUnits })]);
    return { result: pass ? 'PASS' : 'FAIL', defective_units: defectiveUnits, critical_fail: critical, failed: failedChars.map(f => f.name), ncr_id: ncrId };
  });
}

/** QA sign-off (cannot approve your own inspection) */
export async function approveInspection(s: Session, id: number) {
  const i = await one(`SELECT * FROM inspections WHERE id=$1 AND org_id=$2`, [id, s.orgId]);
  if (!i) throw new HttpError(404, 'Not found');
  if (i.status !== 'SUBMITTED') throw new HttpError(422, `Only submitted inspections can be approved (is ${i.status})`);
  if (i.inspector_id === s.uid) throw new HttpError(403, 'Independent review required — you cannot approve your own inspection');
  return one(`UPDATE inspections SET status='APPROVED', approved_by=$2, approved_at=now() WHERE id=$1 RETURNING *`, [id, s.uid]);
}

export const listInspections = (org: number, f: { from?: string; to?: string; stage?: string; result?: string }) => query(
  `SELECT i.id, i.insp_no, i.stage, i.status, i.result, i.sample_size, i.defective_units, i.critical_fail, i.started_at, i.submitted_at, i.is_reinspection,
          l.lot_no, l.quantity, p.code AS product_code, s.name AS supplier, u.name AS inspector
     FROM inspections i JOIN lots l ON l.id=i.lot_id JOIN products p ON p.id=l.product_id LEFT JOIN suppliers s ON s.id=l.supplier_id LEFT JOIN users u ON u.id=i.inspector_id
    WHERE i.org_id=$1 AND ($2::date IS NULL OR i.started_at::date >= $2) AND ($3::date IS NULL OR i.started_at::date <= $3)
      AND ($4::text IS NULL OR i.stage::text=$4) AND ($5::text IS NULL OR i.result::text=$5)
    ORDER BY i.id DESC LIMIT 400`, [org, f.from ?? null, f.to ?? null, f.stage ?? null, f.result ?? null]);
