'use client';
import Link from 'next/link';
import { useState } from 'react';
import { StatusBadge } from '@/components/ui';
import { fmtDate, useData } from '@/lib/client';

export default function Inspections() {
  const [f, setF] = useState<any>({ stage: '', result: '' });
  const { data } = useData<any[]>(`/api/inspections?${new URLSearchParams(Object.entries(f).filter(([, v]) => v) as any)}`);

  return (
    <>
      <div className="topbar">
        <h1>Inspection records</h1>
        <div className="row">
          <select
            value={f.stage}
            onChange={e => setF({ ...f, stage: e.target.value })}
            style={{ width: 130, maxWidth: '100%' }}
          >
            <option value="">All stages</option>
            {['IQC', 'IPQC', 'FQC', 'PDI'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={f.result}
            onChange={e => setF({ ...f, result: e.target.value })}
            style={{ width: 130, maxWidth: '100%' }}
          >
            <option value="">All results</option>
            <option value="PASS">PASS</option>
            <option value="FAIL">FAIL</option>
          </select>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Report</th>
              <th>Date</th>
              <th>Stage</th>
              <th>Lot</th>
              <th>Product</th>
              <th>Supplier</th>
              <th>Inspector</th>
              <th className="num">Sample</th>
              <th className="num">Defective</th>
              <th>Result</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data?.map(i => (
              <tr key={i.id}>
                <td>
                  <Link href={`/inspections/${i.id}`}>
                    <b className="mono">{i.insp_no}</b>
                  </Link>
                  {i.is_reinspection && (
                    <div>
                      <span className="badge">re-inspection</span>
                    </div>
                  )}
                </td>
                <td>{fmtDate(i.submitted_at || i.started_at)}</td>
                <td>
                  <span className="badge">{i.stage}</span>
                </td>
                <td>
                  <b className="mono">{i.lot_no}</b>
                </td>
                <td>{i.product_code}</td>
                <td>{i.supplier ?? '—'}</td>
                <td>{i.inspector}</td>
                <td className="num">{Number(i.sample_size).toLocaleString('en-IN')}</td>
                <td className="num">{Number(i.defective_units).toLocaleString('en-IN')}</td>
                <td>
                  <StatusBadge s={i.result} />
                  {i.critical_fail && (
                    <span className="badge s-CRITICAL" style={{ marginLeft: 4 }}>
                      critical
                    </span>
                  )}
                </td>
                <td>
                  <StatusBadge s={i.status} />
                </td>
              </tr>
            ))}
            {data && !data.length && (
              <tr>
                <td colSpan={11} className="muted" style={{ textAlign: 'center', padding: '24px' }}>
                  Nothing here
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
