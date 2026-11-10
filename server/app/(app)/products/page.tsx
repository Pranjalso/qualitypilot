'use client';
import MasterPage from '@/components/MasterPage';
export default function Products() {
  return <MasterPage title="Products" endpoint="/api/products" defaults={{ revision: 'A', uom: 'NOS', active: true }}
    fields={[{ name: 'code', label: 'Part no.', required: true }, { name: 'name', label: 'Description', required: true }, { name: 'drawing_no', label: 'Drawing no.' }, { name: 'revision', label: 'Revision' },
      { name: 'uom', label: 'UoM' }, { name: 'category', label: 'Category' }, { name: 'customer', label: 'Customer' }, { name: 'active', label: 'Active', type: 'checkbox' }]}
    columns={[{ key: 'code', label: 'Part no.', render: r => <b className="mono">{r.code}</b> }, { key: 'name', label: 'Description' }, { key: 'drawing_no', label: 'Drawing', render: r => `${r.drawing_no ?? '—'} rev ${r.revision}` },
      { key: 'category', label: 'Category' }, { key: 'customer', label: 'Customer' }, { key: 'active', label: 'Active', render: r => (r.active ? 'Yes' : 'No') }]} />;
}
