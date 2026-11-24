import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { TownId } from '@/data/locations';

type LocationState = {
  town: TownId | null;
  permission: 'unknown' | 'granted' | 'denied';
  /** The user chose "Skip for now" — do not ask again on the next launch. */
  skipped: boolean;
  setTown: (town: TownId | null) => void;
  setPermission: (permission: 'granted' | 'denied') => void;
  skip: () => void;
};

export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      town: null,
      permission: 'unknown',
      skipped: false,
      setTown: (town) => set({ town, skipped: false }),
      setPermission: (permission) => set({ permission }),
      skip: () => set({ skipped: true }),
    }),
    {
      name: 'nele-location',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
