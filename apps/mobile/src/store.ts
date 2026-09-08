import { create } from 'zustand';
import type { DriverSession } from './lib/auth';

interface AppState {
  session: DriverSession | null;
  online: boolean;
  lastSyncAt: string | null;
  setSession: (s: DriverSession | null) => void;
  setOnline: (v: boolean) => void;
  setLastSyncAt: (v: string) => void;
}

export const useApp = create<AppState>((set) => ({
  session: null,
  online: true,
  lastSyncAt: null,
  setSession: (session) => set({ session }),
  setOnline: (online) => set({ online }),
  setLastSyncAt: (lastSyncAt) => set({ lastSyncAt }),
}));
