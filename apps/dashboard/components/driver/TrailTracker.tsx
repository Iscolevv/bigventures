'use client';
import { useEffect, useRef, useState } from 'react';
import { pingTrail } from '@/app/d/actions';

/**
 * Records the trip's GPS trail while this screen is open. Web geolocation only
 * runs in the foreground — keep the phone unlocked with the app open on long
 * legs, or the office reconstructs the route from drop arrivals. (The native
 * app does true background tracking; this is the web trade-off.)
 */
export function TrailTracker({ tripId }: { tripId: string }) {
  const buffer = useRef<{ lat: number; lng: number; t: number }[]>([]);
  const [count, setCount] = useState(0);
  const [on, setOn] = useState(true);

  useEffect(() => {
    if (!on || !('geolocation' in navigator)) return;
    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        buffer.current.push({ lat: pos.coords.latitude, lng: pos.coords.longitude, t: Date.now() });
        setCount((c) => c + 1);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
    );
    const flush = setInterval(async () => {
      if (buffer.current.length === 0) return;
      const points = buffer.current.splice(0, buffer.current.length);
      try {
        await pingTrail(tripId, points);
      } catch {
        buffer.current.unshift(...points); // put them back, retry next tick
      }
    }, 30_000);

    const onHide = () => {
      if (buffer.current.length) {
        const points = buffer.current.splice(0, buffer.current.length);
        pingTrail(tripId, points).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onHide);

    return () => {
      navigator.geolocation.clearWatch(watch);
      clearInterval(flush);
      document.removeEventListener('visibilitychange', onHide);
      onHide();
    };
  }, [tripId, on]);

  return (
    <div className="mt-3 flex items-center justify-between rounded-lg bg-brand/10 px-3 py-2 text-xs text-brand">
      <span>{on ? `Recording route — ${count} points` : 'Route recording paused'}</span>
      <button onClick={() => setOn((v) => !v)} className="font-semibold underline">
        {on ? 'pause' : 'resume'}
      </button>
    </div>
  );
}
