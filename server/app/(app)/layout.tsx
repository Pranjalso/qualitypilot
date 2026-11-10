import { requirePage } from '@/lib/auth';
import { query } from '@/lib/db';
import NavShell, { NavGroup } from '@/components/NavShell';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requirePage();
  const orgs = await query<any>(
    `SELECT o.id, o.name FROM memberships m JOIN organizations o ON o.id=m.org_id WHERE m.user_id=$1`,
    [s.uid]
  );

  const nav: NavGroup[] = [
    {
      header: 'Overview',
      links: [
        { href: '/', label: 'Quality dashboard', icon: 'dashboard' },
      ],
    },
    {
      header: 'Inspection',
      links: [
        { href: '/lots', label: 'Lots & inspection queue', icon: 'lots' },
        { href: '/inspections', label: 'Inspection records', icon: 'inspections' },
      ],
    },
    {
      header: 'Non-conformance',
      links: [
        { href: '/ncrs', label: 'NCR / MRB', icon: 'ncrs' },
        { href: '/capas', label: 'CAPA (8D)', icon: 'capas' },
      ],
    },
    {
      header: 'Analysis',
      links: [
        { href: '/spc', label: 'SPC & capability', icon: 'spc' },
        { href: '/suppliers/quality', label: 'Supplier quality', icon: 'supplier-quality' },
      ],
    },
    {
      header: 'Setup',
      links: [
        { href: '/plans', label: 'Control / inspection plans', icon: 'plans' },
        { href: '/instruments', label: 'Gauges & calibration', icon: 'instruments' },
        { href: '/products', label: 'Products', icon: 'products' },
        { href: '/suppliers', label: 'Suppliers', icon: 'suppliers' },
        { href: '/defects', label: 'Defect codes', icon: 'defects' },
        { href: '/team', label: 'Team', icon: 'team' },
      ],
    },
  ];

  return (
    <NavShell
      orgs={orgs}
      currentOrgId={s.orgId}
      userName={s.name}
      userRole={s.role}
      nav={nav}
    >
      {children}
    </NavShell>
  );
}
