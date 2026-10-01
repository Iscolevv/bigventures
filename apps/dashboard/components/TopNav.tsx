'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Truck,
  Users,
  Route,
  Wallet,
  Receipt,
  FileText,
  BarChart3,
  ScrollText,
  Settings,
  ClipboardCheck,
  Sheet,
  Building2,
  UserCog,
  CheckCheck,
  LogOut,
} from 'lucide-react';
import type { AppRole } from '@/lib/auth';
import { can } from '@bv/core/rbac';
import { signOut } from '@/lib/auth-client';

const NAV: Array<{ href: string; label: string; icon: typeof Truck; perm: Parameters<typeof can>[1] }> = [
  { href: '/', label: 'Overview', icon: LayoutDashboard, perm: 'report:read' },
  { href: '/approvals', label: 'Approvals', icon: CheckCheck, perm: 'trip:approve' },
  { href: '/fleet', label: 'Fleet', icon: Truck, perm: 'vehicle:read' },
  { href: '/drivers', label: 'Drivers', icon: Users, perm: 'driver:read' },
  { href: '/weekly', label: 'Income sheet', icon: Sheet, perm: 'trip:read' },
  { href: '/trips', label: 'Trips', icon: Route, perm: 'trip:read' },
  { href: '/pos', label: 'PO search', icon: ClipboardCheck, perm: 'trip:read' },
  { href: '/costs', label: 'Costs & advances', icon: Wallet, perm: 'cost:read' },
  { href: '/roi', label: 'ROI & routes', icon: BarChart3, perm: 'report:read' },
  { href: '/invoicing', label: 'Invoicing', icon: Receipt, perm: 'invoice:read' },
  { href: '/clients', label: 'Clients', icon: Building2, perm: 'client:read' },
  { href: '/documents', label: 'Documents', icon: FileText, perm: 'document:read' },
  { href: '/team', label: 'Team & logins', icon: UserCog, perm: 'user:read' },
  { href: '/audit', label: 'Audit trail', icon: ScrollText, perm: 'audit:read' },
  { href: '/settings', label: 'Settings', icon: Settings, perm: 'settings:read' },
];

export function TopNav({ role, name, pendingApprovals = 0 }: { role: AppRole; name: string; pendingApprovals?: number }) {
  const pathname = usePathname();
  const items = NAV.filter((n) => can(role, n.perm));

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
      <div className="flex items-center gap-3 px-4 py-3 lg:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand text-xs font-extrabold tracking-tighter text-white">BV</span>
          <span className="hidden min-w-0 leading-tight sm:block">
            <span className="block truncate text-sm font-semibold text-fg">Big Ventures</span>
            <span className="block text-[11px] text-muted">Fleet Intelligence</span>
          </span>
        </Link>

        <div className="ml-auto flex shrink-0 items-center gap-3">
          <span className="hidden text-right leading-tight sm:block">
            <span className="block text-sm font-medium text-fg">{name}</span>
            <span className="block text-[11px] capitalize text-muted">{role}</span>
          </span>
          <button
            type="button"
            title="Sign out"
            aria-label="Sign out"
            onClick={() => signOut().then(() => (window.location.href = '/login'))}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-bg hover:text-fg"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      <nav aria-label="Main" className="no-scrollbar flex gap-1 overflow-x-auto border-t border-border/70 px-2.5 py-1.5 lg:px-5">
        {items.map((n) => {
          const active = n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
          const Icon = n.icon;
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`relative flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors ${
                active ? 'bg-brand/10 font-medium text-brand' : 'text-muted hover:bg-bg hover:text-fg'
              }`}
            >
              <Icon size={15} />
              {n.label}
              {n.href === '/approvals' && pendingApprovals > 0 && (
                <span className="ml-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-warn px-1 text-[10px] font-bold leading-none text-white">
                  {pendingApprovals}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
