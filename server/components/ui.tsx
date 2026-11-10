'use client';
import { ReactNode } from 'react';

export const Badge = ({ s }: { s: string }) => <span className={`badge s-${s}`}>{s.replace(/_/g, ' ')}</span>;

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  maxWidth = 720,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: number;
}) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: `min(${maxWidth}px, 100%)` }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h3 className="modal-title">{title}</h3>
            {subtitle && <p className="modal-subtitle">{subtitle}</p>}
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close dialog">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="1" y1="1" x2="13" y2="13" />
              <line x1="1" y1="13" x2="13" y2="1" />
            </svg>
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmModal({
  title = 'Are you sure?',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false,
  onConfirm,
  onClose,
}: {
  title?: string;
  message: string | ReactNode;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal confirm-modal" onClick={e => e.stopPropagation()}>
        <div className="confirm-icon-wrap" style={{ background: danger ? '#FEE2E2' : '#EFF6FF', color: danger ? '#DC2626' : '#2563EB' }}>
          {danger ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          )}
        </div>
        <div className="confirm-content">
          <h4 style={{ margin: '0 0 6px 0', fontSize: 16, fontWeight: 700, color: '#0F172A' }}>{title}</h4>
          <div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5 }}>{message}</div>
        </div>
        <div className="confirm-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            {cancelText}
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'danger' : 'primary'}`}
            onClick={async () => {
              await onConfirm();
              onClose();
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
  wide,
  required,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
  required?: boolean;
}) {
  const isReq = required || label.endsWith('*');
  const cleanLabel = isReq && label.endsWith('*') ? label.replace(/\s*\*$/, '') : label;
  return (
    <div className={`field-group ${wide ? 'field-wide' : ''}`}>
      <label className="field-label">
        <span>{cleanLabel}</span>
        {isReq && <span className="field-req" title="Required field">*</span>}
      </label>
      <div className="field-control-wrap">{children}</div>
    </div>
  );
}

export const Msg = ({ err, ok }: { err?: string; ok?: string }) => (
  <>
    {err && (
      <div className="err" role="alert">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>{err}</span>
      </div>
    )}
    {ok && (
      <div className="ok" role="status">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span>{ok}</span>
      </div>
    )}
  </>
);

/** Simple account / party pickers built from /api/lookups */
export function AccountSelect({ accounts, value, onChange, filter, required }: { accounts: any[]; value: any; onChange: (v: string) => void; filter?: (a: any) => boolean; required?: boolean }) {
  const list = filter ? accounts.filter(filter) : accounts;
  const groups = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'].map(t => [t, list.filter(a => a.type === t)] as const).filter(([, l]) => l.length);
  return (
    <select required={required} value={value ?? ''} onChange={e => onChange(e.target.value)}>
      <option value="">— account —</option>
      {groups.map(([t, l]) => (
        <optgroup key={t} label={t}>
          {l.map((a: any) => (
            <option key={a.id} value={a.id}>
              {a.code} · {a.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export const StatusBadge = ({ s }: { s?: string | null }) => (s ? <span className={`badge s-${s}`}>{s.replace(/_/g, ' ')}</span> : null);

