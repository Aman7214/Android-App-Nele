import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { requestApi, RequestError } from '@/services/api';
import { useAuthStore } from '@/stores/auth';

import { profileSchema, updateProfileSchema, type Profile, type UpdateProfileInput } from '../../shared/profile';

export function useProfile() {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: ({ signal }) => requestApi('profile', profileSchema, { userId, signal }),
    enabled: userId !== null,
    staleTime: 60_000,
  });
}

/** Saves the display name and avatar together — the edit screen owns both. */
export function useUpdateProfile() {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const cache = useQueryClient();
  return useMutation<Profile, Error, UpdateProfileInput>({
    mutationFn: (input) => {
      if (!userId) throw new RequestError('Sign in to edit your profile.', 401);
      const details = updateProfileSchema.safeParse(input);
      if (!details.success) {
        throw new RequestError(details.error.issues[0]?.message ?? 'Check the display name.', 400);
      }
      return requestApi('profile', profileSchema, { method: 'PUT', body: details.data, userId });
    },
    onSuccess: (profile) => {
      cache.setQueryData(['profile', userId], profile);
      // Chat shows display names, so an inbox already on screen must refresh too.
      void cache.invalidateQueries({ queryKey: ['conversations', userId] });
      void cache.invalidateQueries({ queryKey: ['conversation'] });
    },
  });
}
