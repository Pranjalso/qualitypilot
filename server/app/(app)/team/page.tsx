'use client';
import { useState } from 'react';
import { Field, Modal, Msg, StatusBadge } from '@/components/ui';
import { apiCall, useData } from '@/lib/client';
const ROLES: Record<string, string> = { ADMIN: 'Everything incl. users', QA_MANAGER: 'Plans, MRB dispositions, approvals, CAPA closure', INSPECTOR: 'Inspect lots, log defects, raise NCRs', PRODUCTION: 'Register lots, raise NCRs, own CAPA actions', VIEWER: 'Read-only dashboards & reports' };
export default function Team() {
  const { data, reload } = useData<any[]>('/api/members'); const { data: me } = useData<any>('/api/auth/me'); const [m, setM] = useState<any>(null); const [err, setErr] = useState('');
  return <><div className="topbar"><h1>Team &amp; roles</h1>{me?.role === 'ADMIN' && <button className="btn primary" onClick={() => setM({ role: 'INSPECTOR' })}>+ Add member</button>}</div>
    <div className="grid g2"><div className="card" style={{ padding: 0 }}><table><thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead>
      <tbody>{data?.map(u => <tr key={u.id}><td><b>{u.name}</b></td><td>{u.email}</td><td><StatusBadge s={u.role} /></td></tr>)}</tbody></table></div>
      <div className="card"><h3>What each role can do</h3><table className="kv"><tbody>{Object.entries(ROLES).map(([k, v]) => <tr key={k}><td><StatusBadge s={k} /></td><td>{v}</td></tr>)}</tbody></table>
        <p className="muted">Segregation of duties is enforced by the server: an inspector cannot approve their own report, the NCR raiser cannot give the disposition, and only QA can close a CAPA.</p></div></div>
    {m && <Modal title="Add member" onClose={() => setM(null)}><Msg err={err} /><div className="form">
      <Field label="Email"><input value={m.email ?? ''} onChange={e => setM({ ...m, email: e.target.value })} /></Field><Field label="Name (new user)"><input value={m.name ?? ''} onChange={e => setM({ ...m, name: e.target.value })} /></Field>
      <Field label="Password (new user)"><input type="password" value={m.password ?? ''} onChange={e => setM({ ...m, password: e.target.value })} /></Field>
      <Field label="Role"><select value={m.role} onChange={e => setM({ ...m, role: e.target.value })}>{Object.keys(ROLES).map(r => <option key={r}>{r}</option>)}</select></Field></div>
      <div className="modal-footer"><button type="button" className="btn ghost" onClick={() => setM(null)}>Cancel</button><button className="btn primary" onClick={async () => { setErr(''); try { await apiCall('/api/members', 'POST', { ...m, password: m.password || undefined, name: m.name || undefined }); setM(null); reload(); } catch (x: any) { setErr(x.message); } }}>Save member</button></div></Modal>}</>;
}
