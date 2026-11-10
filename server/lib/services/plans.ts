import { query, one, tx } from '../db';
import { HttpError } from '../auth';

export const listPlans = (org: number) => query(
  `SELECT p.*, pr.code AS product_code, pr.name AS product_name, u.name AS approved_by_name,
          (SELECT COUNT(*) FROM plan_characteristics c WHERE c.plan_id=p.id) AS characteristics
     FROM inspection_plans p JOIN products pr ON pr.id=p.product_id LEFT JOIN users u ON u.id=p.approved_by
    WHERE p.org_id=$1 ORDER BY p.active DESC, pr.code, p.stage, p.version DESC`, [org]);

export async function getPlan(org: number, id: number) {
  const p = await one(`SELECT p.*, pr.code AS product_code, pr.name AS product_name, pr.drawing_no, pr.revision FROM inspection_plans p
                        JOIN products pr ON pr.id=p.product_id WHERE p.org_id=$1 AND p.id=$2`, [org, id]);
  if (!p) throw new HttpError(404, 'Plan not found');
  return { ...p, characteristics: await query(`SELECT * FROM plan_characteristics WHERE plan_id=$1 ORDER BY seq`, [id]) };
}

/** Saving a plan for a product+stage creates a new version; the previous version is retired (inspections keep their version) */
export async function savePlan(org: number, uid: number, d: any) {
  return tx(async c => {
    const { rows: [prod] } = await c.query(`SELECT code FROM products WHERE id=$1 AND org_id=$2`, [d.product_id, org]);
    if (!prod) throw new HttpError(422, 'Unknown product');
    const { rows: [prev] } = await c.query(`SELECT * FROM inspection_plans WHERE org_id=$1 AND product_id=$2 AND stage=$3 ORDER BY version DESC LIMIT 1 FOR UPDATE`, [org, d.product_id, d.stage]);
    if (prev) await c.query(`UPDATE inspection_plans SET active=FALSE WHERE org_id=$1 AND product_id=$2 AND stage=$3`, [org, d.product_id, d.stage]);
    const planNo = prev?.plan_no ?? `CP-${prod.code}-${d.stage}`;
    const { rows: [p] } = await c.query(
      `INSERT INTO inspection_plans(org_id,plan_no,product_id,stage,version,title,sampling_method,sample_size,sample_percent,accept_number,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [org, planNo, d.product_id, d.stage, (prev?.version ?? 0) + 1, d.title, d.sampling_method, d.sample_size, d.sample_percent, d.accept_number, d.notes]);
    let seq = 0;
    for (const ch of d.characteristics)
      await c.query(`INSERT INTO plan_characteristics(plan_id,seq,name,type,unit,nominal,lsl,usl,instrument_type,method,severity,samples,spc)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [p.id, ++seq * 10, ch.name, ch.type, ch.unit, ch.nominal, ch.type === 'VARIABLE' ? ch.lsl : null, ch.type === 'VARIABLE' ? ch.usl : null,
         ch.instrument_type, ch.method, ch.severity, ch.samples, ch.type === 'VARIABLE' && ch.spc]);
    await c.query(`INSERT INTO audit_log(org_id,user_id,action,entity,entity_id,detail) VALUES ($1,$2,'CREATE','plan',$3,$4)`, [org, uid, p.id, JSON.stringify({ version: p.version })]);
    return p;
  });
}

export async function approvePlan(org: number, uid: number, id: number) {
  const p = await one(`UPDATE inspection_plans SET approved_by=$3, approved_at=now() WHERE org_id=$1 AND id=$2 AND approved_by IS NULL RETURNING *`, [org, id, uid]);
  if (!p) throw new HttpError(422, 'Plan not found or already approved');
  return p;
}
