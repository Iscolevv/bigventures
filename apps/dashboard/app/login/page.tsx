'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff, Loader2, TriangleAlert, Truck } from 'lucide-react';
import { signIn } from '@/lib/auth-client';

/** Only ever follow a same-site path (e.g. from the "approve this trip" email link) - never an absolute URL. */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}

function LoginForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    router.push(next);
  }

  const field =
    'w-full rounded-xl border border-border bg-bg py-3 pl-11 pr-3.5 text-base text-fg outline-none transition-shadow focus:border-brand focus:ring-4 focus:ring-brand/15';

  return (
    <form
      onSubmit={onSubmit}
      className="login-card w-full max-w-sm rounded-3xl border border-border/80 bg-surface/90 p-7 shadow-2xl shadow-black/10 backdrop-blur-xl sm:p-8"
    >
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand text-base font-extrabold tracking-tighter text-white shadow-lg shadow-brand/30">
          BV
        </span>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold leading-tight text-fg">Big Ventures</h1>
          <p className="truncate text-xs font-medium uppercase tracking-wide text-muted">Fleet, trips &amp; payments</p>
        </div>
      </div>

      <p className="mt-6 text-sm text-muted">Sign in to continue</p>

      <label className="mt-2 block text-xs font-semibold uppercase tracking-wide text-muted">Email</label>
      <div className="relative mt-1.5">
        <Mail size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={field}
          placeholder="you@venturesbig.com"
        />
      </div>

      <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-muted">Password</label>
      <div className="relative mt-1.5">
        <Lock size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={`${field} pr-11`}
        />
        <button
          type="button"
          onClick={() => setShowPassword((s) => !s)}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          className="absolute right-2.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-bg hover:text-fg"
        >
          {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-crit/30 bg-crit/10 px-3.5 py-2.5 text-sm text-crit">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" />
          <span className="wrap-anywhere">{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand/25 transition active:scale-[0.98] active:opacity-90 disabled:opacity-60"
      >
        {busy ? (
          <>
            <Loader2 size={18} className="animate-spin" /> Signing in…
          </>
        ) : (
          'Sign in'
        )}
      </button>

      <p className="mt-5 text-center text-xs text-muted">Office staff and drivers both sign in here.</p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="login-bg relative grid min-h-[100dvh] place-items-center overflow-hidden p-5">
      <div className="login-glow login-glow-a" aria-hidden />
      <div className="login-glow login-glow-b" aria-hidden />
      <div className="login-grid" aria-hidden />

      <Truck size={20} className="login-truck" aria-hidden />

      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>

      <style>{`
        .login-bg { background: var(--bg); }
        .login-grid {
          position: absolute;
          inset: 0;
          background-image: radial-gradient(color-mix(in srgb, var(--brand) 35%, transparent) 1.5px, transparent 1.5px);
          background-size: 28px 28px;
          mask-image: radial-gradient(ellipse 70% 60% at 50% 35%, black 0%, transparent 72%);
          opacity: 0.35;
        }
        .login-glow {
          position: absolute;
          border-radius: 9999px;
          filter: blur(70px);
          opacity: 0.35;
        }
        .login-glow-a { top: -12%; left: -8%; width: 55vw; height: 55vw; background: var(--brand); }
        .login-glow-b { bottom: -16%; right: -10%; width: 45vw; height: 45vw; background: var(--brand); opacity: 0.2; }
        .login-truck {
          position: absolute;
          bottom: 28px;
          color: var(--muted);
          opacity: 0.5;
          animation: login-drive 16s linear infinite;
        }
        @keyframes login-drive {
          0% { left: -24px; }
          100% { left: calc(100% + 24px); }
        }
        .login-card {
          animation: login-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes login-in {
          from { opacity: 0; transform: translateY(14px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .login-card { animation: none; }
          .login-truck { animation: none; display: none; }
        }
      `}</style>
    </main>
  );
}
