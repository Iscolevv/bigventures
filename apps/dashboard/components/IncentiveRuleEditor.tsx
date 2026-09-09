'use client';
import { useState, useTransition } from 'react';
import { saveIncentiveRule } from '@/app/(app)/incentives/actions';

export function IncentiveRuleEditor({
  ruleId,
  config,
  canEdit,
}: {
  ruleId: string;
  config: unknown;
  canEdit: boolean;
}) {
  const [text, setText] = useState(JSON.stringify(config, null, 2));
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setMsg(null);
    start(async () => {
      const res = await saveIncentiveRule(ruleId, text);
      setMsg(res.error ? `✗ ${res.error}` : '✓ Saved — previews below updated');
    });
  }

  return (
    <div>
      <textarea
        className="h-72 w-full rounded-md border bg-bg p-3 font-mono text-xs"
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={!canEdit}
        spellCheck={false}
      />
      <div className="mt-2 flex items-center gap-3">
        {canEdit && (
          <button
            onClick={save}
            disabled={pending}
            className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? 'Saving…' : 'Save rule'}
          </button>
        )}
        {msg && <span className="text-sm text-muted">{msg}</span>}
      </div>
      <p className="mt-2 text-xs text-muted">
        Tiers are marginal (like tax brackets): <code>minTrips</code> is an exclusive threshold,{' '}
        <code>maxTrips</code> inclusive (null = open top tier). <code>quality</code> multiplies the
        bonus, clamped to <code>floor</code>.
      </p>
    </div>
  );
}
