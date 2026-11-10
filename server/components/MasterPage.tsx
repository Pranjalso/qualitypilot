'use client';
import { useState } from 'react';
import { apiCall, useData } from '@/lib/client';
import { Field, Modal, Msg } from './ui';

export type FieldDef = { name: string; label: string; type?: 'text' | 'number' | 'select' | 'checkbox' | 'date' | 'color'; options?: { value: string | number; label: string }[]; required?: boolean };
export type Col = { key: string; label: string; num?: boolean; render?: (r: any) => React.ReactNode };

export default function MasterPage({ title, endpoint, fields, columns, defaults = {}, canEdit = true, extra, filterRows }:
  { title: string; endpoint: string; fields: FieldDef[]; columns: Col[]; defaults?: any; canEdit?: boolean; extra?: React.ReactNode; filterRows?: (r: any) => boolean }) {
  const { data, error, reload } = useData<any[]>(endpoint);
  const [ed, setEd] = useState<any>(null); const [err, setErr] = useState('');
  async function save(e: React.FormEvent) {
    e.preventDefault(); setErr('');
    const body: any = {}; for (const f of fields) { const v = ed[f.name]; if (f.type === 'checkbox') body[f.name] = !!v; else if (v !== undefined && v !== '') body[f.name] = v; }
    try { const id = ed.id; await apiCall(id ? `${endpoint}/${id}` : endpoint, id ? 'PUT' : 'POST', body); setEd(null); reload(); }
    catch (x: any) { setErr(x.message); }
  }
  return <>
    <div className="topbar"><h1>{title}</h1><div className="row">{extra}{canEdit && <button className="btn primary" onClick={() => setEd({ ...defaults })}>+ New</button>}</div></div>
    <Msg err={error} />
    <div className="card" style={{ padding: 0, overflow: 'auto' }}><table>
      <thead><tr>{columns.map(c => <th key={c.key} className={c.num ? 'num' : ''}>{c.label}</th>)}{canEdit && <th />}</tr></thead>
      <tbody>{(filterRows ? data?.filter(filterRows) : data)?.map((r, i) => <tr key={r.id ?? i}>{columns.map(c => <td key={c.key} className={c.num ? 'num' : ''}>{c.render ? c.render(r) : String(r[c.key] ?? '—')}</td>)}
        {canEdit && <td className="right"><button className="btn sm" onClick={() => setEd({ ...r })}>Edit</button></td>}</tr>)}
        {data && !data.length && <tr><td colSpan={9} className="muted">Nothing here yet</td></tr>}</tbody></table></div>
    {ed && <Modal title={`${ed.id ? 'Edit' : 'New'} ${title.replace(/ies$/, 'y').replace(/s$/, '')}`} onClose={() => setEd(null)}>
      <Msg err={err} />
      <form onSubmit={save}><div className="form">{fields.map(f => <Field key={f.name} label={f.label + (f.required ? ' *' : '')}>
        {f.type === 'select' ? <select required={f.required} value={ed[f.name] ?? ''} onChange={e => setEd({ ...ed, [f.name]: e.target.value })}><option value="">—</option>{f.options!.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
          : f.type === 'checkbox' ? <input type="checkbox" style={{ width: 'auto' }} checked={!!ed[f.name]} onChange={e => setEd({ ...ed, [f.name]: e.target.checked })} />
          : <input type={f.type ?? 'text'} step="any" required={f.required} value={ed[f.name] ?? ''} onChange={e => setEd({ ...ed, [f.name]: e.target.value })} />}
      </Field>)}</div>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}><button type="button" className="btn" onClick={() => setEd(null)}>Cancel</button><button className="btn primary">Save</button></div></form>
    </Modal>}
  </>;
}
