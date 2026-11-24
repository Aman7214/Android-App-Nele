import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { clearSession } from '@/services/auth';
import { requestApi, RequestError } from '@/services/api';
import { useAuthStore } from '@/stores/auth';

import {
  agentRequestResultSchema, agentRequestSchema,
  type AgentRequestInput, type AgentRequestResult,
} from '../../shared/support';

// Same URL the Play Console data-deletion field points at.
export const ACCOUNT_DELETION_PATH = '/account';
const accountDeletedSchema = z.strictObject({ deleted: z.literal(true) });

/** Callback request: a booking agent will contact the caller. */
export function useSubmitAgentRequest() {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  return useMutation<AgentRequestResult, Error, AgentRequestInput>({
    mutationFn: (input) => {
      if (!userId) throw new RequestError('Sign in so an agent can reach you.', 401);
      const details = agentRequestSchema.safeParse(input);
      if (!details.success) {
        throw new RequestError(details.error.issues[0]?.message ?? 'Check your name, phone number and town.', 400);
      }
      return requestApi('agent-requests', agentRequestResultSchema, {
        method: 'POST', body: details.data, userId,
      });
    },
  });
}

/**
 * Deletes the account and everything attached to it, then clears the local
 * session. Required by Google Play for any app that lets people create accounts.
 */
export function useDeleteAccount() {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const cache = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!userId) throw new RequestError('Sign in first.', 401);
      return requestApi(ACCOUNT_DELETION_PATH, accountDeletedSchema, { method: 'DELETE', userId });
    },
    onSuccess: async () => {
      cache.clear();
      await clearSession();
      useAuthStore.setState({ user: null, ready: true });
    },
  });
}
