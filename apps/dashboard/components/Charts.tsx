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

export function BarChartCard({
  data,
  xKey,
  yKey,
  height = 260,
  color = 'var(--brand)',
  highlight,
  format,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  yKey: string;
  height?: number;
  color?: string;
  highlight?: (d: Record<string, unknown>) => boolean;
  format?: (v: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey={xKey} tick={AXIS} axisLine={{ stroke: GRID }} tickLine={false} interval={0} angle={-30} textAnchor="end" height={64} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} width={64} tickFormatter={format ? (v) => format(Number(v)) : undefined} />
        <Tooltip
          contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
          formatter={(v) => (format ? format(Number(v)) : v)}
        />
        <Bar dataKey={yKey} radius={[4, 4, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={highlight?.(d) ? 'var(--crit)' : color} />
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
  data: Record<string, unknown>[];
  xKey: string;
  series: { key: string; color: string; label?: string }[];
  height?: number;
  format?: (v: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey={xKey} tick={AXIS} axisLine={{ stroke: GRID }} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} width={64} tickFormatter={format ? (v) => format(Number(v)) : undefined} />
        <Tooltip
          contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
          formatter={(v) => (format ? format(Number(v)) : v)}
        />
        {series.map((sr) => (
          <Line key={sr.key} type="monotone" dataKey={sr.key} name={sr.label ?? sr.key} stroke={sr.color} strokeWidth={2} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
