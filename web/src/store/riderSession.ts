import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface RiderSessionState {
  riderId: string | null;
  riderName: string | null;
  setRiderSession: (id: string, name: string) => void;
  clearRiderSession: () => void;
}

export const useRiderSession = create<RiderSessionState>()(
  persist(
    (set) => ({
      riderId: null,
      riderName: null,
      setRiderSession: (id, name) => set({ riderId: id, riderName: name }),
      clearRiderSession: () => set({ riderId: null, riderName: null }),
    }),
    { name: 'voltium-rider-session' }
  )
);

if (typeof window !== 'undefined') {
  (window as any).useRiderSession = useRiderSession;
}
