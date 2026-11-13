'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Field, Modal, Msg, StatusBadge } from '@/components/ui';
import { apiCall, fmtDate, inr, todayStr, useData } from '@/lib/client';
const DISP: Record<string, string> = { REWORK: 'Rework → lot re-inspected', SCRAP: 'Scrap', SORT_100: '100% sort — reject the bad qty, accept balance', RETURN_TO_SUPPLIER: 'Return to supplier (debit note)', USE_AS_IS: 'Use as-is (customer / engineering concession)', REGRADE: 'Regrade for another use' };
export default function Ncr({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { data: n, reload } = useData<any>(`/api/ncrs/${params.id}`); const { data: me } = useData<any>('/api/auth/me'); const { data: lk } = useData<any>('/api/lookups');
  const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [dm, setDm] = useState<any>(null); const [cm, setCm] = useState<any>(null);
  if (!n) return <p>Loading…</p>;
  const qa = me && ['ADMIN', 'QA_MANAGER'].includes(me.role); const open = ['OPEN', 'UNDER_REVIEW'].includes(n.status);
  const canDispose = qa && open && n.raised_by !== me?.user?.id;
  const act = async (path: string, body?: any, msg = 'Done') => { setErr(''); setOk(''); try { await apiCall(`/api/ncrs/${n.id}/${path}`, 'POST', body ?? {}); setOk(msg); reload(); return true; } catch (x: any) { setErr(x.message); return false; } };
  return <>
    <div className="topbar"><h1>{n.ncr_no} <StatusBadge s={n.status} /> <StatusBadge s={n.severity} /></h1><div className="row"><Link className="btn" href="/ncrs">← NCRs</Link>
      {qa && n.status === 'OPEN' && <button className="btn" onClick={() => act('review', {}, 'Moved to MRB review')}>Start MRB review</button>}
      {canDispose && <button className="btn primary" onClick={() => setDm({ disposition: n.supplier_id ? 'RETURN_TO_SUPPLIER' : 'REWORK', disposition_qty: Number(n.qty_affected) || Number(n.lot_qty) || 0, cost_of_poor_quality: 0 })}>Disposition</button>}
      {qa && !n.capa_id && n.status !== 'CANCELLED' && <button className="btn" onClick={() => setCm({ type: 'CORRECTIVE', title: n.title, problem: n.description, target_date: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10), ncr_ids: [n.id] })}>Open CAPA</button>}
      {qa && n.status === 'DISPOSITIONED' && <button className="btn green" onClick={() => act('close', {}, 'NCR closed')}>Close NCR</button>}
      {qa && open && <button className="btn ghost-red" onClick={() => act('cancel', {}, 'Cancelled')}>Cancel</button>}</div></div>
    <Msg err={err} ok={ok} />
    <div className="grid g2">
      <div className="card"><h3>{n.title}</h3><p style={{ whiteSpace: 'pre-wrap' }}>{n.description}</p>
        <table className="kv"><tbody>
          <tr><td>Source</td><td>{n.source.replace(/_/g, ' ')}{n.insp_no && <> · <Link href={`/inspections/${n.inspection_id}`} className="mono">{n.insp_no}</Link></>}</td></tr>
          <tr><td>Product</td><td>{n.product_code ? `${n.product_code} · ${n.product_name}` : '—'}</td></tr>
          <tr><td>Lot</td><td className="mono">{n.lot_no ?? '—'} {n.lot_status && <StatusBadge s={n.lot_status} />} {n.lot_qty && <span className="muted">qty {Number(n.lot_qty)}</span>}</td></tr>
          <tr><td>{n.customer ? 'Customer' : 'Supplier'}</td><td>{n.customer ?? n.supplier ?? '—'}</td></tr>
          <tr><td>Qty affected</td><td>{Number(n.qty_affected)}</td></tr>
          <tr><td>Raised</td><td>{fmtDate(n.raised_at)} by {n.raised_by_name}</td></tr>
          <tr><td>CAPA</td><td>{n.capa_id ? <Link href={`/capas/${n.capa_id}`} className="mono">{n.capa_no}</Link> : '—'} {n.capa_status && <StatusBadge s={n.capa_status} />}</td></tr></tbody></table>
        {n.photo_url && <img src={n.photo_url} alt="NCR" style={{ maxWidth: 260, marginTop: 10, borderRadius: 8 }} />}</div>
      <div className="card"><h3>Material Review Board</h3>{n.disposition ? <table className="kv"><tbody>
        <tr><td>Disposition</td><td><b>{n.disposition.replace(/_/g, ' ')}</b></td></tr><tr><td>Quantity</td><td>{Number(n.disposition_qty)}</td></tr>
        <tr><td>Justification</td><td>{n.disposition_note}</td></tr><tr><td>Cost of poor quality</td><td>{inr(n.cost_of_poor_quality)}</td></tr>
        <tr><td>Decided by</td><td>{n.disposed_by_name} · {fmtDate(n.disposed_at)}</td></tr>{n.closed_by_name && <tr><td>Closed by</td><td>{n.closed_by_name} · {fmtDate(n.closed_at)}</td></tr>}</tbody></table>
        : <p className="muted">Awaiting disposition. The lot stays on hold until the MRB decides. {n.raised_by === me?.user?.id ? <b>Segregation of duties: You raised this NCR, so another QA / MRB member must provide the disposition. </b> : ''}The person who raised the NCR cannot disposition it; CRITICAL issues cannot be used as-is; CRITICAL or repeat issues need a CAPA before closing.</p>}
        {n.defects.length > 0 && <><h4>Defects from inspection</h4><table><tbody>{n.defects.map((d: any, i: number) => <tr key={i}><td className="mono">{d.code}</td><td>{d.name}</td><td className="num">{d.quantity}</td><td>{d.photo_url && <img src={d.photo_url} alt="" className="thumb" />}</td></tr>)}</tbody></table></>}</div></div>
    {dm && <Modal title="MRB disposition" onClose={() => setDm(null)}><Msg err={err} /><div className="form">
      <Field label="Decision" wide><select value={dm.disposition} onChange={e => setDm({ ...dm, disposition: e.target.value })}>{Object.entries(DISP).map(([k, v]) => <option key={k} value={k} disabled={(k === 'RETURN_TO_SUPPLIER' && !n.supplier_id) || (k === 'USE_AS_IS' && n.severity === 'CRITICAL')}>{v}</option>)}</select></Field>
      <Field label="Quantity"><input type="number" value={dm.disposition_qty} onChange={e => setDm({ ...dm, disposition_qty: e.target.value })} /></Field>
      <Field label="Cost of poor quality (₹)"><input type="number" value={dm.cost_of_poor_quality} onChange={e => setDm({ ...dm, cost_of_poor_quality: e.target.value })} /></Field>
      <Field label="Justification *" wide><textarea rows={3} value={dm.note ?? ''} onChange={e => setDm({ ...dm, note: e.target.value })} /></Field></div>
      <div className="modal-footer"><button type="button" className="btn ghost" onClick={() => setDm(null)}>Cancel</button><button className="btn primary" onClick={async () => { if (await act('disposition', dm, 'Disposition recorded; lot updated')) setDm(null); }}>Record decision</button></div></Modal>}
    {cm && lk && <Modal title="Open CAPA (8D)" onClose={() => setCm(null)}><Msg err={err} /><div className="form">
      <Field label="Title" wide><input value={cm.title} onChange={e => setCm({ ...cm, title: e.target.value })} /></Field>
      <Field label="Owner"><select value={cm.owner_id ?? ''} onChange={e => setCm({ ...cm, owner_id: e.target.value || null })}><option value="">Me</option>{lk.users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
      <Field label="Target date"><input type="date" min={todayStr()} value={cm.target_date} onChange={e => setCm({ ...cm, target_date: e.target.value })} /></Field>
      <Field label="D1 Team" wide><input value={cm.team ?? ''} onChange={e => setCm({ ...cm, team: e.target.value })} placeholder="QA, production, maintenance…" /></Field>
      <Field label="D2 Problem description" wide><textarea rows={3} value={cm.problem} onChange={e => setCm({ ...cm, problem: e.target.value })} /></Field></div>
      <div className="modal-footer"><button type="button" className="btn ghost" onClick={() => setCm(null)}>Cancel</button><button className="btn primary" onClick={async () => { setErr(''); try { const r = await apiCall('/api/capas', 'POST', cm); router.push(`/capas/${r.id}`); } catch (x: any) { setErr(x.message); } }}>Create CAPA</button></div></Modal>}
  </>;
}
