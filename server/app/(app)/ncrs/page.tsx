'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Field, Modal, Msg, StatusBadge } from '@/components/ui';
import { apiCall, fileToDataUrl, fmtDate, inr, useData } from '@/lib/client';

export default function Ncrs() {
  const router = useRouter();
  const [st, setSt] = useState('OPEN');
  const { data } = useData<any[]>(`/api/ncrs${st ? `?status=${st}` : ''}`);
  const { data: lk } = useData<any>('/api/lookups');
  const [n, setN] = useState<any>(null);
  const [err, setErr] = useState('');

  return (
    <>
      <div className="topbar">
        <h1>Non-conformance reports (NCR)</h1>
        <div className="row">
          <select value={st} onChange={e => setSt(e.target.value)} style={{ width: 170, maxWidth: '100%' }}>
            <option value="OPEN">Open</option>
            <option value="">All</option>
            <option value="DISPOSITIONED">Dispositioned</option>
            <option value="CLOSED">Closed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <button
            className="btn primary"
            onClick={() => setN({ source: 'PROCESS', severity: 'MAJOR', qty_affected: 0 })}
          >
            + Raise NCR
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>NCR</th>
              <th>Raised</th>
              <th>Source</th>
              <th>Title</th>
              <th>Product / lot</th>
              <th>Supplier / customer</th>
              <th>Severity</th>
              <th className="num">Qty</th>
              <th>Disposition</th>
              <th className="num">COPQ</th>
              <th>CAPA</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data?.map(r => (
              <tr key={r.id}>
                <td>
                  <Link href={`/ncrs/${r.id}`}>
                    <b className="mono">{r.ncr_no}</b>
                  </Link>
                </td>
                <td>
                  <div>{fmtDate(r.raised_at)}</div>
                  <div className="muted" style={{ fontSize: 11 }}>
                    {r.age_days} d · {r.raised_by_name}
                  </div>
                </td>
                <td>{r.source.replace(/_/g, ' ')}</td>
                <td>{r.title}</td>
                <td>
                  <div>{r.product_code}</div>
                  {r.lot_no && (
                    <div className="mono muted" style={{ fontSize: 11 }}>
                      {r.lot_no}
                    </div>
                  )}
                </td>
                <td>{r.supplier ?? r.customer ?? '—'}</td>
                <td>
                  <StatusBadge s={r.severity} />
                </td>
                <td className="num">{Number(r.qty_affected).toLocaleString('en-IN')}</td>
                <td>{r.disposition ? r.disposition.replace(/_/g, ' ') : '—'}</td>
                <td className="num">
                  {Number(r.cost_of_poor_quality) ? inr(r.cost_of_poor_quality) : '—'}
                </td>
                <td>
                  {r.capa_id ? (
                    <Link href={`/capas/${r.capa_id}`} className="mono">
                      {r.capa_no}
                    </Link>
                  ) : (
                    '—'
                  )}
                </td>
                <td>
                  <StatusBadge s={r.status} />
                </td>
              </tr>
            ))}
            {data && !data.length && (
              <tr>
                <td colSpan={12} className="muted" style={{ textAlign: 'center', padding: '24px' }}>
                  No NCRs
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {n && lk && (
        <Modal title="Raise non-conformance" onClose={() => setN(null)}>
          <Msg err={err} />
          <div className="form">
            <Field label="Source">
              <select value={n.source} onChange={e => setN({ ...n, source: e.target.value })}>
                {['PROCESS', 'CUSTOMER_COMPLAINT', 'INTERNAL_AUDIT', 'SUPPLIER', 'INSPECTION'].map(s => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Severity">
              <select value={n.severity} onChange={e => setN({ ...n, severity: e.target.value })}>
                {['CRITICAL', 'MAJOR', 'MINOR'].map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Product">
              <select
                value={n.product_id ?? ''}
                onChange={e => setN({ ...n, product_id: e.target.value || null })}
              >
                <option value="">—</option>
                {lk.products.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.code} · {p.name}
                  </option>
                ))}
              </select>
            </Field>
            {n.source === 'CUSTOMER_COMPLAINT' ? (
              <Field label="Customer *">
                <input value={n.customer ?? ''} onChange={e => setN({ ...n, customer: e.target.value })} />
              </Field>
            ) : (
              <Field label="Supplier">
                <select
                  value={n.supplier_id ?? ''}
                  onChange={e => setN({ ...n, supplier_id: e.target.value || null })}
                >
                  <option value="">—</option>
                  {lk.suppliers.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Title *" wide>
              <input value={n.title ?? ''} onChange={e => setN({ ...n, title: e.target.value })} />
            </Field>
            <Field label="What was found *" wide>
              <textarea
                rows={3}
                value={n.description ?? ''}
                onChange={e => setN({ ...n, description: e.target.value })}
              />
            </Field>
            <Field label="Qty affected">
              <input
                type="number"
                value={n.qty_affected}
                onChange={e => setN({ ...n, qty_affected: e.target.value })}
              />
            </Field>
            <Field label="Photo">
              <input
                type="file"
                accept="image/*"
                onChange={async e => {
                  const f = e.target.files?.[0];
                  if (f) setN({ ...n, photo_url: (await fileToDataUrl(f)).url });
                }}
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
                  const r = await apiCall('/api/ncrs', 'POST', n);
                  router.push(`/ncrs/${r.id}`);
                } catch (x: any) {
                  setErr(x.message);
                }
              }}
            >
              Raise NCR
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
