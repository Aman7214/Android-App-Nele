import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/nele/AppText';
import { SecondaryButton } from '@/components/nele/Buttons';
import { ConnectionStatus } from '@/components/nele/ConnectionStatus';
import { useConversation, useOlderMessages, useSendMessage } from '@/hooks/use-properties';
import { useLayout } from '@/theme/layout';
import { colors, radius, spacing } from '@/theme/tokens';
import { formatChatTime } from '@/utils/chat-time';
import { restoreFailedDraft } from '@/utils/chat-state';
import { MAX_MESSAGE_LENGTH, type ChatMessage } from '../../../shared/chat';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversationId = id ?? '';
  const conversation = useConversation(conversationId);
  const send = useSendMessage(conversationId);
  const older = useOlderMessages(conversationId);
  const { gutter } = useLayout();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState('');

  const thread = conversation.data;
  const messages = useMemo(() => [...(thread?.messages ?? [])].reverse(), [thread?.messages]);

  const canSend = draft.trim().length > 0 && !send.isPending;

  const submit = () => {
    const body = draft.trim();
    if (!body || send.isPending) return;
    setDraft('');
    send.mutate(body, { onError: () => setDraft((current) => restoreFailedDraft(current, body)) });
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, paddingHorizontal: gutter }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={10}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/messages'))}
          style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <View style={styles.headerBody}>
          <AppText variant="titleMD" numberOfLines={1}>{thread?.partner.name ?? 'Conversation'}</AppText>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Open the property"
            onPress={() => thread && router.push(`/property/${thread.listingId}`)}>
            <AppText variant="captionSM" tone="muted" numberOfLines={1}>
              {thread ? thread.listingTitle : 'Loading property…'}
            </AppText>
          </Pressable>
        </View>
      </View>

      {conversation.isPending ? (
        <View style={styles.center}><ActivityIndicator color={colors.muted} /></View>
      ) : conversation.error ? (
        <View style={styles.center}>
          <ConnectionStatus error={conversation.error} onRetry={() => { void conversation.refetch(); }} />
        </View>
      ) : (
        <FlatList
          inverted
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingHorizontal: gutter }]}
          maintainVisibleContentPosition={{ minIndexForVisible: 0, autoscrollToTopThreshold: 80 }}
          ListFooterComponent={(
            <View style={styles.history}>
              {thread?.nextCursor ? (
                <SecondaryButton
                  label={older.isPending ? 'Loading older messages…' : 'Load older messages'}
                  disabled={older.isPending}
                  onPress={() => thread.nextCursor && older.mutate(thread.nextCursor)}
                />
              ) : null}
              <ConnectionStatus error={older.error} />
              {thread?.listingStatus === 'sold' ? (
                <View style={styles.notice}>
                  <Ionicons name="checkmark-done-outline" size={16} color={colors.body} />
                  <AppText variant="captionSM" tone="body">
                    This property is marked sold. The seller may not be taking new enquiries.
                  </AppText>
                </View>
              ) : null}
            </View>
          )}
          ListEmptyComponent={(
            <View style={styles.empty}>
              <AppText variant="bodySM" tone="muted" center>
                Say hello and ask about {thread?.listingTitle ?? 'this property'}. Phone numbers stay private.
              </AppText>
            </View>
          )}
          renderItem={({ item }) => <Bubble message={item} />}
        />
      )}

      <ConnectionStatus error={send.error} />
      <View style={[styles.composer, { paddingHorizontal: gutter, paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Message…"
          placeholderTextColor={colors.mutedSoft}
          style={styles.input}
          multiline
          maxLength={MAX_MESSAGE_LENGTH}
          accessibilityLabel="Write a message"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send message"
          accessibilityState={{ disabled: !canSend }}
          disabled={!canSend}
          onPress={submit}
          style={[styles.sendButton, !canSend && styles.sendDisabled]}>
          <Ionicons name="arrow-up" size={20} color={colors.onPrimary} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const mine = message.mine;
  const pending = message.id.startsWith('pending-');
  return (
    <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs, pending && styles.bubblePending]}>
        <AppText variant="bodySM" tone={mine ? 'onPrimary' : 'ink'}>{message.body}</AppText>
        <AppText variant="badge" tone={mine ? 'onPrimary' : 'mutedSoft'} style={styles.bubbleTime}>
          {pending ? 'Sending…' : formatChatTime(message.createdAt)}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineSoft,
    backgroundColor: colors.canvas,
  },
  back: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBody: {
    flex: 1,
    gap: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  history: {
    gap: spacing.sm,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  empty: {
    paddingTop: spacing.section,
    paddingHorizontal: spacing.lg,
  },
  bubbleRow: {
    flexDirection: 'row',
  },
  bubbleRowMine: {
    justifyContent: 'flex-end',
  },
  bubbleRowTheirs: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    gap: 2,
  },
  bubbleMine: {
    backgroundColor: colors.ink,
    borderBottomRightRadius: radius.xs,
  },
  bubbleTheirs: {
    backgroundColor: colors.surfaceSoft,
    borderBottomLeftRadius: radius.xs,
  },
  bubblePending: {
    opacity: 0.65,
  },
  bubbleTime: {
    alignSelf: 'flex-end',
    opacity: 0.7,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.hairlineSoft,
    backgroundColor: colors.canvas,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing.sm + 2,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.canvas,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  sendDisabled: {
    backgroundColor: colors.primaryDisabled,
  },
});
