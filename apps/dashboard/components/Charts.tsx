'use client';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';

const AXIS = { fontSize: 11, fill: 'var(--muted)' };
const GRID = 'var(--border)';

type Fmt = 'kes' | 'number' | 'oneDp';

function fmt(kind: Fmt | undefined, v: number): string {
  if (kind === 'kes')
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(v || 0);
  if (kind === 'oneDp') return (v ?? 0).toFixed(1);
  return String(v);
}

export function BarChartCard({
  data,
  xKey,
  yKey,
  height = 260,
  color = 'var(--brand)',
  highlightAbove,
  highlightBelow,
  format,
}: {
  data: Record<string, number | string>[];
  xKey: string;
  yKey: string;
  height?: number;
  color?: string;
  highlightAbove?: number;
  highlightBelow?: number;
  format?: Fmt;
}) {
  const isHot = (raw: unknown) => {
    const n = Number(raw);
    if (highlightAbove != null && n > highlightAbove) return true;
    if (highlightBelow != null && n < highlightBelow) return true;
    return false;
  };
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey={xKey} tick={AXIS} axisLine={{ stroke: GRID }} tickLine={false} interval={0} angle={-30} textAnchor="end" height={64} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} width={68} tickFormatter={(v) => fmt(format, Number(v))} />
        <Tooltip
          contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
          formatter={(v) => fmt(format, Number(v))}
        />
        <Bar dataKey={yKey} radius={[4, 4, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={isHot(d[yKey]) ? 'var(--crit)' : color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LineChartCard({
  data,
  xKey,
  series,
  height = 260,
  format,
}: {
  data: Record<string, number | string>[];
  xKey: string;
  series: { key: string; color: string; label?: string }[];
  height?: number;
  format?: Fmt;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey={xKey} tick={AXIS} axisLine={{ stroke: GRID }} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} width={68} tickFormatter={(v) => fmt(format, Number(v))} />
        <Tooltip
          contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
          formatter={(v) => fmt(format, Number(v))}
        />
        {series.map((sr) => (
          <Line key={sr.key} type="monotone" dataKey={sr.key} name={sr.label ?? sr.key} stroke={sr.color} strokeWidth={2} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
