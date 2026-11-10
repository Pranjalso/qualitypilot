'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Field, Msg, StatusBadge } from '@/components/ui';
import { apiCall, useData } from '@/lib/client';
const blank = () => ({ name: '', type: 'VARIABLE', unit: 'mm', severity: 'MAJOR', spc: false });
export default function PlanEditor({ params }: { params: { id: string } }) {
  const router = useRouter(); const isNew = params.id === 'new';
  const { data: p, reload } = useData<any>(isNew ? null : `/api/plans/${params.id}`); const { data: lk } = useData<any>('/api/lookups'); const { data: me } = useData<any>('/api/auth/me');
  const [f, setF] = useState<any>(isNew ? { stage: 'IPQC', title: '', sampling_method: 'FIXED', sample_size: 5, accept_number: 0, characteristics: [blank()] } : null);
  const [err, setErr] = useState(''); const [ok, setOk] = useState('');
  useEffect(() => { if (p) setF({ ...p, sample_percent: p.sample_percent != null ? Number(p.sample_percent) : null, characteristics: p.characteristics.map((c: any) => ({ ...c, lsl: c.lsl != null ? Number(c.lsl) : null, usl: c.usl != null ? Number(c.usl) : null, nominal: c.nominal != null ? Number(c.nominal) : null })) }); }, [p]);
  if (!f || !lk) return <p>Loading…</p>;
  const qa = me && ['ADMIN', 'QA_MANAGER'].includes(me.role);
  const setC = (i: number, k: string, v: any) => { const cs = [...f.characteristics]; cs[i] = { ...cs[i], [k]: v }; setF({ ...f, characteristics: cs }); };
  const save = async () => { setErr(''); setOk(''); try { const r = await apiCall('/api/plans', 'POST', f); setOk(`Saved as version ${r.version} — needs QA approval before use`); router.push(`/plans/${r.id}`); } catch (x: any) { setErr(x.message); } };
  return <>
    <div className="topbar"><h1>{isNew ? 'New control plan' : <>{p.plan_no} v{p.version} <StatusBadge s={p.active ? 'ACTIVE' : 'RETIRED'} /></>}</h1><div className="row"><Link className="btn" href="/plans">← Plans</Link>
      {!isNew && !p.approved_by && qa && p.active && <button className="btn green" onClick={async () => { setErr(''); try { await apiCall(`/api/plans/${p.id}/approve`, 'POST'); setOk('Approved — inspectors can now use this plan'); reload(); } catch (x: any) { setErr(x.message); } }}>Approve</button>}
      {qa && <button className="btn primary" onClick={save}>{isNew ? 'Create plan' : 'Save as new version'}</button>}</div></div>
    <Msg err={err} ok={ok} />
    {!isNew && <p className="muted">Editing an approved plan creates a new version; past inspections keep the version they were inspected against.</p>}
    <div className="card"><div className="form">
      <Field label="Product"><select disabled={!isNew} value={f.product_id ?? ''} onChange={e => setF({ ...f, product_id: Number(e.target.value) })}><option value="">—</option>{lk.products.map((x: any) => <option key={x.id} value={x.id}>{x.code} · {x.name}</option>)}</select></Field>
      <Field label="Stage"><select disabled={!isNew} value={f.stage} onChange={e => setF({ ...f, stage: e.target.value })}>{['IQC', 'IPQC', 'FQC', 'PDI'].map(s => <option key={s}>{s}</option>)}</select></Field>
      <Field label="Title" wide><input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></Field>
      <Field label="Sampling"><select value={f.sampling_method} onChange={e => setF({ ...f, sampling_method: e.target.value })}><option value="FIXED">Fixed sample size</option><option value="PERCENT">% of lot</option><option value="HUNDRED">100% inspection</option><option value="ISO2859">ISO 2859-1 general level II</option></select></Field>
      {f.sampling_method === 'FIXED' && <Field label="Sample size"><input type="number" value={f.sample_size ?? ''} onChange={e => setF({ ...f, sample_size: e.target.value })} /></Field>}
      {f.sampling_method === 'PERCENT' && <Field label="Sample %"><input type="number" value={f.sample_percent ?? ''} onChange={e => setF({ ...f, sample_percent: e.target.value })} /></Field>}
      <Field label="Accept number (Ac)"><input type="number" min={0} value={f.accept_number} onChange={e => setF({ ...f, accept_number: e.target.value })} /></Field>
      <Field label="Notes" wide><input value={f.notes ?? ''} onChange={e => setF({ ...f, notes: e.target.value })} /></Field></div></div>
    <div className="card" style={{ overflow: 'auto' }}><div className="row"><h3 style={{ margin: 0 }}>Characteristics</h3><div className="spacer" /><button className="btn sm" onClick={() => setF({ ...f, characteristics: [...f.characteristics, blank()] })}>+ Characteristic</button></div>
      <table style={{ marginTop: 8 }}><thead><tr><th>#</th><th>Characteristic</th><th>Type</th><th>Unit</th><th>Nominal</th><th>LSL</th><th>USL</th><th>Gauge type</th><th>Method</th><th>Severity</th><th>Samples</th><th>SPC</th><th /></tr></thead>
        <tbody>{f.characteristics.map((c: any, i: number) => <tr key={i}><td>{i + 1}</td>
          <td><input value={c.name} onChange={e => setC(i, 'name', e.target.value)} style={{ minWidth: 160 }} /></td>
          <td><select value={c.type} onChange={e => setC(i, 'type', e.target.value)}><option>VARIABLE</option><option>ATTRIBUTE</option></select></td>
          {(['unit', 'nominal', 'lsl', 'usl'] as const).map(k => <td key={k}><input disabled={c.type === 'ATTRIBUTE' && k !== 'unit'} type={k === 'unit' ? 'text' : 'number'} step="any" value={c[k] ?? ''} onChange={e => setC(i, k, e.target.value === '' ? null : e.target.value)} style={{ width: 80 }} /></td>)}
          <td><input value={c.instrument_type ?? ''} onChange={e => setC(i, 'instrument_type', e.target.value)} style={{ width: 120 }} /></td>
          <td><input value={c.method ?? ''} onChange={e => setC(i, 'method', e.target.value)} style={{ width: 110 }} /></td>
          <td><select value={c.severity} onChange={e => setC(i, 'severity', e.target.value)}>{['CRITICAL', 'MAJOR', 'MINOR'].map(s => <option key={s}>{s}</option>)}</select></td>
          <td><input type="number" placeholder="all" value={c.samples ?? ''} onChange={e => setC(i, 'samples', e.target.value === '' ? null : e.target.value)} style={{ width: 60 }} /></td>
          <td><input type="checkbox" disabled={c.type === 'ATTRIBUTE'} checked={!!c.spc} onChange={e => setC(i, 'spc', e.target.checked)} style={{ width: 'auto' }} /></td>
          <td><button className="btn sm ghost-red" onClick={() => setF({ ...f, characteristics: f.characteristics.filter((_: any, j: number) => j !== i) })}>✕</button></td></tr>)}</tbody></table>
      <p className="muted" style={{ fontSize: 12 }}>Samples blank = every unit in the sample. A CRITICAL characteristic out of spec fails the lot regardless of Ac.</p></div>
  </>;
}
