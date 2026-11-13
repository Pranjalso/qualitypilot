'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Field, Modal, Msg, StatusBadge } from '@/components/ui';
import { apiCall, fmtDate, todayStr, useData } from '@/lib/client';
const STEPS = [['OPEN', 'D1–D2 Team & problem'], ['CONTAINMENT', 'D3 Containment'], ['ROOT_CAUSE', 'D4 Root cause'], ['ACTIONS', 'D5–D6 Actions'], ['VERIFICATION', 'D7 Verify & prevent'], ['CLOSED', 'D8 Closed']];
const BONES = ['Man', 'Machine', 'Method', 'Material', 'Measurement', 'Environment'];
export default function Capa({ params }: { params: { id: string } }) {
  const { data: c, reload } = useData<any>(`/api/capas/${params.id}`); const { data: lk } = useData<any>('/api/lookups'); const { data: me } = useData<any>('/api/auth/me');
  const [f, setF] = useState<any>(null); const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [am, setAm] = useState<any>(null); const [done, setDone] = useState<any>(null);
  useEffect(() => { if (c) setF({ team: c.team ?? '', problem: c.problem ?? '', containment: c.containment ?? '', root_cause_method: c.root_cause_method ?? '5WHY', whys: [...(c.whys ?? []), '', '', '', '', ''].slice(0, 5), fishbone: c.fishbone ?? {}, root_cause: c.root_cause ?? '', verification: c.verification ?? '', effective: c.effective, lessons: c.lessons ?? '' }); }, [c]);
  if (!c || !f) return <p>Loading…</p>;
  const canManage = me && ['ADMIN', 'QA_MANAGER'].includes(me.role);
  const closed = c.status === 'CLOSED'; const idx = STEPS.findIndex(s => s[0] === c.status);
  const editable = canManage && !closed;
  const save = async (quiet = false) => { setErr(''); try { await apiCall(`/api/capas/${c.id}`, 'PUT', { ...f, whys: f.whys.filter((w: string) => w.trim()), root_cause_method: f.root_cause_method || null }); if (!quiet) setOk('Saved'); return true; } catch (x: any) { setErr(x.message); return false; } };
  const advance = async () => { setOk(''); if (!(await save(true))) return; try { const r = await apiCall(`/api/capas/${c.id}/advance`, 'POST'); setOk(`Moved to ${r.status.replace('_', ' ')}`); reload(); } catch (x: any) { setErr(x.message); } };
  const T = (k: string, label: string, rows = 3, ph = '') => <Field label={label} wide><textarea rows={rows} disabled={!editable} placeholder={ph} value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} /></Field>;
  return <>
    <div className="topbar"><h1>{c.capa_no} <StatusBadge s={c.status} /></h1><div className="row"><Link className="btn" href="/capas">← CAPAs</Link><button className="btn" onClick={() => print()}>Print 8D</button>
      {editable && <><button className="btn" onClick={() => save()}>Save</button><button className="btn primary" onClick={advance}>{idx === 4 ? 'Close CAPA (D8)' : `Next: ${STEPS[idx + 1][1]}`} →</button></>}</div></div>
    <Msg err={err} ok={ok} />
    {!canManage && <div className="card" style={{ background: '#f8fafc', borderColor: 'var(--border)', marginBottom: 12, padding: '10px 14px', fontSize: 13, color: 'var(--text-muted)' }}>
      Read-only view: Only QA Managers and Admins can edit 8D analysis (root cause, containment, verification) or advance CAPA status.
    </div>}
    <div className="steps">{STEPS.map(([k, l], i) => <div key={k} className={i < idx ? 'done' : i === idx ? 'cur' : ''}>{l}</div>)}</div>
    <div className="card"><h2 style={{ marginTop: 0 }}>{c.title}</h2><div className="muted">{c.type} · owner {c.owner} · target {fmtDate(c.target_date)} · opened {fmtDate(c.created_at)} by {c.created_by_name}{c.closed_by_name ? ` · closed ${fmtDate(c.closed_at)} by ${c.closed_by_name}` : ''}</div>
      {c.ncrs.length > 0 && <div className="row" style={{ marginTop: 8, flexWrap: 'wrap' }}>Linked: {c.ncrs.map((n: any) => <Link key={n.id} href={`/ncrs/${n.id}`} className="badge">{n.ncr_no} · {n.product_code} · {n.status}</Link>)}</div>}</div>
    <div className="grid g2">
      <div className="card"><h3>D1 Team · D2 Problem</h3><div className="form">
        <Field label="Team" wide><input disabled={!editable} value={f.team} onChange={e => setF({ ...f, team: e.target.value })} /></Field>{T('problem', 'Problem (what, where, when, how many)', 4)}</div></div>
      <div className="card"><h3>D3 Containment</h3><div className="form">{T('containment', 'Interim containment', 4, 'Stock quarantined, 100% sort of WIP and FG, customer stock checked…')}</div></div></div>
    <div className="card"><div className="row"><h3 style={{ margin: 0 }}>D4 Root cause</h3><div className="spacer" /><div className="toggle">{['5WHY', 'FISHBONE'].map(m => <button key={m} disabled={!editable} className={f.root_cause_method === m ? 'on-ok' : ''} onClick={() => setF({ ...f, root_cause_method: m })}>{m === '5WHY' ? '5-Why' : 'Fishbone'}</button>)}</div></div>
      {f.root_cause_method === 'FISHBONE' ? <div className="grid g3" style={{ marginTop: 10 }}>{BONES.map(b => <Field key={b} label={b}><textarea rows={2} disabled={!editable} value={f.fishbone[b] ?? ''} onChange={e => setF({ ...f, fishbone: { ...f.fishbone, [b]: e.target.value } })} /></Field>)}</div>
        : <div style={{ marginTop: 10 }}>{f.whys.map((w: string, i: number) => <div key={i} className="row" style={{ marginBottom: 6 }}><b style={{ width: 60 }}>Why {i + 1}</b><input disabled={!editable} value={w} onChange={e => { const ws = [...f.whys]; ws[i] = e.target.value; setF({ ...f, whys: ws }); }} /></div>)}</div>}
      <div className="form" style={{ marginTop: 10 }}>{T('root_cause', 'Verified root cause', 2)}</div></div>
    <div className="card"><div className="row"><h3 style={{ margin: 0 }}>D5–D6 Actions</h3><div className="spacer" />{editable && <button className="btn sm" onClick={() => setAm({ kind: 'CORRECTIVE', due_date: todayStr() })}>+ Action</button>}</div>
      <table style={{ marginTop: 8 }}><thead><tr><th>Type</th><th>Action</th><th>Owner</th><th>Due</th><th>Status</th><th>Evidence</th><th /></tr></thead><tbody>
        {c.actions.map((a: any) => <tr key={a.id}><td>{a.kind}</td><td>{a.description}</td><td>{a.owner ?? '—'}</td><td className={a.overdue ? 'out' : ''}>{fmtDate(a.due_date)}</td><td><StatusBadge s={a.status} />{a.overdue && <span className="badge s-FAIL" style={{ marginLeft: 4 }}>late</span>}</td>
          <td className="muted">{a.evidence}{a.completed_on && <div>done {fmtDate(a.completed_on)}</div>}</td>
          <td>{a.status === 'OPEN' && !closed && (a.owner_id === me?.user?.id || ['ADMIN', 'QA_MANAGER'].includes(me?.role)) && <button className="btn sm green" onClick={() => setDone({ id: a.id, status: 'DONE', evidence: '' })}>Complete</button>}</td></tr>)}
        {!c.actions.length && <tr><td colSpan={7} className="muted">No actions yet</td></tr>}</tbody></table></div>
    <div className="card"><h3>D7 Verification &amp; prevention · D8 Closure</h3><div className="form">{T('verification', 'Verification of effectiveness (data after the change)', 3, 'e.g. 30 lots after the fix: FPY 100%, Cpk 1.62')}
      <Field label="Actions effective?"><div className="toggle"><button disabled={!editable} className={f.effective === true ? 'on-ok' : ''} onClick={() => setF({ ...f, effective: true })}>Yes</button><button disabled={!editable} className={f.effective === false ? 'on-ng' : ''} onClick={() => setF({ ...f, effective: false })}>No</button></div></Field>
      {T('lessons', 'Lessons learned / horizontal deployment', 2)}</div></div>
    {am && lk && <Modal title="Add action" onClose={() => setAm(null)}><Msg err={err} /><div className="form">
      <Field label="Type"><select value={am.kind} onChange={e => setAm({ ...am, kind: e.target.value })}>{['CONTAINMENT', 'CORRECTIVE', 'PREVENTIVE'].map(k => <option key={k}>{k}</option>)}</select></Field>
      <Field label="Owner"><select value={am.owner_id ?? ''} onChange={e => setAm({ ...am, owner_id: e.target.value || null })}><option value="">—</option>{lk.users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
      <Field label="Due"><input type="date" value={am.due_date} onChange={e => setAm({ ...am, due_date: e.target.value })} /></Field>
      <Field label="Action *" wide><textarea rows={2} value={am.description ?? ''} onChange={e => setAm({ ...am, description: e.target.value })} /></Field></div>
      <div className="modal-footer"><button type="button" className="btn ghost" onClick={() => setAm(null)}>Cancel</button><button className="btn primary" onClick={async () => { setErr(''); try { await apiCall(`/api/capas/${c.id}/actions`, 'POST', am); setAm(null); reload(); } catch (x: any) { setErr(x.message); } }}>Add action</button></div></Modal>}
    {done && <Modal title="Complete action" onClose={() => setDone(null)}><Msg err={err} /><div className="form"><Field label="Evidence *" wide><textarea rows={3} value={done.evidence} onChange={e => setDone({ ...done, evidence: e.target.value })} placeholder="What was done, document/photo reference" /></Field></div>
      <div className="modal-footer"><button type="button" className="btn ghost" onClick={() => setDone(null)}>Cancel</button><button className="btn green" onClick={async () => { setErr(''); try { await apiCall(`/api/capa-actions/${done.id}`, 'PUT', { status: 'DONE', evidence: done.evidence }); setDone(null); reload(); } catch (x: any) { setErr(x.message); } }}>Mark done</button></div></Modal>}
  </>;
}
