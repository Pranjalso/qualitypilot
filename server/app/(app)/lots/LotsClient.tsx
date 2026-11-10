'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Field, Modal, Msg, StatusBadge } from '@/components/ui';
import { apiCall, fmtDate, todayStr, useData } from '@/lib/client';

export default function LotsClient({ initialLots, initialLookups, initialUser }: { initialLots?: any[]; initialLookups?: any; initialUser?: any }) {
  const router = useRouter();

  const [statusFilter, setStatusFilter] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const queryParams = new URLSearchParams();
  if (statusFilter) queryParams.set('status', statusFilter);
  if (stageFilter) queryParams.set('stage', stageFilter);
  if (searchQuery.trim()) queryParams.set('q', searchQuery.trim());
  const queryString = queryParams.toString();

  // Pure live database queries - no mock arrays or hardcoded fallbacks
  const { data: liveData, error, reload } = useData<any[]>(`/api/lots${queryString ? `?${queryString}` : ''}`);
  const { data: liveLookups } = useData<any>('/api/lookups');
  const { data: liveUser } = useData<any>('/api/auth/me');

  // Uses data strictly from the database
  const data = liveData ?? (queryString === '' ? (initialLots ?? null) : null);
  const lk = liveLookups ?? initialLookups;
  const me = liveUser ?? initialUser;

  const [nl, setNl] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const canInspect = me && ['ADMIN', 'QA_MANAGER', 'INSPECTOR'].includes(me.role);

  const start = async (id: number) => {
    setErr('');
    try {
      const r = await apiCall(`/api/lots/${id}/inspect`, 'POST');
      router.push(`/inspections/${r.id}`);
    } catch (x: any) {
      setErr(x.message);
    }
  };

  const handleRegister = async () => {
    setErr('');
    if (!nl.product_id) {
      setErr('Please select a product');
      return;
    }
    if (!nl.lot_no?.trim()) {
      setErr('Please enter lot / batch number');
      return;
    }
    if (!nl.quantity || Number(nl.quantity) <= 0) {
      setErr('Please enter a valid quantity');
      return;
    }
    if (nl.source === 'SUPPLIER' && !nl.supplier_id) {
      setErr('Please select a supplier for IQC lots');
      return;
    }

    setSubmitting(true);
    try {
      await apiCall('/api/lots', 'POST', { ...nl, quantity: Number(nl.quantity) });
      setNl(null);
      reload();
    } catch (x: any) {
      setErr(x.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Top Filter and Action Bar */}
      <div className="topbar">
        <div>
          <h1>Lots &amp; inspection queue</h1>
        </div>

        <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ width: 175, maxWidth: '100%' }}
            aria-label="Filter by lot status"
          >
            <option value="">All lots</option>
            <option value="QUEUE">Waiting for inspection</option>
            <option value="ON_HOLD">On hold</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="CONDITIONAL">Conditional</option>
            <option value="REJECTED">Rejected</option>
          </select>

          {/* Stage Filter */}
          <select
            value={stageFilter}
            onChange={e => setStageFilter(e.target.value)}
            style={{ width: 130, maxWidth: '100%' }}
            aria-label="Filter by inspection stage"
          >
            <option value="">All stages</option>
            <option value="IQC">IQC (Incoming)</option>
            <option value="IPQC">IPQC (In-process)</option>
            <option value="FQC">FQC (Final)</option>
            <option value="PDI">PDI (Pre-dispatch)</option>
          </select>

          {/* Search Box */}
          <div style={{ position: 'relative', width: 180, maxWidth: '100%' }}>
            <input
              type="text"
              placeholder="Lot / product"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingRight: searchQuery ? 28 : 12 }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  fontSize: 14,
                  lineHeight: 1,
                  padding: 2,
                }}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Register Lot Button */}
          <button
            type="button"
            className="btn primary"
            onClick={() =>
              setNl({
                stage: 'IPQC',
                source: 'PRODUCTION',
                lot_date: todayStr(),
                shift: 'A',
              })
            }
          >
            + Register lot
          </button>
        </div>
      </div>

      <Msg err={nl ? '' : (err || error)} />

      {/* Lots Table */}
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>LOT</th>
              <th>STAGE</th>
              <th>PRODUCT</th>
              <th>SOURCE</th>
              <th>DATE</th>
              <th className="num">QTY</th>
              <th>STATUS</th>
              <th className="num">ACCEPTED / REJECTED</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data?.map(l => (
              <tr key={l.id}>
                {/* Lot Column */}
                <td>
                  <b className="mono" style={{ fontSize: 13, color: '#0B1F4B' }}>
                    {l.lot_no}
                  </b>
                  {l.grn_no && (
                    <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                      {l.grn_no}
                    </div>
                  )}
                </td>

                {/* Stage Badge */}
                <td>
                  <span className="badge">{l.stage}</span>
                </td>

                {/* Product Code & Name */}
                <td>
                  <div style={{ fontWeight: 600, color: '#1B2440' }}>{l.product_code}</div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 1 }}>
                    {l.product_name}
                  </div>
                </td>

                {/* Source Column: Supplier or Line / Shift */}
                <td style={{ color: '#475070' }}>
                  {l.supplier ?? (l.line ? `${l.line} · shift ${l.shift ?? '—'}` : `Production · shift ${l.shift ?? '—'}`)}
                </td>

                {/* Date */}
                <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(l.lot_date)}</td>

                {/* Qty */}
                <td className="num" style={{ fontWeight: 600 }}>
                  {Number(l.quantity).toLocaleString('en-IN')}
                </td>

                {/* Status Badge */}
                <td>
                  <StatusBadge s={l.status} />
                </td>

                {/* Accepted / Rejected Qty */}
                <td className="num">
                  {['ACCEPTED', 'CONDITIONAL', 'REJECTED'].includes(l.status) ? (
                    <span style={{ fontWeight: 500 }}>
                      {Number(l.accepted_qty ?? 0).toLocaleString('en-IN')} / {Number(l.rejected_qty ?? 0).toLocaleString('en-IN')}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>

                {/* Action Column */}
                <td className="right" style={{ whiteSpace: 'nowrap' }}>
                  {['PENDING', 'IN_INSPECTION'].includes(l.status) && canInspect ? (
                    l.has_plan ? (
                      <button
                        className="btn sm primary"
                        onClick={() => start(l.id)}
                        style={{ padding: '4px 12px', fontWeight: 600 }}
                      >
                        {l.status === 'IN_INSPECTION' ? 'Resume' : 'Inspect'}
                      </button>
                    ) : (
                      <span className="badge s-FAIL" title="No approved active plan found">
                        no plan
                      </span>
                    )
                  ) : l.last_inspection_id ? (
                    <Link
                      className="btn sm"
                      href={`/inspections/${l.last_inspection_id}`}
                      style={{ padding: '4px 12px' }}
                    >
                      Report
                    </Link>
                  ) : null}
                </td>
              </tr>
            ))}

            {data && !data.length && (
              <tr>
                <td colSpan={9} className="muted" style={{ textAlign: 'center', padding: '36px' }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#64748B' }}>
                    No lots found in database matching criteria
                  </div>
                  {(statusFilter || stageFilter || searchQuery) && (
                    <button
                      type="button"
                      className="btn ghost sm"
                      onClick={() => {
                        setStatusFilter('');
                        setStageFilter('');
                        setSearchQuery('');
                      }}
                      style={{ marginTop: 8 }}
                    >
                      Clear filters
                    </button>
                  )}
                </td>
              </tr>
            )}

            {!data && (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '32px', color: '#64748B' }}>
                  Loading lots from database...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Dialog: Register Lot for Inspection */}
      {nl && lk && (
        <Modal
          title="Register lot for inspection"
          subtitle="Add incoming, in-process, or final lot to the inspection queue"
          onClose={() => !submitting && setNl(null)}
          maxWidth={700}
        >
          <Msg err={err} />
          <div className="form">
            <Field label="Stage" required>
              <select
                value={nl.stage}
                disabled={submitting}
                onChange={e =>
                  setNl({
                    ...nl,
                    stage: e.target.value,
                    source: e.target.value === 'IQC' ? 'SUPPLIER' : 'PRODUCTION',
                  })
                }
              >
                <option value="IQC">IQC — incoming material</option>
                <option value="IPQC">IPQC — in-process</option>
                <option value="FQC">FQC — final</option>
                <option value="PDI">PDI — pre-dispatch</option>
              </select>
            </Field>

            <Field label="Product *" required>
              <select
                value={nl.product_id ?? ''}
                disabled={submitting}
                onChange={e => setNl({ ...nl, product_id: Number(e.target.value) })}
              >
                <option value="">— Select product —</option>
                {lk.products.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.code} · {p.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Lot / batch no. *" required>
              <input
                value={nl.lot_no ?? ''}
                disabled={submitting}
                placeholder="e.g. DS-200-261110-001"
                onChange={e => setNl({ ...nl, lot_no: e.target.value })}
              />
            </Field>

            <Field label="Quantity *" required>
              <input
                type="number"
                min={1}
                value={nl.quantity ?? ''}
                disabled={submitting}
                placeholder="Number of units"
                onChange={e => setNl({ ...nl, quantity: e.target.value })}
              />
            </Field>

            <Field label="Date">
              <input
                type="date"
                value={nl.lot_date}
                disabled={submitting}
                onChange={e => setNl({ ...nl, lot_date: e.target.value })}
              />
            </Field>

            {nl.source === 'SUPPLIER' ? (
              <>
                <Field label="Supplier *" required>
                  <select
                    value={nl.supplier_id ?? ''}
                    disabled={submitting}
                    onChange={e => setNl({ ...nl, supplier_id: Number(e.target.value) })}
                  >
                    <option value="">— Select supplier —</option>
                    {lk.suppliers.map((s: any) => (
                      <option key={s.id} value={s.id} disabled={s.approval === 'BLOCKED'}>
                        {s.name}
                        {s.approval !== 'APPROVED' ? ` (${s.approval})` : ''}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="GRN no.">
                  <input
                    value={nl.grn_no ?? ''}
                    disabled={submitting}
                    placeholder="e.g. GRN-159"
                    onChange={e => setNl({ ...nl, grn_no: e.target.value })}
                  />
                </Field>

                <Field label="Supplier invoice">
                  <input
                    value={nl.supplier_invoice ?? ''}
                    disabled={submitting}
                    placeholder="Invoice reference"
                    onChange={e => setNl({ ...nl, supplier_invoice: e.target.value })}
                  />
                </Field>
              </>
            ) : (
              <>
                <Field label="Line">
                  <select
                    value={nl.line_id ?? ''}
                    disabled={submitting}
                    onChange={e => setNl({ ...nl, line_id: Number(e.target.value) })}
                  >
                    <option value="">— Select line —</option>
                    {lk.lines?.map((l: any) => (
                      <option key={l.id} value={l.id}>
                        {l.code} · {l.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Work order">
                  <select
                    value={nl.work_order_id ?? ''}
                    disabled={submitting}
                    onChange={e => setNl({ ...nl, work_order_id: Number(e.target.value) })}
                  >
                    <option value="">— Select work order —</option>
                    {lk.work_orders
                      ?.filter((w: any) => !nl.product_id || w.product_id === nl.product_id)
                      .map((w: any) => (
                        <option key={w.id} value={w.id}>
                          {w.wo_no}
                        </option>
                      ))}
                  </select>
                </Field>

                <Field label="Shift">
                  <select
                    value={nl.shift}
                    disabled={submitting}
                    onChange={e => setNl({ ...nl, shift: e.target.value })}
                  >
                    {['A', 'B', 'C'].map(s => (
                      <option key={s} value={s}>
                        Shift {s}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn ghost"
              disabled={submitting}
              onClick={() => setNl(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={submitting}
              onClick={handleRegister}
            >
              {submitting ? 'Registering lot...' : 'Register lot'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
