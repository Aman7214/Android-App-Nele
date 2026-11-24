import { create } from 'zustand';

import { authenticate, onSessionExpired, restoreSession, signOut, type AccountUser } from '@/services/auth';

type AuthState = {
  user: AccountUser | null;
  ready: boolean;
  pending: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  submit: (input: { email: string; password: string; name?: string }, signUp: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
};

let initialization: Promise<void> | undefined;
export const useAuthStore = create<AuthState>((set) => ({
  user: null, ready: false, pending: false, error: null,
  initialize: () => {
    initialization ??= (async () => {
      try { set({ user: await restoreSession(), error: null }); }
      catch (error) { set({ error: error instanceof Error ? error.message : 'Your account could not be loaded.' }); }
      finally { set({ ready: true }); }
    })();
    return initialization;
  },
  submit: async (input, signUp) => {
    set({ pending: true, error: null });
    try {
      await initialization;
      set({ user: null });
      set({ user: await authenticate(input, signUp), ready: true });
    }
    catch (error) {
      set({ error: error instanceof Error ? error.message : 'Sign in failed. Please try again.' });
      throw error;
    } finally { set({ pending: false }); }
  },
  signOut: async () => {
    set({ pending: true, error: null });
    try { await signOut(); }
    catch { set({ error: 'You signed out on this device. The server could not confirm sign out; try again when connected.' }); }
    finally { set({ user: null, pending: false, ready: true }); }
  },
  clearError: () => set({ error: null }),
}));

onSessionExpired(() => useAuthStore.setState({ user: null, error: 'Please sign in again.' }));
