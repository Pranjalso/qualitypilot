import { query, one } from '../db';
import { spc, spcCharacteristics } from './spc';

export async function dashboard(org: number) {
  // Use latest submitted inspection timestamp as reference anchor for demo consistency
  const refRow = await one<{ ts: string }>(
    `SELECT COALESCE(MAX(submitted_at), now())::text AS ts FROM inspections WHERE org_id=$1 AND status<>'DRAFT'`,
    [org]
  );
  const ref = refRow?.ts || new Date().toISOString();

  const [kpi, byStage, pareto, weekly, suppliers, cal, ncrs, capas, queue, org_] = await Promise.all([
    one(`SELECT COUNT(*) FILTER (WHERE NOT is_reinspection) AS first_inspections,
                COUNT(*) FILTER (WHERE NOT is_reinspection AND result='PASS') AS first_pass,
                COUNT(*) AS inspections, COUNT(*) FILTER (WHERE result='FAIL') AS failed
           FROM inspections WHERE org_id=$1 AND status<>'DRAFT' AND submitted_at >= $2::timestamptz - interval '30 days'`, [org, ref]),
    query(`SELECT i.stage, COUNT(*) AS lots, COUNT(*) FILTER (WHERE i.result='FAIL') AS failed, SUM(i.sample_size) AS sampled, SUM(i.defective_units) AS defective
             FROM inspections i WHERE i.org_id=$1 AND i.status<>'DRAFT' AND i.submitted_at >= $2::timestamptz - interval '30 days' GROUP BY i.stage ORDER BY i.stage`, [org, ref]),
    query(`SELECT dc.code, dc.name, dc.severity, SUM(d.quantity)::int AS qty FROM inspection_defects d JOIN inspections i ON i.id=d.inspection_id
             JOIN defect_codes dc ON dc.id=d.defect_code_id WHERE i.org_id=$1 AND i.submitted_at >= $2::timestamptz - interval '90 days' GROUP BY dc.id ORDER BY qty DESC LIMIT 10`, [org, ref]),
    query(`SELECT to_char(date_trunc('week', submitted_at),'DD Mon') AS label, COUNT(*) AS lots, COUNT(*) FILTER (WHERE result='FAIL') AS failed,
                  ROUND(100.0 * COUNT(*) FILTER (WHERE result='PASS' AND NOT is_reinspection) / NULLIF(COUNT(*) FILTER (WHERE NOT is_reinspection),0), 1) AS fpy
             FROM inspections WHERE org_id=$1 AND status<>'DRAFT' AND submitted_at >= $2::timestamptz - interval '10 weeks' GROUP BY date_trunc('week', submitted_at) ORDER BY date_trunc('week', submitted_at)`, [org, ref]),
    query(`SELECT * FROM v_supplier_quality WHERE org_id=$1 ORDER BY ppm DESC`, [org]),
    one(`SELECT COUNT(*) FILTER (WHERE cal_status='OVERDUE') AS overdue, COUNT(*) FILTER (WHERE cal_status='DUE_SOON') AS due_soon,
                COUNT(*) FILTER (WHERE cal_status='OUT_OF_SERVICE') AS out_of_service, COUNT(*) AS total FROM v_instrument_status WHERE org_id=$1`, [org]),
    one(`SELECT COUNT(*) FILTER (WHERE status NOT IN ('CLOSED','CANCELLED')) AS open, COUNT(*) FILTER (WHERE status NOT IN ('CLOSED','CANCELLED') AND severity='CRITICAL') AS critical,
                COALESCE(SUM(cost_of_poor_quality) FILTER (WHERE raised_at >= $2::timestamptz - interval '90 days'),0) AS copq_90d,
                COUNT(*) FILTER (WHERE source='CUSTOMER_COMPLAINT' AND raised_at >= $2::timestamptz - interval '90 days') AS complaints_90d FROM ncrs WHERE org_id=$1`, [org, ref]),
    one(`SELECT COUNT(*) FILTER (WHERE status<>'CLOSED') AS open, COUNT(*) FILTER (WHERE status<>'CLOSED' AND target_date < CURRENT_DATE) AS overdue,
                (SELECT COUNT(*) FROM capa_actions a JOIN capas c2 ON c2.id=a.capa_id WHERE c2.org_id=$1 AND a.status='OPEN' AND a.due_date < CURRENT_DATE) AS overdue_actions
           FROM capas WHERE org_id=$1`, [org]),
    one(`SELECT COUNT(*) FILTER (WHERE status IN ('PENDING','IN_INSPECTION')) AS pending, COUNT(*) FILTER (WHERE status='ON_HOLD') AS on_hold FROM lots WHERE org_id=$1`, [org]),
    one(`SELECT name, certifications FROM organizations WHERE id=$1`, [org]),
  ]);

  const total = pareto.reduce((s: number, p: any) => s + p.qty, 0); let cum = 0;
  const paretoCum = pareto.map((p: any) => ({ ...p, cum_pct: total ? Math.round(((cum += p.qty) / total) * 1000) / 10 : 0 }));
  const sampled = byStage.reduce((s: number, x: any) => s + Number(x.sampled), 0), defective = byStage.reduce((s: number, x: any) => s + Number(x.defective), 0);
  const chars = await spcCharacteristics(org);
  const capability = [];
  for (const c of chars.slice(0, 8)) {
    const r: any = await spc(org, c.id).catch(() => null);
    if (r?.stats) capability.push({ ...c, cpk: r.stats.cpk, ppk: r.stats.ppk, signals: r.stats.signals, verdict: r.stats.verdict });
  }

  return {
    org: org_,
    fpy: kpi!.first_inspections ? Math.round((kpi!.first_pass / kpi!.first_inspections) * 1000) / 10 : null,
    kpi,
    by_stage: byStage,
    ppm_sample: sampled ? Math.round((defective / sampled) * 1e6) : 0,
    pareto: paretoCum,
    weekly,
    suppliers,
    calibration: cal,
    ncrs,
    capas,
    queue,
    capability
  };
}

export async function lotCertificate(org: number, lotId: number) {
  const lot = await one(`SELECT l.*, p.code AS product_code, p.name AS product_name, p.drawing_no, p.revision, p.customer, s.name AS supplier, o.name AS org_name,
                                o.address AS org_address, o.certifications FROM lots l JOIN products p ON p.id=l.product_id LEFT JOIN suppliers s ON s.id=l.supplier_id
                                JOIN organizations o ON o.id=l.org_id WHERE l.org_id=$1 AND l.id=$2`, [org, lotId]);
  return lot;
}
