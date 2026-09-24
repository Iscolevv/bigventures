'use client';
import { Download, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Nudges drivers to add the app to their home screen. Android/Chrome gets a
 * one-tap Install button (via `beforeinstallprompt`); iOS Safari gets the
 * manual Share → Add to Home Screen instruction. Hidden once installed.
 */
export function InstallHint() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [show, setShow] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('bv.install.dismissed') === '1') return;
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // iOS
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIos(ios);

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', onBip);
    if (ios) setShow(true);
    return () => window.removeEventListener('beforeinstallprompt', onBip);
  }, []);

  if (!show) return null;

  function dismiss() {
    localStorage.setItem('bv.install.dismissed', '1');
    setShow(false);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    dismiss();
  }

  return (
    <div className="mx-4 mt-3 rounded-xl border border-brand/30 bg-brand/10 p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-brand">Add Big Ventures to your home screen</p>
        <button onClick={dismiss} aria-label="Dismiss" className="grid h-8 w-8 place-items-center rounded-full text-muted active:bg-brand/10">
          <X size={18} />
        </button>
      </div>
      {isIos ? (
        <p className="mt-1 text-xs text-muted">
          Tap the <span className="font-semibold">Share</span> button below, then{' '}
          <span className="font-semibold">Add to Home Screen</span>.
        </p>
      ) : (
        <button
          onClick={install}
          className="mt-2 inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white"
        >
          <Download size={16} />
          Install app
        </button>
      )}
    </div>
  );
}
