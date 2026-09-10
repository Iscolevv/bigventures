'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from '@/lib/auth-client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await signIn.email({ email, password });
    setBusy(false);
    if (error) {
      setError(error.message ?? 'Sign in failed');
      return;
    }
    router.push('/');
  }

  const field = 'mt-1 w-full rounded-lg border border-border bg-bg px-3.5 py-3 text-base outline-none focus:border-brand';

  return (
    <main className="grid min-h-[100dvh] place-items-center p-5">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-2xl border bg-surface p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Big Ventures</h1>
        <p className="mt-1 text-sm text-muted">Sign in to continue</p>

        <label className="mt-6 block text-sm font-medium">Email</label>
        <input
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={field}
        />

        <label className="mt-4 block text-sm font-medium">Password</label>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={field}
        />

        {error && <p className="wrap-anywhere mt-3 text-sm text-crit">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full rounded-lg bg-brand px-4 py-3.5 text-base font-semibold text-white active:opacity-90 disabled:opacity-60"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
