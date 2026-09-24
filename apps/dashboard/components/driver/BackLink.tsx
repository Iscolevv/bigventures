import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

/** "Back to ..." link with a chevron, used at the top of the detail screens. */
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="-ml-1 inline-flex items-center gap-0.5 rounded-lg py-1 pr-2 text-sm font-medium text-muted active:text-fg">
      <ChevronLeft size={18} />
      {children}
    </Link>
  );
}
