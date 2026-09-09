export interface ResolvedPeriod {
  from: Date;
  to: Date;
  key: string;
  label: string;
}

export function resolvePeriod(period: string | undefined): ResolvedPeriod {
  const to = new Date();
  const key = period ?? 'month';
  if (key === '30d')
    return { from: new Date(to.getTime() - 30 * 86_400_000), to, key, label: 'last 30 days' };
  if (key === '90d')
    return { from: new Date(to.getTime() - 90 * 86_400_000), to, key, label: 'last 90 days' };
  if (key === 'all')
    return { from: new Date('2020-01-01'), to: new Date('2100-01-01'), key, label: 'all time' };
  return {
    from: new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1)),
    to: new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth() + 1, 1)),
    key: 'month',
    label: to.toLocaleDateString('en-KE', { month: 'long', year: 'numeric' }),
  };
}
