import { useInfiniteQuery, useIsMutating, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { z } from 'zod';

import { toListing } from '@/data/listing-images';
import { requestApi, RequestError } from '@/services/api';
import { uploadMedia, type PickedMedia } from '@/services/media-upload';
import { useAuthStore } from '@/stores/auth';
import { setSavedFlag } from '@/utils/property-cache';
import { mergeConversation, mergeMessagePage, mergeMessages } from '@/utils/chat-state';

import {
  conversationListSchema, chatMessageSchema, chatMessagePageSchema, conversationThreadSchema,
  type ChatMessage, type ConversationThread,
} from '../../shared/chat';
import {
  accountCountsSchema, createListingSchema, listingDetailSchema, listingPageSchema, listingRecordSchema,
  type CreateListingInput, type DocumentKind, type ListingDetail, type ListingFilters, type ListingPage,
  type ListingScope, type ListingStatus, type UploadPurpose,
} from '../../shared/listings';

export function usePropertyFeed(filters: ListingFilters = {}, scope: ListingScope = 'listings') {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const ready = useAuthStore((state) => state.ready);
  const normalizedFilters = {
    ...filters,
    q: filters.q?.trim().replace(/\s+/g, ' ').toLowerCase() || undefined,
  };
  const feed = useInfiniteQuery({
    queryKey: [scope, userId, normalizedFilters],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => requestApi(scope, listingPageSchema, {
      query: { ...normalizedFilters, cursor: pageParam ?? undefined }, userId, signal,
    }),
    getNextPageParam: (page) => page.nextCursor,
    enabled: ready && (scope === 'listings' || userId !== null),
    placeholderData: (previous, previousQuery) => previousQuery?.queryKey[0] === scope
      && previousQuery.queryKey[1] === userId ? previous : undefined,
  });
  const records = useMemo(() => {
    const unique = new Map(feed.data?.pages.flatMap((page) => page.listings).map((listing) => [listing.id, listing]));
    return [...unique.values()].filter((listing) => scope !== 'saved' || listing.saved);
  }, [feed.data, scope]);
  const listings = useMemo(() => records.map(toListing), [records]);
  const { hasNextPage, isFetching, fetchNextPage } = feed;
  const loadNextPage = useCallback(() => {
    if (hasNextPage && !isFetching) void fetchNextPage({ cancelRefetch: false });
  }, [hasNextPage, isFetching, fetchNextPage]);
  return { ...feed, listings, loadNextPage, loading: !ready || (feed.isPending && (scope === 'listings' || userId !== null)) };
}

export function useAccountCounts() {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  return useQuery({
    queryKey: ['account', userId],
    queryFn: ({ signal }) => requestApi('me', accountCountsSchema, { userId, signal }),
    enabled: userId !== null,
  });
}

export function useCreateProperty() {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateListingInput) => {
      if (!userId) throw new RequestError('Sign in to post a property.', 401);
      const details = createListingSchema.safeParse(input);
      if (!details.success) throw new RequestError('Check the title, locality, price, area and rental audience.', 400);
      return requestApi('listings', listingRecordSchema, { method: 'POST', body: details.data, userId });
    },
    onSuccess: (record) => {
      cache.setQueriesData<InfiniteData<ListingPage>>({ queryKey: ['mine', userId] }, (data) => data ? {
        ...data,
        pages: data.pages.map((page, index) => ({
          ...page,
          listings: index === 0
            ? [record, ...page.listings.filter((listing) => listing.id !== record.id)]
            : page.listings.filter((listing) => listing.id !== record.id),
        })),
      } : data);
      void cache.invalidateQueries({ queryKey: ['listings'] });
      void cache.invalidateQueries({ queryKey: ['mine', userId] });
      void cache.invalidateQueries({ queryKey: ['account', userId] });
    },
  });
}

