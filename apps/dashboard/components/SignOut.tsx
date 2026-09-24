'use client';
import { LogOut } from 'lucide-react';
import { signOut } from '@/lib/auth-client';

/** Icon button that signs the user out and returns to the login screen. */
export function SignOut({ className = '' }: { className?: string }) {
  return (
    <button
      type="button"
      aria-label="Sign out"
      title="Sign out"
      onClick={() => signOut().then(() => (window.location.href = '/login'))}
      className={className || 'text-muted hover:text-fg'}
    >
      <LogOut size={20} />
    </button>
  );
}
