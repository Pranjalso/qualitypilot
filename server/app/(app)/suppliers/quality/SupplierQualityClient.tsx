'use client';

import { useData } from '@/lib/client';
import { StatusBadge } from '@/components/ui';

const n = (v: any) => Number(v ?? 0).toLocaleString('en-IN');

function rating(r: any) {
  const ppm = Number(r.ppm || 0);
  const inspected = Number(r.lots_inspected || 0);
  const rejected = Number(r.lots_rejected || 0);
  const lotRejPct = inspected > 0 ? (rejected / inspected) * 100 : 0;
  const openNcrs = Number(r.open_ncrs || 0);

  const ppmPenalty = Math.min(60, ppm / 500);
  const score = Math.max(0, Math.round(100 - ppmPenalty - lotRejPct - openNcrs * 5));
  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : 'D';
  return { score, grade };
}

export default function SupplierQualityClient({ initialData }: { initialData?: any[] }) {
  const { data: liveData, error, reload } = useData<any[]>('/api/reports/suppliers');
  const data = liveData ?? initialData;

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Supplier quality scorecard</h1>
        </div>
        <button
          type="button"
          className="btn ghost"
          onClick={reload}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.19" />
          </svg>
          Refresh
        </button>
      </div>

      <p className="muted" style={{ margin: '4px 0 16px', lineHeight: 1.45 }}>
        PPM = rejected quantity per million received after incoming inspection. Score = 100 − PPM/500 (max 60) − lot rejection % − 5 per open NCR. Grade D suppliers should be put on CONDITIONAL or BLOCKED approval.
      </p>

      {error && <div className="err">Error loading supplier metrics: {error}</div>}

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Supplier</th>
              <th>Approval</th>
              <th className="num">Lots inspected</th>
              <th className="num">Lots rejected</th>
              <th className="num">Qty received</th>
              <th className="num">Qty rejected</th>
              <th className="num">PPM</th>
              <th className="num">Open NCRs</th>
              <th className="num">Score</th>
              <th className="num">Grade</th>
            </tr>
          </thead>
          <tbody>
            {data?.map(r => {
              const { score, grade } = rating(r);
              const isPpmOut = Number(r.ppm) > 0;
              const isScoreLow = score < 75;

              return (
                <tr key={r.supplier_id}>
                  <td>
                    <b>{r.name}</b>
                    <div className="muted mono" style={{ fontSize: 11 }}>
                      {r.code}
                    </div>
                  </td>
                  <td>
                    <StatusBadge s={r.approval} />
                  </td>
                  <td className="num">{n(r.lots_inspected)}</td>
                  <td className="num">{n(r.lots_rejected)}</td>
                  <td className="num">{n(r.qty_received)}</td>
                  <td className="num">{n(r.qty_rejected)}</td>
                  <td className={`num ${isPpmOut ? 'out' : ''}`}>
                    <b>{n(r.ppm)}</b>
                  </td>
                  <td className={`num ${Number(r.open_ncrs) > 0 ? 'out' : ''}`}>
                    {r.open_ncrs}
                  </td>
                  <td className={`num ${isScoreLow ? 'out' : 'in'}`}>
                    <b>{score}</b>
                  </td>
                  <td className="num">
                    <span
                      className={`badge ${
                        grade === 'A'
                          ? 's-ACCEPTED'
                          : grade === 'B'
                          ? 's-PASS'
                          : grade === 'C'
                          ? 's-CONDITIONAL'
                          : 's-REJECTED'
                      }`}
                    >
                      Grade {grade}
                    </span>
                  </td>
                </tr>
              );
            })}

            {data && !data.length && (
              <tr>
                <td colSpan={10} className="muted" style={{ textAlign: 'center', padding: '24px' }}>
                  No supplier inspection records found in database
                </td>
              </tr>
            )}

            {!data && (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '24px', color: '#64748B' }}>
                  Loading supplier scorecard...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

