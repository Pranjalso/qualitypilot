'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Field, Modal, Msg, StatusBadge } from '@/components/ui';
import { apiCall, fmtDate, todayStr, useData } from '@/lib/client';

const STEPS = ['OPEN', 'CONTAINMENT', 'ROOT_CAUSE', 'ACTIONS', 'VERIFICATION', 'CLOSED'];

export default function Capas() {
  const router = useRouter();
  const [st, setSt] = useState('OPEN');
  const { data, reload } = useData<any[]>(`/api/capas${st ? `?status=${st}` : ''}`);
  const { data: me } = useData<any>('/api/auth/me');
  const { data: lk } = useData<any>('/api/lookups');
  const [n, setN] = useState<any>(null);
  const [err, setErr] = useState('');
  const canCreate = me && ['ADMIN', 'QA_MANAGER'].includes(me.role);

  return (
    <>
      <div className="topbar">
        <h1>CAPA — 8D corrective &amp; preventive actions</h1>
        <div className="row">
          <select value={st} onChange={e => setSt(e.target.value)} style={{ width: 150, maxWidth: '100%' }}>
            <option value="OPEN">Open</option>
            <option value="">All</option>
            <option value="CLOSED">Closed</option>
          </select>
          {canCreate && (
            <button
              className="btn primary"
              onClick={() =>
                setN({
                  type: 'CORRECTIVE',
                  owner_id: me?.id,
                  target_date: todayStr(),
                  problem: '',
                  title: '',
                })
              }
            >
              + New CAPA
            </button>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>CAPA</th>
              <th>Title</th>
              <th>Type</th>
              <th>Owner</th>
              <th>Linked NCRs</th>
              <th>Progress</th>
              <th className="num">Actions</th>
              <th>Target</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data?.map(c => {
              const i = STEPS.indexOf(c.status);
              const ncrsList = c.ncrs ? c.ncrs.split(',').map((x: string) => x.trim()) : [];
              return (
                <tr key={c.id}>
                  <td>
                    <Link href={`/capas/${c.id}`}>
                      <b className="mono">{c.capa_no}</b>
                    </Link>
                  </td>
                  <td>{c.title}</td>
                  <td>{c.type}</td>
                  <td>{c.owner}</td>
                  <td className="mono" style={{ fontSize: 11 }}>
                    {ncrsList.length > 0 ? (
                      <div className="row" style={{ gap: 4 }}>
                        {ncrsList.map((ncrNo: string) => (
                          <span key={ncrNo} className="badge">
                            {ncrNo}
                          </span>
                        ))}
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                      <div className="bar-bg" style={{ width: 110 }}>
                        <div
                          className="bar"
                          style={{
                            width: `${Math.max(8, (i / 5) * 100)}%`,
                            background: c.status === 'CLOSED' ? 'var(--teal)' : 'var(--indigo)',
                          }}
                        />
                      </div>
                      <span className="muted" style={{ fontSize: 11, minWidth: 24 }}>
                        {i}/5
                      </span>
                    </div>
                  </td>
                  <td className="num">
                    {c.actions}
                    {Number(c.overdue_actions) > 0 && (
                      <span className="badge s-FAIL" style={{ marginLeft: 6 }}>
                        {c.overdue_actions} late
                      </span>
                    )}
                  </td>
                  <td className={c.overdue ? 'out' : ''}>{fmtDate(c.target_date)}</td>
                  <td>
                    <StatusBadge s={c.status} />
                  </td>
                </tr>
              );
            })}
            {data && !data.length && (
              <tr>
                <td colSpan={9} className="muted" style={{ textAlign: 'center', padding: '24px' }}>
                  No CAPAs
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {n && lk && (
        <Modal title="Create 8D CAPA" onClose={() => setN(null)}>
          <Msg err={err} />
          <div className="form">
            <Field label="Title *" wide>
              <input value={n.title ?? ''} onChange={e => setN({ ...n, title: e.target.value })} />
            </Field>
            <Field label="Type">
              <select value={n.type} onChange={e => setN({ ...n, type: e.target.value })}>
                <option value="CORRECTIVE">Corrective action</option>
                <option value="PREVENTIVE">Preventive action</option>
              </select>
            </Field>
            <Field label="Owner *">
              <select
                value={n.owner_id ?? ''}
                onChange={e => setN({ ...n, owner_id: Number(e.target.value) })}
              >
                <option value="">—</option>
                {lk.members?.map((m: any) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.role})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Target date *">
              <input
                type="date"
                value={n.target_date ?? ''}
                onChange={e => setN({ ...n, target_date: e.target.value })}
              />
            </Field>
            <Field label="Problem statement (what, where, when, how many)" wide>
              <textarea
                rows={3}
                value={n.problem ?? ''}
                onChange={e => setN({ ...n, problem: e.target.value })}
              />
            </Field>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn ghost" onClick={() => setN(null)}>
              Cancel
            </button>
            <button
              className="btn primary"
              onClick={async () => {
                setErr('');
                try {
                  const r = await apiCall('/api/capas', 'POST', n);
                  setN(null);
                  router.push(`/capas/${r.id}`);
                } catch (x: any) {
                  setErr(x.message);
                }
              }}
            >
              Create CAPA
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
