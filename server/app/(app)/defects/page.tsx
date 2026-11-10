'use client';
import MasterPage from '@/components/MasterPage';
import { StatusBadge } from '@/components/ui';
const o = (xs: string[]) => xs.map(v => ({ value: v, label: v }));
export default function Defects() {
  return <MasterPage title="Defect codes" endpoint="/api/defects" defaults={{ category: 'DIMENSIONAL', severity: 'MAJOR', active: true }}
    fields={[{ name: 'code', label: 'Code', required: true }, { name: 'name', label: 'Defect', required: true }, { name: 'category', label: 'Category', type: 'select', options: o(['DIMENSIONAL', 'VISUAL', 'FUNCTIONAL', 'MATERIAL', 'PACKING']) },
      { name: 'severity', label: 'Default severity', type: 'select', options: o(['CRITICAL', 'MAJOR', 'MINOR']) }, { name: 'active', label: 'Active', type: 'checkbox' }]}
    columns={[{ key: 'code', label: 'Code', render: r => <b className="mono">{r.code}</b> }, { key: 'name', label: 'Defect' }, { key: 'category', label: 'Category' }, { key: 'severity', label: 'Severity', render: r => <StatusBadge s={r.severity} /> }, { key: 'active', label: 'Active', render: r => (r.active ? 'Yes' : 'No') }]} />;
}
