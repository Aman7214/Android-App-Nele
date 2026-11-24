import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/nele/AppText';
import { PrimaryButton, SecondaryButton } from '@/components/nele/Buttons';
import { ConnectionStatus } from '@/components/nele/ConnectionStatus';
import { Screen } from '@/components/nele/Screen';
import { LISTING_IMAGES } from '@/data/listing-images';
import { useConversations } from '@/hooks/use-properties';
import { useAuthStore } from '@/stores/auth';
import { useLayout } from '@/theme/layout';
import { colors, radius, spacing } from '@/theme/tokens';
import { formatChatTime } from '@/utils/chat-time';
import type { ConversationSummary } from '../../shared/chat';

export default function MessagesScreen() {
  const { gutter } = useLayout();
  const user = useAuthStore((state) => state.user);
  const conversations = useConversations();
  const items = conversations.data?.conversations ?? [];

  return (
    <Screen>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.content, { paddingHorizontal: gutter }]}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshing={conversations.isRefetching}
        onRefresh={() => { void conversations.refetch(); }}
        ListHeaderComponent={(
          <View style={styles.header}>
            <SecondaryButton
              label="Back to profile"
              icon="arrow-back"
              fullWidth={false}
              onPress={() => router.replace('/profile')}
            />
            <AppText variant="displayLG">Messages</AppText>
            <ConnectionStatus error={conversations.error} onRetry={() => { void conversations.refetch(); }} />
            {!user ? (
              <PrimaryButton
                label="Sign in to see your messages"
                onPress={() => router.push({ pathname: '/auth', params: { returnTo: '/messages' } })}
              />
            ) : null}
          </View>
        )}
        ListEmptyComponent={user && conversations.isPending ? undefined : (
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={26} color={colors.mutedSoft} />
            <AppText variant="titleMD" center>No conversations yet</AppText>
            <AppText variant="bodySM" tone="muted" center>
              Open any property and tap Message seller to ask about it — without sharing a phone number.
            </AppText>
          </View>
        )}
        renderItem={({ item }) => <ConversationRow conversation={item} />}
      />
    </Screen>
  );
}

function ConversationRow({ conversation }: { conversation: ConversationSummary }) {
  const sold = conversation.listingStatus === 'sold';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Conversation with ${conversation.partner.name} about ${conversation.listingTitle}`}
      onPress={() => router.push(`/chat/${conversation.id}`)}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <Image
        source={conversation.listingCoverUrl ? { uri: conversation.listingCoverUrl } : LISTING_IMAGES[conversation.listingImageAsset]}
        style={styles.thumb}
        contentFit="cover"
        transition={120}
      />
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <AppText variant="cardTitle" numberOfLines={1} style={styles.rowTitle}>
            {conversation.partner.name}
          </AppText>
          <AppText variant="captionSM" tone="muted">{formatChatTime(conversation.lastMessageAt)}</AppText>
        </View>
        <AppText variant="captionSM" tone="muted" numberOfLines={1}>
          {conversation.listingTitle}{sold ? ' · Sold' : ''}
        </AppText>
        <AppText variant="captionSM" tone="body" numberOfLines={1}>
          {conversation.lastMessage ?? 'No messages yet'}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    gap: spacing.base,
    paddingBottom: spacing.lg,
  },
  separator: {
    height: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  rowPressed: {
    backgroundColor: colors.surfaceSoft,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceStrong,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rowTitle: {
    flex: 1,
  },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.section,
    paddingHorizontal: spacing.lg,
  },
});
