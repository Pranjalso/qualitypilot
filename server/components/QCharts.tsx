'use client';
const fmt = (v: number, d = 3) => (Math.abs(v) >= 100 ? v.toFixed(1) : v.toFixed(d));

/** Control chart: points with centre line, UCL/LCL and optional spec limits; signalled points in red */
export function ControlChart({ points, center, ucl, lcl, lsl, usl, title, unit, digits = 3 }: { points: { label: string; v: number | null; flag?: boolean }[];
  center: number; ucl: number; lcl: number; lsl?: number | null; usl?: number | null; title: string; unit?: string; digits?: number }) {
  const W = 900, H = 260, P = 58, R = 90;
  const pts = points.filter(p => p.v != null) as { label: string; v: number; flag?: boolean }[];
  const vals = [...pts.map(p => p.v), ucl, lcl, ...(lsl != null ? [lsl] : []), ...(usl != null ? [usl] : [])];
  const lo = Math.min(...vals), hi = Math.max(...vals), pad = (hi - lo) * 0.08 || 1;
  const y = (v: number) => 16 + (1 - (v - (lo - pad)) / (hi - lo + 2 * pad)) * (H - 50);
  const x = (i: number) => P + (i / Math.max(1, points.length - 1)) * (W - P - R);
  const line = (v: number, color: string, label: string, dash = '') => <g><line x1={P} x2={W - R} y1={y(v)} y2={y(v)} stroke={color} strokeDasharray={dash} strokeWidth="1.3" />
    <text x={W - R + 6} y={y(v) + 4} fontSize="11" fill={color}>{label} {fmt(v, digits)}</text></g>;
  const path = points.map((p, i) => (p.v == null ? '' : `${i && points[i - 1]?.v != null ? 'L' : 'M'}${x(i)},${y(p.v)}`)).join('');
  return <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={title}>
    <text x={P} y={11} fontSize="12" fontWeight="700" fill="#0B1F4B">{title}{unit ? ` (${unit})` : ''}</text>
    {usl != null && line(usl, '#dc2626', 'USL', '2 3')}{lsl != null && line(lsl, '#dc2626', 'LSL', '2 3')}
    {line(ucl, '#d97706', 'UCL', '6 4')}{line(lcl, '#d97706', 'LCL', '6 4')}{line(center, '#12b39a', 'CL')}
    <path d={path} fill="none" stroke="#3B4FE0" strokeWidth="1.6" />
    {points.map((p, i) => p.v != null && <circle key={i} cx={x(i)} cy={y(p.v)} r={p.flag ? 4 : 2.6} fill={p.flag ? '#dc2626' : '#3B4FE0'}><title>{`${p.label}: ${fmt(p.v, digits + 1)}`}</title></circle>)}
    {[0, Math.floor(points.length / 2), points.length - 1].filter((v, i, a) => a.indexOf(v) === i && points[v]).map(i =>
      <text key={i} x={x(i)} y={H - 8} fontSize="10" fill="#6b7590" textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}>{points[i].label}</text>)}
  </svg>;
}

/** Histogram of readings against spec limits */
export function Histogram({ values, lsl, usl, unit }: { values: number[]; lsl?: number | null; usl?: number | null; unit?: string }) {
  if (!values.length) return null;
  const W = 900, H = 200, P = 40, bins = 18;
  const lo = Math.min(...values, lsl ?? Infinity), hi = Math.max(...values, usl ?? -Infinity), w = (hi - lo) / bins || 1;
  const counts = Array.from({ length: bins }, (_, b) => values.filter(v => v >= lo + b * w && (b === bins - 1 ? v <= hi : v < lo + (b + 1) * w)).length);
  const max = Math.max(...counts, 1), x = (v: number) => P + ((v - lo) / (hi - lo || 1)) * (W - 2 * P);
  return <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Histogram">
    {counts.map((c, b) => <rect key={b} x={x(lo + b * w) + 1} y={H - 24 - (c / max) * (H - 50)} width={(W - 2 * P) / bins - 2} height={(c / max) * (H - 50)} fill={(usl != null && lo + b * w >= usl) || (lsl != null && lo + (b + 1) * w <= lsl) ? '#dc2626' : '#3B4FE0'} opacity=".85"><title>{`${c}`}</title></rect>)}
    {lsl != null && <><line x1={x(lsl)} x2={x(lsl)} y1={14} y2={H - 24} stroke="#dc2626" strokeWidth="2" /><text x={x(lsl)} y={11} fontSize="11" fill="#dc2626" textAnchor="middle">LSL {lsl}</text></>}
    {usl != null && <><line x1={x(usl)} x2={x(usl)} y1={14} y2={H - 24} stroke="#dc2626" strokeWidth="2" /><text x={x(usl)} y={11} fontSize="11" fill="#dc2626" textAnchor="middle">USL {usl}</text></>}
    <text x={P} y={H - 6} fontSize="10" fill="#6b7590">{fmt(lo)} {unit}</text><text x={W - P} y={H - 6} fontSize="10" fill="#6b7590" textAnchor="end">{fmt(hi)} {unit}</text>
  </svg>;
}

