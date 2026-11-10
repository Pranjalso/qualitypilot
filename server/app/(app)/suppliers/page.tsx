'use client';
import Link from 'next/link';
import MasterPage from '@/components/MasterPage';
import { StatusBadge } from '@/components/ui';
export default function Suppliers() {
  return <MasterPage title="Suppliers" endpoint="/api/suppliers" defaults={{ approval: 'APPROVED' }} extra={<Link className="btn" href="/suppliers/quality">Scorecard</Link>}
    fields={[{ name: 'code', label: 'Code', required: true }, { name: 'name', label: 'Name', required: true }, { name: 'contact', label: 'Contact person' }, { name: 'email', label: 'Email' },
      { name: 'approval', label: 'Approval status', type: 'select', options: ['APPROVED', 'CONDITIONAL', 'BLOCKED'].map(v => ({ value: v, label: v })) }]}
    columns={[{ key: 'code', label: 'Code', render: r => <b className="mono">{r.code}</b> }, { key: 'name', label: 'Name' }, { key: 'contact', label: 'Contact' }, { key: 'email', label: 'Email' }, { key: 'approval', label: 'Approval', render: r => <StatusBadge s={r.approval} /> }]} />;
}
