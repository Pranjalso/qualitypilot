import { query, one, tx } from '../db';
import { HttpError, Session } from '../auth';

const ORDER = ['OPEN', 'CONTAINMENT', 'ROOT_CAUSE', 'ACTIONS', 'VERIFICATION', 'CLOSED'];

export const listCapas = (org: number, status?: string) => query(
  `SELECT c.*, u.name AS owner, (SELECT COUNT(*) FROM capa_actions a WHERE a.capa_id=c.id) AS actions,
          (SELECT COUNT(*) FROM capa_actions a WHERE a.capa_id=c.id AND a.status='OPEN' AND a.due_date < CURRENT_DATE) AS overdue_actions,
          (SELECT string_agg(n.ncr_no, ', ') FROM ncrs n WHERE n.capa_id=c.id) AS ncrs,
          (c.status <> 'CLOSED' AND c.target_date < CURRENT_DATE) AS overdue
     FROM capas c LEFT JOIN users u ON u.id=c.owner_id
    WHERE c.org_id=$1 AND ($2::text IS NULL OR ($2='OPEN' AND c.status <> 'CLOSED') OR c.status::text=$2) ORDER BY c.status='CLOSED', c.target_date`, [org, status ?? null]);

export async function getCapa(org: number, id: number) {
  const c = await one(`SELECT c.*, u.name AS owner, cb.name AS closed_by_name, cr.name AS created_by_name FROM capas c LEFT JOIN users u ON u.id=c.owner_id
                        LEFT JOIN users cb ON cb.id=c.closed_by LEFT JOIN users cr ON cr.id=c.created_by WHERE c.org_id=$1 AND c.id=$2`, [org, id]);
  if (!c) throw new HttpError(404, 'CAPA not found');
  const actions = await query(`SELECT a.*, u.name AS owner, (a.status='OPEN' AND a.due_date < CURRENT_DATE) AS overdue FROM capa_actions a LEFT JOIN users u ON u.id=a.owner_id WHERE capa_id=$1 ORDER BY a.kind, a.due_date`, [id]);
  const ncrs = await query(`SELECT n.id, n.ncr_no, n.title, n.severity, n.status, p.code AS product_code FROM ncrs n LEFT JOIN products p ON p.id=n.product_id WHERE n.capa_id=$1`, [id]);
  return { ...c, actions, ncrs };
}

