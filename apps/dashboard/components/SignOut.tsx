'use client';
import { signOut } from '@/lib/auth-client';

export function SignOut({ className = '' }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => signOut().then(() => (window.location.href = '/login'))}
      className={className || 'text-muted hover:text-fg'}
    >
      Sign out
    </button>
  );
}
