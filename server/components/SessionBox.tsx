'use client';
import { apiCall } from '@/lib/client';

export default function SessionBox({
  orgs,
  current,
  name,
  role,
}: {
  orgs: any[];
  current: number;
  name: string;
  role: string;
}) {
  // Extract user initials (e.g., "Sunita Rao" -> "SR", "Plant Head" -> "PH")
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

  return (
    <div className="session-container">
      {/* Plant Selector */}
      <div className="plant-select-wrapper">
        <select
          value={current}
          aria-label="Select organization / plant"
          onChange={async (e) => {
            await apiCall('/api/auth/switch', 'POST', { org_id: Number(e.target.value) });
            location.href = '/';
          }}
        >
          {orgs.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <span className="plant-select-chevron" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </div>

      {/* User Profile Card */}
      <div className="user-profile-card">
        <div className="user-avatar-circle" title={name}>
          {initials || 'U'}
        </div>
        <div className="user-info-text">
          <div className="user-name" title={name}>
            {name}
          </div>
          <div className="user-role-badge">
            {role.replace(/_/g, ' ')}
          </div>
        </div>
      </div>

      {/* Sign Out Link with Icon */}
      <div className="signout-row">
        <button
          type="button"
          className="signout-btn"
          onClick={async () => {
            try {
              await apiCall('/api/auth/logout', 'POST');
            } catch (err) {
              console.error('Logout error:', err);
            } finally {
              window.location.href = '/login';
            }
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sign out
        </button>
      </div>
    </div>
  );
}