export async function createCapa(s: Session, d: any) {
  return tx(async c => {
    const { rows: [r] } = await c.query(`INSERT INTO capas(org_id,capa_no,type,title,owner_id,team,problem,target_date,created_by)
                                         VALUES ($1,next_no($1,'CAPA'),$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [s.orgId, d.type, d.title, d.owner_id ?? s.uid, d.team, d.problem, d.target_date, s.uid]);
    for (const n of d.ncr_ids) {
      const { rowCount } = await c.query(`UPDATE ncrs SET capa_id=$1 WHERE id=$2 AND org_id=$3 AND capa_id IS NULL`, [r.id, n, s.orgId]);
      if (!rowCount) throw new HttpError(422, 'An NCR is unknown or already linked to another CAPA');
    }
    return r;
  });
}

export async function updateCapa(s: Session, id: number, d: any) {
  const cur = await one(`SELECT * FROM capas WHERE id=$1 AND org_id=$2`, [id, s.orgId]);
  if (!cur) throw new HttpError(404, 'Not found');
  if (cur.status === 'CLOSED') throw new HttpError(422, 'CAPA is closed');
  const cols = ['title', 'team', 'owner_id', 'problem', 'containment', 'root_cause_method', 'whys', 'fishbone', 'root_cause', 'verification', 'effective', 'lessons', 'target_date'].filter(k => d[k] !== undefined);
  if (!cols.length) return cur;
  return one(`UPDATE capas SET ${cols.map((k, i) => `${k}=$${i + 2}`).join(',')} WHERE id=$1 RETURNING *`,
    [id, ...cols.map(k => (k === 'whys' || k === 'fishbone' ? JSON.stringify(d[k]) : d[k]))]);
}

/** Move to the next 8D step — each gate checks that the previous discipline is complete */
export async function advanceCapa(s: Session, id: number) {
  return tx(async c => {
    const { rows: [x] } = await c.query(`SELECT * FROM capas WHERE id=$1 AND org_id=$2 FOR UPDATE`, [id, s.orgId]);
    if (!x) throw new HttpError(404, 'Not found');
    const next = ORDER[ORDER.indexOf(x.status) + 1];
    if (!next) throw new HttpError(422, 'CAPA is already closed');
    const { rows: acts } = await c.query(`SELECT * FROM capa_actions WHERE capa_id=$1`, [id]);
    if (next === 'ROOT_CAUSE' && !x.containment) throw new HttpError(422, 'D3: record the containment actions first');
    if (next === 'ACTIONS' && !x.root_cause) throw new HttpError(422, 'D4: record the root cause (5-why or fishbone) first');
    if (next === 'VERIFICATION') {
      if (!acts.some(a => a.kind === 'CORRECTIVE' && a.status !== 'CANCELLED')) throw new HttpError(422, 'D5/D6: add at least one corrective action');
      const open = acts.filter(a => a.status === 'OPEN');
      if (open.length) throw new HttpError(422, `${open.length} action(s) still open`);
    }
    if (next === 'CLOSED') {
      if (!['ADMIN', 'QA_MANAGER'].includes(s.role)) throw new HttpError(403, 'Only the QA manager can close a CAPA');
      if (!x.verification || x.effective !== true) throw new HttpError(422, 'D7: record verification evidence and confirm the actions were effective');
    }
    const { rows: [r] } = await c.query(`UPDATE capas SET status=$2 ${next === 'CLOSED' ? ', closed_by=$3, closed_at=now()' : ''} WHERE id=$1 RETURNING *`,
      next === 'CLOSED' ? [id, next, s.uid] : [id, next]);
    return r;
  });
}

export async function addAction(s: Session, capaId: number, d: any) {
  const c = await one(`SELECT status FROM capas WHERE id=$1 AND org_id=$2`, [capaId, s.orgId]);
  if (!c) throw new HttpError(404, 'Not found');
  if (c.status === 'CLOSED') throw new HttpError(422, 'CAPA is closed');
  return one(`INSERT INTO capa_actions(capa_id,kind,description,owner_id,due_date) VALUES ($1,$2,$3,$4,$5) RETURNING *`, [capaId, d.kind, d.description, d.owner_id, d.due_date]);
}
export async function updateAction(s: Session, actionId: number, d: any) {
  const a = await one(`SELECT a.*, c.org_id, c.status AS capa_status FROM capa_actions a JOIN capas c ON c.id=a.capa_id WHERE a.id=$1`, [actionId]);
  if (!a || a.org_id !== s.orgId) throw new HttpError(404, 'Action not found');
  if (a.capa_status === 'CLOSED') throw new HttpError(422, 'CAPA is closed');
  if (a.owner_id && a.owner_id !== s.uid && !['ADMIN', 'QA_MANAGER'].includes(s.role)) throw new HttpError(403, 'Only the action owner or QA can update this action');
  return one(`UPDATE capa_actions SET status=$2, evidence=COALESCE($3,evidence), completed_on=CASE WHEN $2='DONE' THEN COALESCE($4::date,CURRENT_DATE) ELSE NULL END WHERE id=$1 RETURNING *`,
    [actionId, d.status, d.evidence, d.completed_on ?? null]);
}

/** Actions assigned to me (mobile "My tasks") */
export const myActions = (org: number, uid: number) => query(
  `SELECT a.*, c.capa_no, c.title AS capa_title, (a.due_date < CURRENT_DATE) AS overdue FROM capa_actions a JOIN capas c ON c.id=a.capa_id
    WHERE c.org_id=$1 AND a.owner_id=$2 AND a.status='OPEN' AND c.status <> 'CLOSED' ORDER BY a.due_date`, [org, uid]);