export function useSaveProperty(listingId: string) {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const cache = useQueryClient();
  const key = ['save', userId, listingId];
  const pending = useIsMutating({ mutationKey: key }) > 0;
  const updateFlag = (saved: boolean) => cache.setQueriesData<InfiniteData<ListingPage>>({
    predicate: (query) => ['listings', 'saved', 'mine'].includes(String(query.queryKey[0])) && query.queryKey[1] === userId,
  }, (data) => setSavedFlag(data, listingId, saved));

  const mutation = useMutation({
    mutationKey: key,
    scope: { id: key.join(':') },
    mutationFn: ({ saved }: { saved: boolean; previous: boolean }) => {
      if (!userId) throw new RequestError('Sign in to save properties.', 401);
      return requestApi(`saved/${encodeURIComponent(listingId)}`, z.object({ saved: z.boolean() }), {
        method: saved ? 'PUT' : 'DELETE', userId,
      });
    },
    onMutate: async ({ saved, previous }) => {
      await cache.cancelQueries({ predicate: (query) => query.queryKey[1] === userId });
      updateFlag(saved);
      return { previous };
    },
    onError: (_error, _input, context) => { if (context) updateFlag(context.previous); },
    onSettled: () => {
      // Refresh shared feeds after all saves finish so an older read cannot replace another optimistic save.
      if (cache.isMutating({ mutationKey: ['save', userId] }) === 1) {
        void cache.invalidateQueries({ predicate: (query) => query.queryKey[1] === userId });
      }
    },
  });
  const mutate = (input: { saved: boolean; previous: boolean }) => {
    // Two visible cards may show the same property; lock synchronously before a second tap.
    if (cache.isMutating({ mutationKey: key }) === 0) mutation.mutate(input);
  };
  return { ...mutation, mutate, pending };
}

/**
 * Uploads one picked photo or document and hands back the stored key.
 * Documents are optional throughout: nothing here blocks publishing.
 */
export function useUploadMedia() {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  return useMutation({
    mutationFn: (input: { media: PickedMedia; purpose: UploadPurpose; kind?: DocumentKind }) => {
      if (!userId) throw new RequestError('Sign in to upload photos and documents.', 401);
      return uploadMedia(input.media, input.purpose, userId, input.kind);
    },
  });
}

/** One property plus the private documents, for the detail screen. */
export function useListingDetail(listingId: string) {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  return useQuery({
    queryKey: ['listing', listingId, userId],
    queryFn: ({ signal }): Promise<ListingDetail> =>
      requestApi(`listings/${encodeURIComponent(listingId)}`, listingDetailSchema, { userId, signal }),
    staleTime: 30_000,
  });
}

/** Owner-only: mark a property sold, or put it back on the market. */
export function useUpdateListingStatus() {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const cache = useQueryClient();
  return useMutation({
    mutationFn: ({ listingId, status }: { listingId: string; status: ListingStatus }) => {
      if (!userId) throw new RequestError('Sign in to manage your properties.', 401);
      return requestApi(`listings/${encodeURIComponent(listingId)}/status`, listingRecordSchema, {
        method: 'PUT', body: { status }, userId,
      });
    },
    onSuccess: (record) => {
      // Keep the owner's list honest even before the refetch lands.
      cache.setQueriesData<InfiniteData<ListingPage>>({ queryKey: ['mine', userId] }, (data) => data ? {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          listings: page.listings.map((listing) => listing.id === record.id ? record : listing),
        })),
      } : data);
      void cache.invalidateQueries({ queryKey: ['mine', userId] });
      void cache.invalidateQueries({ queryKey: ['listings'] });
      void cache.invalidateQueries({ queryKey: ['listing', record.id] });
    },
  });
}

export function useConversations() {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  return useQuery({
    queryKey: ['conversations', userId],
    queryFn: ({ signal }) => requestApi('conversations', conversationListSchema, { userId, signal }),
    enabled: userId !== null,
    refetchInterval: 15_000,
  });
}

/**
 * One thread. Messages are polled while the screen is mounted rather than pushed
 * over a socket: no extra dependency, and the interval stops on unmount.
 */
