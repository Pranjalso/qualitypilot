import { query, one } from '../db';
import { HttpError } from '../auth';

// Control-chart constants (AIAG SPC manual) for subgroup size n
const K: Record<number, { A2: number; D3: number; D4: number; d2: number }> = {
  2: { A2: 1.880, D3: 0, D4: 3.267, d2: 1.128 }, 3: { A2: 1.023, D3: 0, D4: 2.574, d2: 1.693 }, 4: { A2: 0.729, D3: 0, D4: 2.282, d2: 2.059 },
  5: { A2: 0.577, D3: 0, D4: 2.114, d2: 2.326 }, 6: { A2: 0.483, D3: 0, D4: 2.004, d2: 2.534 }, 7: { A2: 0.419, D3: 0.076, D4: 1.924, d2: 2.704 },
  8: { A2: 0.373, D3: 0.136, D4: 1.864, d2: 2.847 }, 9: { A2: 0.337, D3: 0.184, D4: 1.816, d2: 2.970 }, 10: { A2: 0.308, D3: 0.223, D4: 1.777, d2: 3.078 },
};
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: number[]) => { const m = mean(xs); return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1)); };
const r4 = (n: number | null) => (n == null || !isFinite(n) ? null : Math.round(n * 10000) / 10000);

/**
 * X̄–R chart: one subgroup per submitted inspection (its samples).
 * Subgroup n=1 → Individuals / moving-range chart (E2 = 2.66).
 * Capability: Cp/Cpk use within-subgroup σ = R̄/d2; Pp/Ppk use overall σ.
 * Signals: (1) point beyond control limits · (2) 7 consecutive points on one side of the centre line · (3) 6 consecutive rising or falling.
 */
