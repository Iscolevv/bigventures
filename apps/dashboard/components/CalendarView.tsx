'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge } from './ui';

export interface CalendarTrip {
  id: string;
  ref: string;
  status: string;
  vehicle: string;
  driver: string;
  drops: number;
  issues: number;
  date: string; // YYYY-MM-DD
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const STATUS_TONE: Record<string, 'ok' | 'warn' | 'crit' | 'muted' | 'brand'> = {
  completed: 'ok',
  in_progress: 'brand',
  pre_check: 'brand',
  flagged: 'crit',
  cancelled: 'muted',
  draft: 'muted',
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function CalendarView({
  year,
  month, // 1-12
  trips,
  todayKey,
}: {
  year: number;
  month: number;
  trips: CalendarTrip[];
  todayKey: string;
}) {
  const byDate = useMemo(() => {
    const m = new Map<string, CalendarTrip[]>();
    for (const t of trips) {
      const arr = m.get(t.date);
      if (arr) arr.push(t);
      else m.set(t.date, [t]);
    }
    return m;
  }, [trips]);

  const inMonth = todayKey.startsWith(`${year}-${pad(month)}`);
  const [selected, setSelected] = useState<string | null>(inMonth ? todayKey : null);

  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const cells: (string | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${year}-${pad(month)}-${pad(i + 1)}`),
  ];

  let prevY = year, prevM = month - 1;
  if (prevM < 1) { prevM = 12; prevY -= 1; }
  let nextY = year, nextM = month + 1;
  if (nextM > 12) { nextM = 1; nextY += 1; }

  const selectedTrips = selected ? (byDate.get(selected) ?? []) : [];
  const monthTotal = trips.length;
  const busiestDay = [...byDate.entries()].sort((a, b) => b[1].length - a[1].length)[0];

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="rounded-xl border bg-surface p-4">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/calendar?y=${prevY}&m=${prevM}`}
            className="rounded-md border px-2.5 py-1.5 text-sm hover:bg-bg"
          >
            ← Prev
          </Link>
          <div className="text-center">
            <h2 className="text-base font-semibold">{MONTH_NAMES[month - 1]} {year}</h2>
            <p className="text-xs text-muted">
              {monthTotal} trip{monthTotal === 1 ? '' : 's'} this month
              {busiestDay && busiestDay[1].length > 1 ? ` · busiest ${dayLabel(busiestDay[0])} (${busiestDay[1].length})` : ''}
            </p>
          </div>
          <Link
            href={`/calendar?y=${nextY}&m=${nextM}`}
            className="rounded-md border px-2.5 py-1.5 text-sm hover:bg-bg"
          >
            Next →
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted">
          {WEEKDAYS.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>
        <div className="mt-1.5 grid grid-cols-7 gap-1.5">
          {cells.map((dateKey, i) => {
            if (!dateKey) return <div key={`pad-${i}`} />;
            const dayTrips = byDate.get(dateKey) ?? [];
            const hasIssue = dayTrips.some((t) => t.issues > 0 || t.status === 'flagged');
            const isToday = dateKey === todayKey;
            const isSelected = dateKey === selected;
            const dayNum = Number(dateKey.slice(-2));
            return (
              <button
                key={dateKey}
                type="button"
                onClick={() => setSelected(dateKey)}
                className={`aspect-square rounded-lg border p-1 text-left transition-colors ${
                  isSelected
                    ? 'border-brand bg-brand text-white'
                    : isToday
                      ? 'border-brand bg-brand/5'
                      : dayTrips.length > 0
                        ? 'border-border bg-bg hover:border-brand/40'
                        : 'border-transparent hover:bg-bg'
                }`}
              >
                <div className={`text-xs font-medium ${isSelected ? 'text-white' : isToday ? 'text-brand' : ''}`}>
                  {dayNum}
                </div>
                {dayTrips.length > 0 && (
                  <div
                    className={`mt-1 inline-flex min-w-[1.1rem] items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : hasIssue
                          ? 'bg-crit/15 text-crit'
                          : 'bg-ok/15 text-ok'
                    }`}
                  >
                    {dayTrips.length}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border bg-surface p-4">
        <h3 className="text-sm font-semibold">
          {selected ? dayLabel(selected) : 'Pick a date'}
        </h3>
        {selected && (
          <p className="mt-0.5 text-xs text-muted">
            {selectedTrips.length} trip{selectedTrips.length === 1 ? '' : 's'} logged
          </p>
        )}
        <div className="mt-3 space-y-2">
          {selected && selectedTrips.length === 0 && (
            <p className="text-sm text-muted">No trips logged this day.</p>
          )}
          {selectedTrips.map((t) => (
            <Link
              key={t.id}
              href={`/trips/${t.id}`}
              className="block rounded-lg border p-2.5 text-sm hover:border-brand/40 hover:bg-bg"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{t.ref}</span>
                <Badge tone={STATUS_TONE[t.status] ?? 'muted'}>{t.status.replace('_', ' ')}</Badge>
              </div>
              <p className="mt-1 wrap-anywhere text-xs text-muted">{t.vehicle} · {t.driver}</p>
              <p className="mt-0.5 text-xs text-muted">
                {t.drops} drop{t.drops === 1 ? '' : 's'}
                {t.issues > 0 ? ` · ${t.issues} issue${t.issues === 1 ? '' : 's'}` : ''}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function dayLabel(dateKey: string) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString('en-KE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}
