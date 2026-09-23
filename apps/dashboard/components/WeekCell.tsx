'use client';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setDayNote } from '@/app/(app)/weekly/actions';

const money = (n: number) => n.toLocaleString('en-KE', { maximumFractionDigits: 2 });

/** One truck-day of the weekly sheet: income when it earned, else the status word. Click to type a status. */
export function WeekCell({
  vehicleId,
  day,
  income,
  note,
  pending,
  canEdit,
}: {
  vehicleId: string;
  day: string;
  income: number;
  note: string | null;
  pending: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(note ?? '');
  const [, start] = useTransition();
  const done = useRef(false);

  function save() {
    if (done.current) return;
    done.current = true;
    setEditing(false);
    if ((note ?? '') === value.trim().toUpperCase()) return;
    start(async () => {
      await setDayNote(vehicleId, day, value);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <input
        autoFocus
        list="week-notes"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') {
            done.current = true;
            setEditing(false);
          }
        }}
        placeholder="status"
        className="w-full min-w-[6rem] rounded border bg-surface px-1.5 py-1 text-xs uppercase"
      />
    );
  }

  const shown = income > 0 ? (
    <span className="font-medium tabular-nums">{money(income)}</span>
  ) : note ? (
    <span className="text-xs font-semibold uppercase">{note}</span>
  ) : pending ? (
    <span className="text-xs text-warn">awaiting approval</span>
  ) : null;

  return (
    <button
      type="button"
      disabled={!canEdit}
      onClick={() => {
        done.current = false;
        setValue(note ?? '');
        setEditing(true);
      }}
      title={canEdit ? 'Click to type a status (PKD JGRD, GARAGED...)' : undefined}
      className={`block min-h-[1.75rem] w-full rounded px-1.5 py-1 text-right ${
        income > 0 ? '' : note ? 'bg-warn/15 text-left' : ''
      } ${canEdit ? 'hover:bg-brand/10' : 'cursor-default'}`}
    >
      {shown}
      {income > 0 && note && <span className="block text-left text-[10px] font-semibold uppercase text-muted">{note}</span>}
    </button>
  );
}
