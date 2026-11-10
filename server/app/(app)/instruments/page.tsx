'use client';
import { useState } from 'react';
import MasterPage from '@/components/MasterPage';
import { Field, Modal, Msg, StatusBadge } from '@/components/ui';
import { apiCall, fmtDate, todayStr, useData } from '@/lib/client';
export default function Instruments() {
  const [cal, setCal] = useState<any>(null); const [k, setK] = useState(0); const [err, setErr] = useState('');
  const { data: hist } = useData<any[]>(cal ? `/api/instruments/${cal.inst.id}/calibrations` : null);
  return <><MasterPage key={k} title="Gauges & instruments" endpoint="/api/instruments" defaults={{ calibration_interval_days: 365 }}
    fields={[{ name: 'code', label: 'Gauge ID', required: true }, { name: 'name', label: 'Name', required: true }, { name: 'type', label: 'Type', required: true }, { name: 'make', label: 'Make' }, { name: 'serial_no', label: 'Serial no.' },
      { name: 'range_text', label: 'Range' }, { name: 'least_count', label: 'Least count' }, { name: 'location', label: 'Location' }, { name: 'calibration_interval_days', label: 'Calibration interval (days)', type: 'number' }, { name: 'out_of_service', label: 'Out of service', type: 'checkbox' }]}
    columns={[{ key: 'code', label: 'Gauge', render: r => <b className="mono">{r.code}</b> }, { key: 'name', label: 'Name', render: r => <>{r.name}<div className="muted" style={{ fontSize: 11 }}>{r.type} · {r.range_text ?? ''} · LC {r.least_count ?? '—'}</div></> },
      { key: 'location', label: 'Location' }, { key: 'last_calibrated', label: 'Last calibrated', render: r => fmtDate(r.last_calibrated) }, { key: 'next_due', label: 'Next due', render: r => fmtDate(r.next_due) },
      { key: 'days_left', label: 'Days left', num: true, render: r => r.days_left == null ? '—' : <span className={r.days_left < 0 ? 'out' : r.days_left <= 30 ? 'warn' : ''}>{r.days_left}</span> },
      { key: 'cal_status', label: 'Status', render: r => <StatusBadge s={r.cal_status} /> },
      { key: 'x', label: '', render: r => <button className="btn sm" onClick={() => setCal({ inst: r, f: { calibrated_on: todayStr(), result: 'PASS', agency: 'NABL Lab', certificate_no: '' } })}>Calibration</button> }]} />
    {cal && <Modal title={`Calibration — ${cal.inst.code} ${cal.inst.name}`} onClose={() => setCal(null)}><Msg err={err} /><div className="form">
      <Field label="Calibrated on"><input type="date" max={todayStr()} value={cal.f.calibrated_on} onChange={e => setCal({ ...cal, f: { ...cal.f, calibrated_on: e.target.value } })} /></Field>
      <Field label="Result"><select value={cal.f.result} onChange={e => setCal({ ...cal, f: { ...cal.f, result: e.target.value } })}><option>PASS</option><option>ADJUSTED</option><option value="FAIL">FAIL (takes gauge out of service)</option></select></Field>
      <Field label="Agency"><input value={cal.f.agency} onChange={e => setCal({ ...cal, f: { ...cal.f, agency: e.target.value } })} /></Field>
      <Field label="Certificate no."><input value={cal.f.certificate_no} onChange={e => setCal({ ...cal, f: { ...cal.f, certificate_no: e.target.value } })} /></Field>
      <Field label="Error found" wide><input value={cal.f.error_found ?? ''} onChange={e => setCal({ ...cal, f: { ...cal.f, error_found: e.target.value } })} /></Field></div>
      <div className="modal-footer"><button type="button" className="btn ghost" onClick={() => setCal(null)}>Cancel</button><button className="btn primary" onClick={async () => { setErr(''); try { await apiCall(`/api/instruments/${cal.inst.id}/calibrations`, 'POST', cal.f); setCal(null); setK(k + 1); } catch (x: any) { setErr(x.message); } }}>Record calibration</button></div>
      <h4 style={{ marginTop: 24, marginBottom: 8, fontSize: 14 }}>Calibration History</h4><table style={{ border: '1px solid #E2E8F0', borderRadius: 8 }}><thead><tr><th>Date</th><th>Agency</th><th>Certificate</th><th>Result</th><th>Next due</th><th>Error</th></tr></thead>
        <tbody>{hist?.map(h => <tr key={h.id}><td>{fmtDate(h.calibrated_on)}</td><td>{h.agency}</td><td className="mono">{h.certificate_no}</td><td><StatusBadge s={h.result} /></td><td>{fmtDate(h.next_due)}</td><td className="muted">{h.error_found}</td></tr>)}</tbody></table></Modal>}</>;
}
