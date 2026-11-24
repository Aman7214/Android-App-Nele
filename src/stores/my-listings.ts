import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Listing } from '@/data/listings';

type MyListingsState = {
  listings: Listing[];
  addListing: (listing: Listing) => void;
  removeListing: (id: string) => void;
};

export const useMyListingsStore = create<MyListingsState>()(
  persist(
    (set) => ({
      listings: [],
      addListing: (listing) => set((state) => ({ listings: [listing, ...state.listings] })),
      removeListing: (id) => set((state) => ({ listings: state.listings.filter((listing) => listing.id !== id) })),
    }),
    {
      name: 'nele-my-listings',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
