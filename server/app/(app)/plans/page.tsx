'use client';
import Link from 'next/link';
import { useState } from 'react';
import { StatusBadge } from '@/components/ui';
import { fmtDate, useData } from '@/lib/client';
export default function Plans() {
  const [all, setAll] = useState(false); const { data } = useData<any[]>('/api/plans');
  return <><div className="topbar"><h1>Control plans</h1><div className="row"><label className="row"><input type="checkbox" checked={all} onChange={e => setAll(e.target.checked)} style={{ width: 'auto' }} /> show retired versions</label><Link className="btn primary" href="/plans/new">+ New plan</Link></div></div>
    <div className="card" style={{ padding: 0 }}><table><thead><tr><th>Plan</th><th>Ver</th><th>Product</th><th>Stage</th><th>Title</th><th>Sampling</th><th className="num">Ac</th><th className="num">Characteristics</th><th>Approved</th><th>Status</th></tr></thead>
      <tbody>{data?.filter(p => all || p.active).map(p => <tr key={p.id}><td><Link href={`/plans/${p.id}`}><b className="mono">{p.plan_no}</b></Link></td><td>v{p.version}</td><td>{p.product_code}<div className="muted" style={{ fontSize: 11 }}>{p.product_name}</div></td><td><span className="badge">{p.stage}</span></td><td>{p.title}</td>
        <td>{p.sampling_method === 'FIXED' ? `${p.sample_size} pcs` : p.sampling_method === 'PERCENT' ? `${Number(p.sample_percent)}%` : p.sampling_method === 'HUNDRED' ? '100%' : 'ISO 2859-1 L-II'}</td><td className="num">{p.accept_number}</td><td className="num">{p.characteristics}</td>
        <td>{p.approved_by_name ? `${p.approved_by_name} · ${fmtDate(p.approved_at)}` : <span className="badge s-DUE_SOON">awaiting approval</span>}</td><td><StatusBadge s={p.active ? 'ACTIVE' : 'RETIRED'} /></td></tr>)}</tbody></table></div></>;
}
