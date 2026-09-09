'use client';
import { useTransition } from 'react';
import { generatePayrollRun, setPayrollStatus } from '@/app/(app)/incentives/actions';

export function GeneratePayrollButton({ period }: { period: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => start(() => generatePayrollRun(period).then(() => {}))}
      disabled={pending}
      className="rounded-md border px-3 py-1.5 text-sm hover:bg-bg disabled:opacity-60"
    >
      {pending ? 'Generating…' : 'Generate / refresh payroll run'}
    </button>
  );
}

export function PayrollStatusButton({
  runId,
  status,
}: {
  runId: string;
  status: 'draft' | 'approved' | 'paid';
}) {
  const [pending, start] = useTransition();
  const next = status === 'draft' ? 'approved' : status === 'approved' ? 'paid' : null;
  if (!next) return <span className="text-xs text-ok">paid</span>;
  return (
    <button
      onClick={() => start(() => setPayrollStatus(runId, next).then(() => {}))}
      disabled={pending}
      className="rounded-md border px-2 py-1 text-xs hover:bg-bg disabled:opacity-60"
    >
      {pending ? '…' : next === 'approved' ? 'Approve' : 'Mark paid'}
    </button>
  );
}
