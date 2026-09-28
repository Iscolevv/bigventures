'use client';
import { useState } from 'react';

const DOMAIN = 'venturesbig.com';
const fieldCls = 'mt-1 w-full rounded-md border bg-surface px-3 py-2 text-sm';

function slugify(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');
}

/** Name + email for a new office login - suggests name@venturesbig.com as the name is typed, so there is always something to see, but a real address can still be typed over it. */
export function OfficeLoginFields() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);

  function onName(v: string) {
    setName(v);
    if (!emailTouched) setEmail(v.trim() ? `${slugify(v)}@${DOMAIN}` : '');
  }

  return (
    <>
      <label className="text-sm font-medium">
        Name
        <input name="name" required value={name} onChange={(e) => onName(e.target.value)} className={fieldCls} />
      </label>
      <label className="text-sm font-medium">
        Email
        <input
          name="email"
          type="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setEmailTouched(true);
          }}
          className={fieldCls}
          placeholder="name@venturesbig.com"
        />
      </label>
    </>
  );
}