export async function spc(org: number, characteristicId: number, from?: string, to?: string) {
  const ch = await one(`SELECT c.*, p.plan_no, p.stage, pr.code AS product_code, pr.name AS product_name FROM plan_characteristics c
                         JOIN inspection_plans p ON p.id=c.plan_id JOIN products pr ON pr.id=p.product_id WHERE c.id=$1 AND p.org_id=$2`, [characteristicId, org]);
  if (!ch) throw new HttpError(404, 'Characteristic not found');
  if (ch.type !== 'VARIABLE') throw new HttpError(422, 'Control charts need a variable (measured) characteristic');
  // all plan versions for the same product/stage share the characteristic by name
  const rows = await query(
    `SELECT i.id, i.insp_no, l.lot_no, i.submitted_at, array_agg(r.value ORDER BY r.sample_no) AS vals
       FROM inspection_results r JOIN inspections i ON i.id=r.inspection_id JOIN lots l ON l.id=i.lot_id
       JOIN plan_characteristics c ON c.id=r.characteristic_id JOIN inspection_plans p ON p.id=c.plan_id
      WHERE p.org_id=$1 AND p.product_id=(SELECT product_id FROM inspection_plans WHERE id=$2) AND p.stage=$3 AND c.name=$4
        AND i.status <> 'DRAFT' AND ($5::date IS NULL OR i.submitted_at::date >= $5) AND ($6::date IS NULL OR i.submitted_at::date <= $6)
      GROUP BY i.id, l.lot_no ORDER BY i.submitted_at LIMIT 125`, [org, ch.plan_id, ch.stage, ch.name, from ?? null, to ?? null]);
  const plannedN = Number(ch.samples || 1);
  const groups = rows
    .map(r => ({ ...r, vals: (r.vals as any[]).map(Number).filter((v: number) => v != null && isFinite(v) && v > 0) }))
    .filter(g => g.vals.length >= Math.min(plannedN, 2));
  if (groups.length < 2) return { characteristic: ch, points: [], message: 'At least 2 complete inspections are needed for a control chart' };
  const n = Math.min(...groups.map(g => g.vals.length));
  const all = groups.flatMap(g => g.vals);
  const lsl = ch.lsl == null ? null : Number(ch.lsl), usl = ch.usl == null ? null : Number(ch.usl);
  let points: any[], limits: any, sigmaWithin: number;
  if (n === 1) {            // I-MR
    const xs = groups.map(g => g.vals[0]); const mr = xs.slice(1).map((x, i) => Math.abs(x - xs[i])); const mrBar = mean(mr), xBar = mean(xs);
    limits = { chart: 'I-MR', center: xBar, ucl: xBar + 2.66 * mrBar, lcl: xBar - 2.66 * mrBar, r_center: mrBar, r_ucl: 3.267 * mrBar, r_lcl: 0 };
    points = groups.map((g, i) => ({ insp_no: g.insp_no, lot_no: g.lot_no, at: g.submitted_at, x: g.vals[0], r: i ? mr[i - 1] : null }));
    sigmaWithin = mrBar / 1.128;
  } else {
    const k = K[Math.min(n, 10)];
    points = groups.map(g => { const v = g.vals.slice(0, n); return { insp_no: g.insp_no, lot_no: g.lot_no, at: g.submitted_at, x: mean(v), r: Math.max(...v) - Math.min(...v) }; });
    const xbb = mean(points.map(p => p.x)), rBar = mean(points.map(p => p.r));
    limits = { chart: 'Xbar-R', n, center: xbb, ucl: xbb + k.A2 * rBar, lcl: xbb - k.A2 * rBar, r_center: rBar, r_ucl: k.D4 * rBar, r_lcl: k.D3 * rBar };
    sigmaWithin = rBar / k.d2;
  }
  // signals
  const c = limits.center;
  points.forEach((p, i) => {
    const f: string[] = [];
    if (p.x > limits.ucl || p.x < limits.lcl) f.push('Beyond control limits');
    if (p.r != null && (p.r > limits.r_ucl || p.r < limits.r_lcl)) f.push('Range out of control');
    if (i >= 6 && points.slice(i - 6, i + 1).every(q => q.x > c)) f.push('7 points above centre');
    if (i >= 6 && points.slice(i - 6, i + 1).every(q => q.x < c)) f.push('7 points below centre');
    if (i >= 5) { const w = points.slice(i - 5, i + 1); if (w.every((q, j) => !j || q.x > w[j - 1].x)) f.push('6 points rising'); if (w.every((q, j) => !j || q.x < w[j - 1].x)) f.push('6 points falling'); }
    if ((usl != null && p.x > usl) || (lsl != null && p.x < lsl)) f.push('Mean outside specification');
    p.signals = f; p.x = r4(p.x); p.r = r4(p.r);
  });
  const mu = mean(all), sOverall = sd(all);
  const cap = (s: number) => ({
    cp: lsl != null && usl != null ? r4((usl - lsl) / (6 * s)) : null,
    cpk: r4(Math.min(usl != null ? (usl - mu) / (3 * s) : Infinity, lsl != null ? (mu - lsl) / (3 * s) : Infinity)),
  });
  const w = cap(sigmaWithin), o = cap(sOverall);
  const outOfSpec = all.filter(v => (usl != null && v > usl) || (lsl != null && v < lsl)).length;
  return { characteristic: ch, values: all.map(r4), limits: Object.fromEntries(Object.entries(limits).map(([k, v]) => [k, typeof v === 'number' ? r4(v) : v])), points,
    stats: { subgroups: points.length, readings: all.length, mean: r4(mu), sigma_within: r4(sigmaWithin), sigma_overall: r4(sOverall), min: r4(Math.min(...all)), max: r4(Math.max(...all)),
      cp: w.cp, cpk: w.cpk, pp: o.cp, ppk: o.cpk, out_of_spec: outOfSpec, ppm_observed: Math.round((outOfSpec / all.length) * 1e6),
      verdict: w.cpk == null ? '—' : w.cpk >= 1.67 ? 'Highly capable (≥1.67)' : w.cpk >= 1.33 ? 'Capable (≥1.33)' : w.cpk >= 1 ? 'Marginal (1.00–1.33) — improve' : 'Not capable (<1.00) — 100% inspection & CAPA',
      signals: points.filter(p => p.signals.length).length } };
}

/** All SPC-tracked characteristics (for the picker and the capability summary) */
export const spcCharacteristics = (org: number) => query(
  `SELECT c.id, c.name, c.unit, c.lsl, c.usl, c.severity, p.stage, pr.code AS product_code FROM plan_characteristics c JOIN inspection_plans p ON p.id=c.plan_id
     JOIN products pr ON pr.id=p.product_id WHERE p.org_id=$1 AND p.active AND c.spc ORDER BY pr.code, p.stage, c.seq`, [org]);
