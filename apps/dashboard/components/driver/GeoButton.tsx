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
      setDetail('This phone/browser has no location access');
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
    <button
      type="button"
      onClick={go}
      className="rounded-lg border px-3 py-2 text-sm"
    >
      {state === 'busy' ? 'Getting GPS…' : state === 'ok' ? `Pinned ✓ (${detail})` : label}
      {state === 'err' && <span className="ml-1 text-xs text-crit">— {detail}</span>}
    </button>
  );
}
