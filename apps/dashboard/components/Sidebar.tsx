'use client';
import { useState } from 'react';
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
  Menu,
  X,
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
  const [open, setOpen] = useState(false);
  const items = NAV.filter((n) => can(role, n.perm));

  const panel = (
    <>
      <div className="flex items-center justify-between border-b px-4 py-4">
        <div>
          <div className="text-sm font-semibold">Big Ventures</div>
          <div className="text-xs text-muted">Fleet Intelligence</div>
        </div>
        <button className="p-1 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
          <X size={18} />
        </button>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {items.map((n) => {
          const active = n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
          const Icon = n.icon;
          return (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-2 rounded-md px-3 py-2.5 text-sm ${
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
        <div className="capitalize text-muted">{role}</div>
        <button
          className="mt-2 text-muted hover:text-fg"
          type="button"
          onClick={() => signOut().then(() => (window.location.href = '/login'))}
        >
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-surface px-4 py-3 lg:hidden">
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="-m-2 p-2">
          <Menu size={20} />
        </button>
        <span className="text-sm font-semibold">Big Ventures</span>
      </header>

      {/* mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-72 max-w-[85%] flex-col bg-surface shadow-xl">
            {panel}
          </aside>
        </div>
      )}

      {/* desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-surface lg:flex">{panel}</aside>
    </>
  );
}
