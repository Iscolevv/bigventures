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

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-xl border bg-surface p-6 shadow-sm"
      >
        <h1 className="text-lg font-semibold">Big Ventures</h1>
        <p className="mt-1 text-sm text-muted">Fleet Intelligence dashboard</p>

        <label className="mt-6 block text-sm font-medium">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-md border bg-bg px-3 py-2 text-sm"
        />

        <label className="mt-4 block text-sm font-medium">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-md border bg-bg px-3 py-2 text-sm"
        />

        {error && <p className="mt-3 text-sm text-crit">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full rounded-md bg-brand px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
