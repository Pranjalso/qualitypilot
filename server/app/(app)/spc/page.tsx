'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { ControlChart, Histogram } from '@/components/QCharts';
import { useData } from '@/lib/client';
function Spc() {
  const router = useRouter(); const sp = useSearchParams();
  const { data: list } = useData<any[]>('/api/spc'); const id = sp.get('c') ?? (list?.[0]?.id ? String(list[0].id) : null);
  const { data: s } = useData<any>(id ? `/api/spc/${id}` : null);
  const ch = s?.characteristic, st = s?.stats, L = s?.limits;
  const lab = (p: any) => `${p.lot_no} · ${new Date(p.at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`;
  const tone = (v: number | null) => v == null ? '' : v >= 1.33 ? 'in' : v >= 1 ? 'warn' : 'out';
  return <><div className="topbar"><h1>Statistical process control</h1>
    <select value={id ?? ''} onChange={e => router.push(`/spc?c=${e.target.value}`)} style={{ width: 380, maxWidth: '100%' }}>{list?.map(c => <option key={c.id} value={c.id}>{c.product_code} · {c.stage} · {c.name} ({c.lsl ?? '—'} – {c.usl ?? '—'} {c.unit ?? ''})</option>)}</select></div>
    {s?.message && <div className="card muted">{s.message}</div>}
    {st && <>
      <div className="grid g4">
        <div className="card kpi"><div className="muted">Cpk (within)</div><div className={`val ${tone(st.cpk)}`}>{st.cpk ?? '—'}</div><div className="muted">Cp {st.cp ?? '—'}</div></div>
        <div className="card kpi"><div className="muted">Ppk (overall)</div><div className={`val ${tone(st.ppk)}`}>{st.ppk ?? '—'}</div><div className="muted">Pp {st.pp ?? '—'}</div></div>
        <div className="card kpi"><div className="muted">Mean · σ within</div><div className="val">{st.mean}</div><div className="muted">σ {st.sigma_within} · range {st.min}–{st.max}</div></div>
        <div className="card kpi"><div className="muted">Signals · out of spec</div><div className={`val ${st.signals ? 'out' : 'in'}`}>{st.signals}</div><div className="muted">{st.out_of_spec} of {st.readings} readings · {st.ppm_observed.toLocaleString('en-IN')} ppm</div></div></div>
      <div className={`card ${st.cpk >= 1.33 ? 'pass' : 'fail'}`}><b>{st.verdict}</b> — {ch.product_code} {ch.stage} · {ch.name}, spec {ch.lsl ?? '—'} – {ch.usl ?? '—'} {ch.unit}, {L.chart}{L.n ? ` n=${L.n}` : ''}, {st.subgroups} subgroups.</div>
      <div className="card"><ControlChart title={L.chart === 'I-MR' ? 'Individuals' : 'X̄ chart'} unit={ch.unit} points={s.points.map((p: any) => ({ label: lab(p), v: p.x, flag: p.signals.length > 0 }))} center={L.center} ucl={L.ucl} lcl={L.lcl} lsl={ch.lsl != null ? Number(ch.lsl) : null} usl={ch.usl != null ? Number(ch.usl) : null} digits={4} />
        <ControlChart title={L.chart === 'I-MR' ? 'Moving range' : 'R chart'} unit={ch.unit} points={s.points.map((p: any) => ({ label: lab(p), v: p.r, flag: p.signals.includes('Range out of control') }))} center={L.r_center} ucl={L.r_ucl} lcl={L.r_lcl} digits={4} /></div>
      <div className="card"><h3>Distribution vs specification</h3><Histogram values={s.values} lsl={ch.lsl != null ? Number(ch.lsl) : null} usl={ch.usl != null ? Number(ch.usl) : null} unit={ch.unit} /></div>
      <div className="card"><h3>Out-of-control signals</h3><table><thead><tr><th>Inspection</th><th>Lot</th><th>Date</th><th className="num">X̄</th><th className="num">R</th><th>Rule</th></tr></thead>
        <tbody>{s.points.filter((p: any) => p.signals.length).slice(-15).reverse().map((p: any) => <tr key={p.insp_no}><td className="mono">{p.insp_no}</td><td className="mono">{p.lot_no}</td><td>{new Date(p.at).toLocaleDateString('en-IN')}</td><td className="num">{p.x}</td><td className="num">{p.r ?? '—'}</td><td className="out">{p.signals.join(' · ')}</td></tr>)}
          {!st.signals && <tr><td colSpan={6} className="in">Process in statistical control</td></tr>}</tbody></table></div></>}</>;
}
export default function Page() { return <Suspense><Spc /></Suspense>; }
