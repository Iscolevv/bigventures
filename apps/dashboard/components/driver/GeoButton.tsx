'use client';
import { useState } from 'react';

export function GeoButton({
  onFix,
  label = 'Use my location',
}: {
  onFix: (c: { lat: number; lng: number; accuracy: number }) => void;
  label?: string;
}) {
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'err'>('idle');
  const [detail, setDetail] = useState('');

  function go() {
    if (!('geolocation' in navigator)) {
      setState('err');
      setDetail('No location access on this phone');
      return;
    }
    setState('busy');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState('ok');
        setDetail(`±${Math.round(pos.coords.accuracy)} m`);
        onFix({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
      },
      (e) => {
        setState('err');
        setDetail(e.message);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 },
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={go}
        className="min-h-[48px] w-full rounded-lg border px-4 py-3 text-sm font-medium active:bg-bg"
      >
        {state === 'busy' ? 'Getting GPS…' : state === 'ok' ? `Pinned ✓ (${detail})` : label}
      </button>
      {state === 'err' && <p className="wrap-anywhere mt-1 text-xs text-crit">Couldn&apos;t get GPS — {detail}</p>}
    </div>
  );
}
