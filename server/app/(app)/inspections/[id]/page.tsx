'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Field, Modal, Msg, StatusBadge, ConfirmModal } from '@/components/ui';
import { apiCall, fileToDataUrl, fmtDate, useData } from '@/lib/client';

type Cell = { value?: string; ok?: boolean | null };
const inSpec = (c: any, v: number) => (c.lsl == null || v >= Number(c.lsl)) && (c.usl == null || v <= Number(c.usl));
const spec = (c: any) => c.type === 'ATTRIBUTE' ? 'OK / NG' : c.lsl != null && c.usl != null ? `${Number(c.lsl)} – ${Number(c.usl)}` : c.usl != null ? `≤ ${Number(c.usl)}` : `≥ ${Number(c.lsl)}`;

export default function Inspection({ params }: { params: { id: string } }) {
  const { data: d, reload } = useData<any>(`/api/inspections/${params.id}`);
  const { data: lk } = useData<any>('/api/lookups'); const { data: me } = useData<any>('/api/auth/me');
  const [grid, setGrid] = useState<Record<string, Cell>>({}); const [inst, setInst] = useState<Record<number, string>>({});
  const [dirty, setDirty] = useState(false); const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [def, setDef] = useState<any>(null); const [busy, setBusy] = useState(false);
  const [deleteDefectId, setDeleteDefectId] = useState<number | null>(null);
  const keep = useRef(false);   // defect add/remove reloads must not wipe unsaved readings
  useEffect(() => { if (!d) return; if (keep.current) { keep.current = false; return; } const g: Record<string, Cell> = {}, ii: Record<number, string> = {};
    for (const r of d.results) { g[`${r.characteristic_id}:${r.sample_no}`] = { value: r.value != null ? String(r.value) : undefined, ok: r.ok }; if (r.instrument_id) ii[r.characteristic_id] = String(r.instrument_id); }
    setGrid(g); setInst(ii); setDirty(false); }, [d]);
  if (!d || !lk) return <p>Loading…</p>;
  const draft = d.status === 'DRAFT';
  const set = (k: string, c: Cell) => { setGrid({ ...grid, [k]: c }); setDirty(true); };
  const payload = () => d.characteristics.flatMap((c: any) => Array.from({ length: c.n }, (_, i) => { const g = grid[`${c.id}:${i + 1}`] ?? {};
    return { characteristic_id: c.id, sample_no: i + 1, value: c.type === 'VARIABLE' && g.value !== undefined && g.value !== '' ? Number(g.value) : null, ok: c.type === 'ATTRIBUTE' ? g.ok ?? null : null, instrument_id: inst[c.id] ? Number(inst[c.id]) : null }; }));
  const save = async () => { setErr(''); setOk(''); setBusy(true); try { const r = await apiCall(`/api/inspections/${d.id}/results`, 'PUT', { results: payload() }); setOk(`Saved ${r.saved} readings`); await reload(); } catch (x: any) { setErr(x.message); } setBusy(false); };
  const getMissingSamples = () => {
    const missing: { name: string; filled: number; required: number; id: number }[] = [];
    for (const c of d.characteristics) {
      let count = 0;
      for (let i = 1; i <= c.n; i++) {
        const g = grid[`${c.id}:${i}`];
        if (g && (c.type === 'ATTRIBUTE' ? g.ok != null : g.value !== undefined && g.value !== '')) {
          count++;
        }
      }
      if (count < c.n) {
        missing.push({ name: c.name, filled: count, required: c.n, id: c.id });
      }
    }
    return missing;
  };

  const submit = async () => {
    setErr(''); setOk('');
    const missing = getMissingSamples();
    if (missing.length > 0) {
      const details = missing.map(m => `${m.name} (${m.filled}/${m.required})`).join(', ');
      setErr(`Incomplete: Please record all required sample measurements before submitting (${details}).`);
      // Scroll to the first missing characteristic card smoothly
      const el = document.getElementById(`char-card-${missing[0].id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setBusy(true);
    try {
      await apiCall(`/api/inspections/${d.id}/results`, 'PUT', { results: payload() });
      const r = await apiCall(`/api/inspections/${d.id}/submit`, 'POST', {});
      setOk(r.result === 'PASS' ? 'PASS — lot accepted' : `FAIL — ${r.defective_units} defective unit(s)${r.critical_fail ? ', critical characteristic' : ''}. Lot on hold; NCR raised.`);
      await reload();
    } catch (x: any) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  };
  const ngCount = d.characteristics.reduce((s: number, c: any) => s + Array.from({ length: c.n }, (_, i) => grid[`${c.id}:${i + 1}`]).filter(g => g && (c.type === 'ATTRIBUTE' ? g.ok === false : g.value !== undefined && g.value !== '' && !inSpec(c, Number(g.value)))).length, 0);
  const filled = d.characteristics.reduce((s: number, c: any) => s + Array.from({ length: c.n }, (_, i) => grid[`${c.id}:${i + 1}`]).filter(g => g && (c.type === 'ATTRIBUTE' ? g.ok != null : g.value !== undefined && g.value !== '')).length, 0);
  const total = d.characteristics.reduce((s: number, c: any) => s + c.n, 0);
  const instFor = (c: any) => lk.instruments.filter((i: any) => !c.instrument_type || i.type === c.instrument_type || (c.instrument_type.includes('/') && c.instrument_type.toLowerCase().includes(i.type.split(' ')[0].toLowerCase())) || c.instrument_type === 'Height gauge' && i.type === 'Vernier caliper');
  return <>
    <div className="topbar no-print"><h1>{d.insp_no} <StatusBadge s={d.status} /> {d.result && <StatusBadge s={d.result} />}</h1><div className="row">
      <Link className="btn" href="/lots">← Queue</Link><button className="btn" onClick={() => print()}>Print report</button>
      {draft && <><button className="btn" disabled={busy || !dirty} onClick={save}>Save</button><button className="btn primary" disabled={busy || filled < total} title={filled < total ? `Complete all samples (${filled}/${total}) to submit` : 'Submit inspection'} onClick={submit}>Submit ({filled}/{total})</button></>}
      {d.status === 'SUBMITTED' && me && ['ADMIN', 'QA_MANAGER'].includes(me.role) && <button className="btn green" onClick={async () => { setErr(''); try { await apiCall(`/api/inspections/${d.id}/approve`, 'POST'); setOk('Approved'); reload(); } catch (x: any) { setErr(x.message); } }}>QA approve</button>}
      {d.ncr_id && <Link className="btn red" href={`/ncrs/${d.ncr_id}`}>{d.ncr_no}</Link>}</div></div>
    <div className="no-print"><Msg err={err} ok={ok} /></div>
    {d.result && <div className={`card ${d.result === 'PASS' ? 'pass' : 'fail'}`} style={{ fontWeight: 700 }}>{d.result === 'PASS' ? '✔ LOT ACCEPTED' : '✖ LOT REJECTED / ON HOLD'} — {d.defective_units} defective in {d.sample_size} sampled (Ac {d.accept_number}){d.critical_fail ? ' · critical characteristic out of specification' : ''}</div>}
    <div className="card"><div className="row" style={{ alignItems: 'flex-start' }}><div><h2 style={{ margin: 0, color: 'var(--navy)' }}>{d.stage} Inspection Report</h2><div className="muted">{d.org_name} · {d.certifications}</div></div><div className="spacer" />
      <div className="right muted" style={{ fontSize: 12 }}>Plan {d.plan_no} v{d.plan_version} · {d.sampling_method}<br />Inspector {d.inspector} · {d.submitted_at ? new Date(d.submitted_at).toLocaleString('en-IN') : 'in progress'}<br />{d.approver ? `Approved by ${d.approver}` : ''}</div></div>
      <div className="grid g4" style={{ marginTop: 12 }}><div><div className="muted">Product</div><b>{d.product_code}</b> {d.product_name}<div className="muted">Drg {d.drawing_no} rev {d.revision}{d.customer ? ` · ${d.customer}` : ''}</div></div>
        <div><div className="muted">Lot</div><b className="mono">{d.lot_no}</b><div className="muted">{fmtDate(d.lot_date)} · qty {Number(d.lot_qty)}</div></div>
        <div><div className="muted">Source</div><b>{d.supplier ?? d.line ?? 'Production'}</b><div className="muted">{d.supplier ? `GRN ${d.grn_no ?? '—'} · inv ${d.supplier_invoice ?? '—'}` : `Shift ${d.shift ?? '—'}`}</div></div>
        <div><div className="muted">Sampling</div><b>{d.sample_size} pcs · Ac {d.accept_number}</b><div className="muted">{d.is_reinspection ? 'Re-inspection after rework' : 'First inspection'}</div></div></div></div>
    {draft && <p className="muted no-print">Readings turn red when outside specification. {ngCount > 0 && <b className="out">{ngCount} reading(s) out of spec.</b>} Gauges past calibration are not offered.</p>}
    {d.characteristics.map((c: any) => { const sm = d.summary.find((x: any) => x.characteristic_id === c.id);
      const filledForChar = Array.from({ length: c.n }, (_, i) => grid[`${c.id}:${i + 1}`]).filter(g => g && (c.type === 'ATTRIBUTE' ? g.ok != null : g.value !== undefined && g.value !== '')).length;
      const isCharIncomplete = draft && filledForChar < c.n;
      return <div className={`card ${isCharIncomplete && filled > 0 ? 'card-incomplete-highlight' : ''}`} id={`char-card-${c.id}`} key={c.id} style={{ padding: 12, border: isCharIncomplete && filled > 0 ? '1px solid #F59E0B' : undefined }}>
      <div className="row" style={{ marginBottom: 8, flexWrap: 'wrap' }}><b>{c.seq / 10}. {c.name}</b><span className={`badge s-${c.severity}`}>{c.severity}</span><span className="mono">{spec(c)} {c.unit ?? ''}</span>
        {c.nominal != null && <span className="muted">nominal {Number(c.nominal)}</span>}<span className={`muted ${isCharIncomplete ? 'text-amber' : ''}`} style={isCharIncomplete ? { color: '#D97706', fontWeight: 600 } : undefined}>· {filledForChar}/{c.n} samples recorded{c.method ? ` · ${c.method}` : ''}</span><div className="spacer" />
        {c.type === 'VARIABLE' && (draft ? <select value={inst[c.id] ?? ''} onChange={e => { setInst({ ...inst, [c.id]: e.target.value }); setDirty(true); }} style={{ width: 230 }}>
          <option value="">Gauge ({c.instrument_type ?? 'any'})…</option>{instFor(c).map((i: any) => <option key={i.id} value={i.id} disabled={['OVERDUE', 'OUT_OF_SERVICE'].includes(i.cal_status)}>{i.code} · {i.name}{i.cal_status !== 'OK' ? ` (${i.cal_status.replace('_', ' ')})` : ''}</option>)}</select>
          : <span className="muted">Gauge {d.results.find((r: any) => r.characteristic_id === c.id)?.instrument ?? '—'}</span>)}
        {sm && sm.mean != null && !draft && <span className="mono muted">min {sm.min} · max {sm.max} · x̄ {Number(sm.mean).toFixed(4)}</span>}
        {sm && !draft && <span className={`badge ${sm.ng ? 's-FAIL' : 's-PASS'}`}>{sm.ng ? `${sm.ng} NG` : 'OK'}</span>}</div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${c.type === 'ATTRIBUTE' ? 10 : 8}, minmax(0,1fr))`, gap: 6 }}>
        {Array.from({ length: c.n }, (_, i) => { const k = `${c.id}:${i + 1}`, g = grid[k] ?? {};
          if (c.type === 'ATTRIBUTE') return <div key={k}><div className="muted" style={{ fontSize: 10 }}>#{i + 1}</div><div className="toggle">
            <button disabled={!draft} className={g.ok === true ? 'on-ok' : ''} onClick={() => set(k, { ok: true })}>OK</button><button disabled={!draft} className={g.ok === false ? 'on-ng' : ''} onClick={() => set(k, { ok: false })}>NG</button></div></div>;
          const v = g.value, bad = v !== undefined && v !== '' && !inSpec(c, Number(v));
          return <div key={k}><div className="muted" style={{ fontSize: 10 }}>#{i + 1}</div><input disabled={!draft} type="number" step="any" className={v === undefined || v === '' ? '' : bad ? 'ng' : 'okv'} value={v ?? ''} onChange={e => set(k, { value: e.target.value })} /></div>; })}
        {c.type === 'ATTRIBUTE' && draft && <div><div className="muted" style={{ fontSize: 10 }}>all</div><button className="btn sm" onClick={() => { const g = { ...grid }; for (let i = 1; i <= c.n; i++) if (g[`${c.id}:${i}`]?.ok == null) g[`${c.id}:${i}`] = { ok: true }; setGrid(g); setDirty(true); }}>Rest OK</button></div>}
      </div></div>; })}
    <div className="card"><div className="row"><h3 style={{ margin: 0 }}>Defects found</h3><div className="spacer" />{draft && <button className="btn sm" onClick={() => setDef({ quantity: 1 })}>+ Log defect</button>}</div>
      <table style={{ marginTop: 8 }}><thead><tr><th>Code</th><th>Defect</th><th>Category</th><th>Severity</th><th className="num">Qty</th><th>Remarks</th><th>Photo</th><th /></tr></thead>
        <tbody>{d.defects.map((x: any) => <tr key={x.id}><td className="mono">{x.code}</td><td>{x.name}</td><td>{x.category}</td><td><span className={`badge s-${x.severity}`}>{x.severity}</span></td><td className="num">{x.quantity}</td><td className="muted">{x.remarks}</td>
          <td>{x.photo_url && <img src={x.photo_url} alt="defect" className="thumb" />}</td><td>{draft && <button className="btn sm ghost-red" title="Remove defect" onClick={() => setDeleteDefectId(x.id)}>✕</button>}</td></tr>)}
          {!d.defects.length && <tr><td colSpan={8} className="muted">None logged</td></tr>}</tbody></table></div>
    {d.remarks && <p><b>Remarks:</b> {d.remarks}</p>}
    <div className="row" style={{ marginTop: 30 }}><div>Inspected by: <b>{d.inspector}</b></div><div className="spacer" /><div>Approved by: <b>{d.approver ?? '________________'}</b></div></div>
    {def && <Modal title="Log defect" onClose={() => setDef(null)}><div className="form">
      <Field label="Defect code"><select value={def.defect_code_id ?? ''} onChange={e => setDef({ ...def, defect_code_id: Number(e.target.value) })}><option value="">—</option>{lk.defects.map((x: any) => <option key={x.id} value={x.id}>{x.code} · {x.name} ({x.severity})</option>)}</select></Field>
      <Field label="Quantity"><input type="number" min={1} value={def.quantity} onChange={e => setDef({ ...def, quantity: e.target.value })} /></Field>
      <Field label="Characteristic"><select value={def.characteristic_id ?? ''} onChange={e => setDef({ ...def, characteristic_id: e.target.value })}><option value="">—</option>{d.characteristics.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      <Field label="Photo"><input type="file" accept="image/*" capture="environment" onChange={async e => { const f = e.target.files?.[0]; if (f) { const p = await fileToDataUrl(f); setDef({ ...def, photo_url: p.url, photo_mime: p.mime }); } }} /></Field>
      <Field label="Remarks" wide><input value={def.remarks ?? ''} onChange={e => setDef({ ...def, remarks: e.target.value })} /></Field></div>
      <div className="modal-footer"><button type="button" className="btn ghost" onClick={() => setDef(null)}>Cancel</button><button className="btn primary" onClick={async () => { setErr(''); try { await apiCall(`/api/inspections/${d.id}/defects`, 'POST', { ...def, quantity: Number(def.quantity) }); setDef(null); keep.current = true; reload(); } catch (x: any) { setErr(x.message); } }}>Log defect</button></div></Modal>}

    {deleteDefectId && (
      <ConfirmModal
        title="Remove logged defect?"
        message="Are you sure you want to remove this defect entry from the inspection report?"
        confirmText="Remove defect"
        danger
        onConfirm={async () => {
          await apiCall(`/api/inspections/${d.id}/defects/${deleteDefectId}`, 'DELETE');
          keep.current = true;
          reload();
        }}
        onClose={() => setDeleteDefectId(null)}
      />
    )}
  </>;
}
