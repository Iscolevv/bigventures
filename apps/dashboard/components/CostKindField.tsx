'use client';
import { useState } from 'react';

const field = 'mt-1 w-full rounded-md border bg-surface px-3 py-2 text-sm';

/** Category picker; choosing "other" reveals a required box to say what the cost was. */
export function CostKindField({ categories }: { categories: readonly string[] }) {
  const [cat, setCat] = useState('');
  return (
    <>
      <label className="text-sm font-medium">
        What kind
        <select name="category" required value={cat} onChange={(e) => setCat(e.target.value)} className={`${field} capitalize`}>
          <option value="" disabled>Pick a category…</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </label>
      {cat === 'other' && (
        <label className="text-sm font-medium sm:col-span-2">
          Describe this cost
          <input name="otherDetail" required autoFocus className={field} placeholder="What was it for?" />
        </label>
      )}
    </>
  );
}
