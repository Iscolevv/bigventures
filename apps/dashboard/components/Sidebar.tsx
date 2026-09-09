'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Truck,
  Users,
  Route,
  Fuel,
  Wallet,
  Receipt,
  FileText,
  TriangleAlert,
  BarChart3,
  Coins,
  ScrollText,
  Settings,
} from 'lucide-react';
import type { AppRole } from '@/lib/auth';
import { can } from '@bv/core/rbac';
import { signOut } from '@/lib/auth-client';

const NAV: Array<{ href: string; label: string; icon: typeof Truck; perm: Parameters<typeof can>[1] }> = [
  { href: '/', label: 'Overview', icon: LayoutDashboard, perm: 'report:read' },
  { href: '/fleet', label: 'Fleet', icon: Truck, perm: 'vehicle:read' },
  { href: '/drivers', label: 'Drivers', icon: Users, perm: 'driver:read' },
  { href: '/trips', label: 'Trips', icon: Route, perm: 'trip:read' },
  { href: '/fuel', label: 'Fuel & consumption', icon: Fuel, perm: 'fuel:read' },
  { href: '/costs', label: 'Costs & advances', icon: Wallet, perm: 'cost:read' },
  { href: '/roi', label: 'ROI & routes', icon: BarChart3, perm: 'report:read' },
  { href: '/incentives', label: 'Incentives', icon: Coins, perm: 'payroll:read' },
  { href: '/invoicing', label: 'Invoicing', icon: Receipt, perm: 'invoice:read' },
  { href: '/documents', label: 'Documents', icon: FileText, perm: 'document:read' },
  { href: '/alerts', label: 'Alerts', icon: TriangleAlert, perm: 'alert:read' },
  { href: '/audit', label: 'Audit trail', icon: ScrollText, perm: 'audit:read' },
  { href: '/settings', label: 'Settings', icon: Settings, perm: 'settings:read' },
];

export function Sidebar({ role, name }: { role: AppRole; name: string }) {
  const pathname = usePathname();
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r bg-surface">
      <div className="border-b px-4 py-4">
        <div className="text-sm font-semibold">Big Ventures</div>
        <div className="text-xs text-muted">Fleet Intelligence</div>
      </div>
      <nav className="flex-1 space-y-0.5 p-2">
        {NAV.filter((n) => can(role, n.perm)).map((n) => {
          const active = n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
          const Icon = n.icon;
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                active ? 'bg-brand/10 font-medium text-brand' : 'text-fg hover:bg-bg'
              }`}
            >
              <Icon size={16} />
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t px-4 py-3 text-xs">
        <div className="font-medium">{name}</div>
        <div className="text-muted capitalize">{role}</div>
        <button
          className="mt-2 text-muted hover:text-fg"
          type="button"
          onClick={() => signOut().then(() => (window.location.href = '/login'))}
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
