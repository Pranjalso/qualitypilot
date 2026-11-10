'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import SessionBox from './SessionBox';
import { NavIcon } from './NavIcons';

export interface NavItem {
  href: string;
  label: string;
  icon: string;
}

export interface NavGroup {
  header: string;
  links: NavItem[];
}

interface NavShellProps {
  orgs: { id: number; name: string }[];
  currentOrgId: number;
  userName: string;
  userRole: string;
  nav: NavGroup[];
  children: React.ReactNode;
}

export default function NavShell({
  orgs,
  currentOrgId,
  userName,
  userRole,
  nav,
  children,
}: NavShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  // Find active route label for mobile topbar
  let currentTitle = 'QualityPilot';
  for (const g of nav) {
    for (const l of g.links) {
      if (l.href === pathname || (l.href !== '/' && pathname.startsWith(l.href))) {
        currentTitle = l.label;
        break;
      }
    }
  }

  return (
    <div className="app">
      {/* Mobile Sticky Top Header */}
      <header className="mobile-header">
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
        >
          {mobileOpen ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>

        <div className="brand" style={{ padding: 0, fontSize: 18 }}>
          Quality<span>Pilot</span>
        </div>

        <div className="mobile-header-badge">
          <span>{currentTitle}</span>
        </div>
      </header>

      {/* Backdrop overlay for mobile drawer */}
      {mobileOpen && (
        <div
          className="mobile-drawer-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar (Desktop Sticky + Mobile Off-canvas Drawer) */}
      <aside className={`side ${mobileOpen ? 'open' : ''}`}>
        <div className="brand-header">
          <div className="brand">
            Quality<span>Pilot</span>
          </div>
          <span className="live-status-dot" title="System Operational" />
        </div>

        <SessionBox orgs={orgs} current={currentOrgId} name={userName} role={userRole} />

        <div className="nav-groups-wrapper">
          {nav.map((g) => (
            <div key={g.header} className="nav-group">
              <h6>{g.header}</h6>
              {g.links.map(({ href, label, icon }) => {
                const active = pathname === href || (href !== '/' && pathname.startsWith(href));
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`nav-link ${active ? 'active-nav' : ''}`}
                    onClick={() => setMobileOpen(false)}
                  >
                    <span className="nav-icon-wrapper">
                      <NavIcon name={icon} />
                    </span>
                    <span className="nav-text">{label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main">{children}</main>
    </div>
  );
}
