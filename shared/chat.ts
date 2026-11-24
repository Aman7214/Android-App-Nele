import { z } from 'zod';

import { imageAssets, listingStatuses, towns } from './listings.ts';

export const MAX_MESSAGE_LENGTH = 2000;
export const MESSAGE_PAGE_SIZE = 50;

export const messageBodySchema = z.string().trim().min(1).max(MAX_MESSAGE_LENGTH);

/**
 * The other side of the conversation. Sellers talk to buyers and buyers talk to
 * sellers, so one shape serves both inboxes.
 */
export const chatPartnerSchema = z.object({
  role: z.enum(['buyer', 'owner']),
  name: z.string(),
});

export const conversationSummarySchema = z.object({
  id: z.string(),
  listingId: z.string(),
  listingTitle: z.string(),
  listingImageAsset: z.enum(imageAssets),
  /** Uploaded cover photo when the listing has one; null keeps the stock art. */
  listingCoverUrl: z.string().nullable(),
  listingStatus: z.enum(listingStatuses),
  town: z.enum(towns),
  partner: chatPartnerSchema,
  lastMessage: z.string().nullable(),
  lastMessageAt: z.string(),
  createdAt: z.string(),
});

export const chatMessageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  senderId: z.string(),
  body: z.string(),
  createdAt: z.string(),
  /** True when the signed-in caller sent it. */
  mine: z.boolean().default(false),
});

export const chatMessagePageSchema = z.object({
  messages: z.array(chatMessageSchema).default([]),
  nextCursor: z.string().nullable().default(null),
});

export const messagePageQuerySchema = z.strictObject({
  before: z.string().min(1).max(512).optional(),
});

export const conversationThreadSchema = conversationSummarySchema.extend(chatMessagePageSchema.shape);

export const conversationListSchema = z.object({
  conversations: z.array(conversationSummarySchema),
});

export const startConversationSchema = z.strictObject({
  listingId: z.string().min(1).max(80),
});

export const sendMessageSchema = z.strictObject({
  body: messageBodySchema,
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatMessagePage = z.infer<typeof chatMessagePageSchema>;
export type ChatPartner = z.infer<typeof chatPartnerSchema>;
export type ConversationSummary = z.infer<typeof conversationSummarySchema>;
export type ConversationThread = z.infer<typeof conversationThreadSchema>;
export type ConversationList = z.infer<typeof conversationListSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
