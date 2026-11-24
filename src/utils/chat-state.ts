import type { ChatMessage, ChatMessagePage, ConversationThread } from '../../shared/chat.ts';

function timestamp(iso: string) {
  // Server cursors retain microseconds; optimistic messages use millisecond ISO strings.
  return iso.replace(/(?:\.(\d+))?Z$/, (_match, fraction: string | undefined) => `.${(fraction ?? '').padEnd(6, '0')}Z`);
}

export function mergeMessages(...groups: ChatMessage[][]): ChatMessage[] {
  const messages = new Map(groups.flat().map((message) => [message.id, message]));
  return [...messages.values()].sort((left, right) => {
    const at = timestamp(left.createdAt).localeCompare(timestamp(right.createdAt));
    return at || left.id.localeCompare(right.id);
  });
}

/** Polls update recent messages without removing history already loaded by this reader. */
export function mergeConversation(previous: ConversationThread | undefined, next: ConversationThread): ConversationThread {
  if (!previous) return next;
  const previousIds = new Set(previous.messages.map((message) => message.id));
  const overlaps = next.messages.some((message) => previousIds.has(message.id));
  return {
    ...next,
    messages: mergeMessages(previous.messages, next.messages),
    // After a long outage, start paging from the recent window to fill any gap.
    nextCursor: overlaps || next.messages.length === 0 ? previous.nextCursor : next.nextCursor,
  };
}

export function mergeMessagePage(thread: ConversationThread, page: ChatMessagePage, before: string): ConversationThread {
  return {
    ...thread,
    messages: mergeMessages(page.messages, thread.messages),
    // A poll may have found a newer gap while this history request was running.
    nextCursor: thread.nextCursor === before ? page.nextCursor : thread.nextCursor,
  };
}

export function restoreFailedDraft(currentDraft: string, sentBody: string): string {
  return currentDraft.length > 0 ? currentDraft : sentBody;
}