export function useConversation(conversationId: string) {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const cache = useQueryClient();
  const key = ['conversation', userId, conversationId];
  const changing = useIsMutating({ mutationKey: ['conversation-action', userId, conversationId] }) > 0;
  return useQuery({
    queryKey: key,
    queryFn: async ({ signal }) => {
      const thread = await requestApi(`conversations/${encodeURIComponent(conversationId)}`, conversationThreadSchema, { userId, signal });
      return mergeConversation(cache.getQueryData<ConversationThread>(key), thread);
    },
    enabled: userId !== null && conversationId.length > 0,
    refetchInterval: changing ? false : 4_000,
    staleTime: 0,
  });
}

export function useOlderMessages(conversationId: string) {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const cache = useQueryClient();
  const key = ['conversation', userId, conversationId];
  const mutationKey = ['conversation-action', userId, conversationId];
  return useMutation({
    mutationKey: [...mutationKey, 'older'],
    mutationFn: (before: string) => {
      if (!userId) throw new RequestError('Sign in to read messages.', 401);
      return requestApi(`conversations/${encodeURIComponent(conversationId)}/messages`, chatMessagePageSchema, {
        query: { before }, userId,
      });
    },
    onMutate: () => cache.cancelQueries({ queryKey: key }),
    onSuccess: async (page, before) => {
      await cache.cancelQueries({ queryKey: key });
      cache.setQueryData<ConversationThread>(key, (thread) => thread ? mergeMessagePage(thread, page, before) : thread);
    },
    onSettled: () => {
      if (cache.isMutating({ mutationKey }) === 1) void cache.invalidateQueries({ queryKey: key });
    },
  });
}

/** Opens (or reopens) the thread for a listing and seeds its cache. */
export function useStartConversation() {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (listingId: string) => {
      if (!userId) throw new RequestError('Sign in to message a seller.', 401);
      return requestApi('conversations', conversationThreadSchema, { method: 'POST', body: { listingId }, userId });
    },
    onSuccess: (thread) => {
      cache.setQueryData(['conversation', userId, thread.id], thread);
      void cache.invalidateQueries({ queryKey: ['conversations', userId] });
    },
  });
}

/** Optimistic send: the bubble appears instantly and is reconciled on refetch. */
export function useSendMessage(conversationId: string) {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const cache = useQueryClient();
  const key = ['conversation', userId, conversationId];
  const mutationKey = ['conversation-action', userId, conversationId];
  return useMutation({
    mutationKey: [...mutationKey, 'send'],
    mutationFn: (body: string) => {
      if (!userId) throw new RequestError('Sign in to send messages.', 401);
      return requestApi(`conversations/${encodeURIComponent(conversationId)}/messages`, chatMessageSchema, {
        method: 'POST', body: { body }, userId,
      });
    },
    onMutate: async (body) => {
      await cache.cancelQueries({ queryKey: key });
      const optimisticId = `pending-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      if (userId) {
        const optimistic: ChatMessage = {
          id: optimisticId,
          conversationId,
          senderId: userId,
          body,
          createdAt: new Date().toISOString(),
          mine: true,
        };
        cache.setQueryData<ConversationThread>(key, (thread) => thread ? {
          ...thread, messages: mergeMessages(thread.messages, [optimistic]),
        } : thread);
      }
      return { optimisticId };
    },
    onSuccess: async (message, _body, context) => {
      await cache.cancelQueries({ queryKey: key });
      cache.setQueryData<ConversationThread>(key, (thread) => thread ? {
        ...thread,
        messages: mergeMessages(thread.messages.filter((item) => item.id !== context?.optimisticId), [message]),
      } : thread);
    },
    onError: async (_error, _body, context) => {
      await cache.cancelQueries({ queryKey: key });
      if (context) cache.setQueryData<ConversationThread>(key, (thread) => thread ? {
        ...thread, messages: thread.messages.filter((item) => item.id !== context.optimisticId),
      } : thread);
    },
    onSettled: () => {
      // Resume polling after cache updates settle, so a pending read cannot erase history or a sent bubble.
      if (cache.isMutating({ mutationKey }) === 1) void cache.invalidateQueries({ queryKey: key });
      void cache.invalidateQueries({ queryKey: ['conversations', userId] });
    },
  });
}
