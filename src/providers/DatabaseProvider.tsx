import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useEffect, type ReactNode } from 'react';

import { RequestError } from '@/services/api';
import { useAuthStore } from '@/stores/auth';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 24 * 60 * 60 * 1_000,
      retry: (count, error) => !(error instanceof RequestError && error.status >= 400 && error.status < 500) && count < 2,
    },
    mutations: { retry: false, networkMode: 'always' },
  },
});

const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: 'nele-public-properties-v1' });

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const initialize = useAuthStore((state) => state.initialize);
  const user = useAuthStore((state) => state.user);
  useEffect(() => { void initialize(); }, [initialize]);
  useEffect(() => {
    // Personal query caches belong to the account that fetched them.
    void queryClient.cancelQueries({ predicate: (query) => Boolean(query.queryKey[1]) && query.queryKey[1] !== user?.id });
    queryClient.removeQueries({ predicate: (query) => Boolean(query.queryKey[1]) && query.queryKey[1] !== user?.id });
  }, [user?.id]);

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{
      persister, buster: 'nele-properties-v1', maxAge: 24 * 60 * 60 * 1_000,
      dehydrateOptions: {
        shouldDehydrateMutation: () => false,
        shouldDehydrateQuery: (query) => query.queryKey[0] === 'listings' && query.queryKey[1] === null && query.state.status === 'success',
      },
    }}>
      {children}
    </PersistQueryClientProvider>
  );
}