/** Pareto: bars by count, cumulative % line, 80% reference */
export function Pareto({ rows }: { rows: { code: string; name: string; qty: number; cum_pct: number }[] }) {
  if (!rows.length) return <p className="muted">No defects recorded</p>;
  const W = 640, H = 240, P = 36, max = Math.max(...rows.map(r => r.qty)), bw = (W - 2 * P) / rows.length;
  const y = (v: number) => 20 + (1 - v / max) * (H - 60), yp = (p: number) => 20 + (1 - p / 100) * (H - 60);
  return <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Defect Pareto">
    <line x1={P} x2={W - P} y1={yp(80)} y2={yp(80)} stroke="#d97706" strokeDasharray="4 4" /><text x={W - P + 3} y={yp(80) + 4} fontSize="10" fill="#d97706">80%</text>
    {rows.map((r, i) => <g key={r.code}><rect x={P + i * bw + 4} y={y(r.qty)} width={bw - 8} height={H - 40 - y(r.qty)} rx="3" fill="#E91E7B"><title>{`${r.name}: ${r.qty}`}</title></rect>
      <text x={P + i * bw + bw / 2} y={y(r.qty) - 4} fontSize="10" textAnchor="middle">{r.qty}</text>
      <text x={P + i * bw + bw / 2} y={H - 26} fontSize="10" textAnchor="middle" fill="#1b2440">{r.code}</text></g>)}
    <path d={rows.map((r, i) => `${i ? 'L' : 'M'}${P + i * bw + bw / 2},${yp(Number(r.cum_pct))}`).join('')} fill="none" stroke="#0B1F4B" strokeWidth="1.8" />
    {rows.map((r, i) => <circle key={'c' + i} cx={P + i * bw + bw / 2} cy={yp(Number(r.cum_pct))} r="3" fill="#0B1F4B"><title>{`${r.cum_pct}% cumulative`}</title></circle>)}
  </svg>;
}

/** Weekly first-pass yield (line) with lot volume (bars); weeks with no lots have no point */
export function FpyTrend({ rows }: { rows: { label: string; lots: number; failed: number; fpy: number | null }[] }) {
  if (!rows.length) return null;
  const W = 640, H = 220, P = 36, maxL = Math.max(...rows.map(r => Number(r.lots)), 1), bw = (W - 2 * P) / rows.length;
  const y = (p: number) => 16 + (1 - (p - 70) / 30) * (H - 56);
  const pts = rows.map((r, i) => ({ r, i })).filter(({ r }) => r.fpy != null && Number(r.lots) > 0);
  const cx = (i: number) => P + i * bw + bw / 2, cy = (r: any) => y(Math.max(70, Number(r.fpy)));
  return <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="First-pass yield trend">
    {[70, 85, 100].map(v => <g key={v}><line x1={P} x2={W - P} y1={y(v)} y2={y(v)} stroke="#e3e7f0" /><text x={P - 4} y={y(v) + 4} fontSize="10" textAnchor="end" fill="#6b7590">{v}%</text></g>)}
    {rows.map((r, i) => <g key={r.label}><rect x={P + i * bw + bw * 0.25} y={H - 40 - (Number(r.lots) / maxL) * 50} width={bw * 0.5} height={(Number(r.lots) / maxL) * 50} fill="#cdd5f0"><title>{`${r.lots} lots, ${r.failed} failed`}</title></rect>
      <text x={cx(i)} y={H - 24} fontSize="10" textAnchor="middle">{r.label}</text></g>)}
    <path d={pts.map(({ r, i }, k) => `${k ? 'L' : 'M'}${cx(i)},${cy(r)}`).join('')} fill="none" stroke="#12b39a" strokeWidth="2.4" />
    {pts.map(({ r, i }) => <g key={'p' + i}><circle cx={cx(i)} cy={cy(r)} r="3.5" fill={Number(r.fpy) < 90 ? '#dc2626' : '#12b39a'} />
      <text x={cx(i)} y={cy(r) - 7} fontSize="10" textAnchor="middle">{Number(r.fpy)}%</text></g>)}
  </svg>;
}
