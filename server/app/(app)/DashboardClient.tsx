'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useData } from '@/lib/client';
import { FpyTrend, Pareto } from '@/components/QCharts';

const n = (v: any) => Number(v ?? 0).toLocaleString('en-IN');
const cpkClass = (c: number | null) => (c == null ? '' : c >= 1.33 ? 'check' : c >= 1 ? '' : 'cross');

export default function DashboardClient({ initialData }: { initialData?: any }) {
  const { data: liveData, error, reload } = useData<any>('/api/reports/dashboard');
  const d = liveData ?? initialData;

  if (error && !d) {
    return (
      <div className="card" style={{ padding: 24, margin: '20px 0' }}>
        <div className="err" style={{ marginBottom: 12 }}>
          Failed to load dashboard data: {error}
        </div>
        <button className="btn primary" onClick={reload}>
          Retry
        </button>
      </div>
    );
  }

  if (!d) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', color: '#64748B' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 500 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
            <line x1="12" y1="2" x2="12" y2="6" />
            <line x1="12" y1="18" x2="12" y2="22" />
            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
            <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
            <line x1="2" y1="12" x2="6" y2="12" />
            <line x1="18" y1="12" x2="22" y2="12" />
            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
            <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
          </svg>
          Loading live quality dashboard...
        </div>
      </div>
    );
  }

  const paretoSub = d.pareto?.length
    ? `${d.pareto.filter((p: any) => p.cum_pct <= 80).map((p: any) => `${p.code} ${p.name}`).join(', ') || d.pareto[0]?.name} account for ~80% of defects.`
    : 'No defects recorded in period.';

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Quality dashboard</h1>
          <span className="muted">
            {d.org?.name || 'Precision Auto Components Pvt Ltd'} · {d.org?.certifications || 'ISO 9001:2015 · IATF 16949:2016'} · last 30 days
          </span>
        </div>
        <div className="row">
          <button
            type="button"
            className="btn ghost"
            onClick={reload}
            title="Refresh dashboard metrics"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.19" />
            </svg>
            Refresh
          </button>
          <Link className="btn" href="/ncrs">
            + NCR
          </Link>
          <Link className="btn primary" href="/lots">
            Inspection queue ({n(d.queue?.pending)})
          </Link>
        </div>
      </div>

      {Number(d.calibration?.overdue) > 0 && (
        <div className="err">
          {d.calibration?.overdue} gauge(s) overdue for calibration — they are blocked from use.{' '}
          <Link href="/instruments" style={{ textDecoration: 'underline', fontWeight: 600 }}>
            Review →
          </Link>
        </div>
      )}
      {Number(d.capas?.overdue_actions) > 0 && (
        <div className="warn">
          {d.capas?.overdue_actions} CAPA action(s) overdue.{' '}
          <Link href="/capas" style={{ textDecoration: 'underline', fontWeight: 600 }}>
            Review →
          </Link>
        </div>
      )}

      {/* KPI Cards (Matches Page 16) */}
      <div className="grid g5" style={{ marginBottom: 14 }}>
        <div className="card kpi">
          <div className="label">First-pass yield</div>
          <div className={`val ${d.fpy != null && d.fpy < 95 ? 'out' : 'in'}`}>
            {d.fpy != null ? Number(d.fpy).toFixed(1) : '—'}%
          </div>
          <div className="sub">
            {n(d.kpi?.first_pass)} of {n(d.kpi?.first_inspections)} lots passed first time
          </div>
        </div>

        <div className="card kpi">
          <div className="label">Defective PPM (sampled units)</div>
          <div className="val">{n(d.ppm_sample)}</div>
          <div className="sub">
            {n(d.kpi?.failed)} lots failed of {n(d.kpi?.inspections)}
          </div>
        </div>

        <div className="card kpi">
          <div className="label">Lots waiting / on hold</div>
          <div className="val">
            {n(d.queue?.pending)} / <span className={Number(d.queue?.on_hold) > 0 ? 'out' : ''}>{n(d.queue?.on_hold)}</span>
          </div>
          <div className="sub">
            <Link href="/lots">Queue →</Link>
          </div>
        </div>

        <div className="card kpi">
          <div className="label">Open NCRs</div>
          <div className="val">{n(d.ncrs?.open)}</div>
          <div className="sub">
            <span className="out">{n(d.ncrs?.critical)} critical</span> · {n(d.ncrs?.complaints_90d)} customer complaints (90d)
          </div>
        </div>

        <div className="card kpi">
          <div className="label">Open CAPAs</div>
          <div className="val">{n(d.capas?.open)}</div>
          <div className="sub">
            {n(d.capas?.overdue)} past target · {n(d.capas?.overdue_actions)} actions overdue
          </div>
        </div>
      </div>

      <div className="grid g2-narrow" style={{ marginBottom: 14 }}>
        <div className="card kpi">
          <div className="label">Cost of poor quality (90d)</div>
          <div className="val">₹{n(d.ncrs?.copq_90d)}</div>
          <div className="sub">rework · scrap · sorting · returns</div>
        </div>

        <div className="card kpi">
          <div className="label">Gauges</div>
          <div className="val">{n(d.calibration?.total)}</div>
          <div className="sub">
            <span className="out">{n(d.calibration?.overdue)} overdue</span> · {n(d.calibration?.due_soon)} due in 30 days
          </div>
        </div>
      </div>

      {/* Row of Charts (Matches Page 16) */}
      <div className="grid g2">
        <div className="card">
          <h3>First-pass yield by week</h3>
          <FpyTrend rows={d.weekly as any} />
        </div>

        <div className="card">
          <h3>Defect Pareto (90 days)</h3>
          <Pareto rows={d.pareto as any} />
          <p className="muted">{paretoSub}</p>
        </div>
      </div>

      {/* Row of Tables (Matches Page 16) */}
      <div className="grid g2">
        <div className="card">
          <h3>Process capability — SPC characteristics</h3>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Characteristic</th>
                <th>Spec</th>
                <th className="num">Cpk</th>
                <th className="num">Ppk</th>
                <th className="num">Signals</th>
              </tr>
            </thead>
            <tbody>
              {d.capability?.map((c: any) => (
                <tr key={c.id}>
                  <td>
                    {c.product_code} <span className="badge">{c.stage}</span>
                  </td>
                  <td>
                    <Link href={`/spc?c=${c.id}`}>{c.name}</Link>
                  </td>
                  <td className="mono">
                    {c.lsl ?? '—'} … {c.usl ?? '—'} {c.unit}
                  </td>
                  <td className={`num ${cpkClass(c.cpk)}`}>
                    <b>{c.cpk != null ? Number(c.cpk).toFixed(4) : '—'}</b>
                  </td>
                  <td className="num">{c.ppk != null ? Number(c.ppk).toFixed(4) : '—'}</td>
                  <td className="num">
                    {c.signals ? <span className="badge s-FAIL">{c.signals}</span> : '0'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted">Cpk ≥ 1.33 capable · 1.00–1.33 marginal · &lt; 1.00 not capable.</p>
        </div>

        <div className="card">
          <h3>Results by inspection stage</h3>
          <table>
            <thead>
              <tr>
                <th>Stage</th>
                <th className="num">Lots</th>
                <th className="num">Failed</th>
                <th className="num">Lot reject %</th>
                <th className="num">Units sampled</th>
                <th className="num">Defective</th>
              </tr>
            </thead>
            <tbody>
              {d.by_stage?.map((x: any) => (
                <tr key={x.stage}>
                  <td>
                    <span className="badge">{x.stage}</span>
                  </td>
                  <td className="num">{x.lots}</td>
                  <td className="num">{x.failed}</td>
                  <td className="num">
                    {x.lots ? ((100 * x.failed) / x.lots).toFixed(1) : 0}%
                  </td>
                  <td className="num">{n(x.sampled)}</td>
                  <td className="num">{x.defective}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 style={{ marginTop: 18 }}>Supplier quality</h3>
          <table>
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Status</th>
                <th className="num">Lots</th>
                <th className="num">Rejected</th>
                <th className="num">PPM</th>
              </tr>
            </thead>
            <tbody>
              {d.suppliers?.map((x: any) => (
                <tr key={x.supplier_id}>
                  <td>{x.name}</td>
                  <td>
                    <span className={`badge s-${x.approval}`}>{x.approval}</span>
                  </td>
                  <td className="num">{x.lots_inspected}</td>
                  <td className="num">{x.lots_rejected}</td>
                  <td className={`num ${Number(x.ppm) > 0 ? 'out' : ''}`}>
                    <b>{n(x.ppm)}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
