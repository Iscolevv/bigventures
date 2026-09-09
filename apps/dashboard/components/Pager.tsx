import Link from 'next/link';

/**
 * Server-rendered pager. Reads `page` from the current query string and links
 * to prev/next while preserving every other param.
 */
export function Pager({
  page,
  pages,
  total,
  pageSize,
  searchParams,
  basePath,
}: {
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  searchParams: Record<string, string | undefined>;
  basePath: string;
}) {
  if (total <= pageSize) {
    return <p className="mt-3 text-xs text-muted">{total} total</p>;
  }
  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) if (v && k !== 'page') q.set(k, v);
    if (p > 1) q.set('page', String(p));
    const s = q.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className="mt-3 flex items-center justify-between text-sm">
      <span className="text-muted">
        {from}–{to} of {total}
      </span>
      <span className="flex gap-1">
        <PagerLink href={href(page - 1)} disabled={page <= 1}>
          ← Prev
        </PagerLink>
        <span className="rounded-md border px-3 py-1.5 text-muted">
          {page} / {pages}
        </span>
        <PagerLink href={href(page + 1)} disabled={page >= pages}>
          Next →
        </PagerLink>
      </span>
    </div>
  );
}

function PagerLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return <span className="rounded-md border px-3 py-1.5 text-muted opacity-40">{children}</span>;
  }
  return (
    <Link href={href} className="rounded-md border px-3 py-1.5 hover:bg-bg">
      {children}
    </Link>
  );
}

export function pageParam(sp: Record<string, string | undefined>): number {
  const n = Number(sp.page);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}
