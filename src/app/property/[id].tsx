import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator, FlatList, Linking, Pressable, ScrollView, StyleSheet, View,
  type NativeScrollEvent, type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/nele/AppText';
import { PrimaryButton, SecondaryButton } from '@/components/nele/Buttons';
import { ConnectionStatus } from '@/components/nele/ConnectionStatus';
import { documentKindLabel } from '@/components/nele/DocumentAttachments';
import { Screen } from '@/components/nele/Screen';
import { toListing } from '@/data/listing-images';
import { audienceLabel, formatPrice, type Listing } from '@/data/listings';
import { useListingDetail, useStartConversation, useUpdateListingStatus } from '@/hooks/use-properties';
import { useAuthStore } from '@/stores/auth';
import { useLayout } from '@/theme/layout';
import { colors, radius, shadow, spacing } from '@/theme/tokens';

function formatSize(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = useListingDetail(id ?? '');
  const user = useAuthStore((state) => state.user);
  const startConversation = useStartConversation();
  const updateStatus = useUpdateListingStatus();
  const { gutter, width } = useLayout();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);

  const listing: Listing | null = detail.data ? toListing(detail.data) : null;
  const photos = listing?.photos?.length ? listing.photos : [];
  const documentCount = detail.data?.documents.length ?? 0;
  const sold = listing?.status === 'sold';
  const isOwner = detail.data?.isOwner ?? false;

  const message = () => {
    if (!listing) return;
    if (!user) {
      router.push({ pathname: '/auth', params: { returnTo: `/property/${listing.id}` } });
      return;
    }
    startConversation.mutate(listing.id, {
      onSuccess: (thread) => router.push(`/chat/${thread.id}`),
    });
  };

  const toggleSold = () => {
    if (!listing) return;
    updateStatus.mutate({ listingId: listing.id, status: sold ? 'active' : 'sold' });
  };

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(event.nativeEvent.contentOffset.x / Math.max(1, width));
    setIndex(Math.min(photos.length - 1, Math.max(0, page)));
  };

  return (
    <Screen padsTop={false}>
      <View style={styles.flex}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
          style={[styles.back, { top: insets.top + spacing.sm, left: gutter }]}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>

        {detail.isPending ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.muted} />
          </View>
        ) : detail.error || !listing ? (
          <View style={[styles.center, { paddingHorizontal: gutter }]}>
            <AppText variant="titleMD" center>This property could not be opened</AppText>
            <ConnectionStatus error={detail.error} onRetry={() => { void detail.refetch(); }} />
            <AppText variant="captionSM" tone="muted" center>
              It may have been removed by its owner.
            </AppText>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <FlatList
              data={photos.length ? photos : [null]}
              keyExtractor={(item, position) => item ?? `placeholder-${position}`}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onScrollEnd}
              renderItem={({ item }) => (
                <Image
                  source={item ? { uri: item } : listing.image}
                  style={[styles.photo, { width }]}
                  contentFit="cover"
                  transition={160}
                  priority="high"
                />
              )}
            />
            {photos.length > 1 ? (
              <View style={styles.dots}>
                {photos.map((photo, position) => (
                  <View key={photo} style={[styles.dot, position === index && styles.dotActive]} />
                ))}
              </View>
            ) : null}

            <View style={[styles.body, { paddingHorizontal: gutter }]}>
              {sold ? (
                <View style={styles.soldPill}>
                  <Ionicons name="checkmark-done" size={13} color={colors.onPrimary} />
                  <AppText variant="badge" tone="onPrimary">Sold</AppText>
                </View>
              ) : null}
              <AppText variant="displayMD">{listing.title}</AppText>
              <AppText variant="bodyMD" tone="body">
                {[listing.locality, listing.town].filter(Boolean).join(' · ')}
              </AppText>
              <AppText variant="titleMD" tone="ink" style={styles.price}>
                {formatPrice(listing)} · {listing.areaSqft.toLocaleString('en-IN')} sq ft
              </AppText>

              <View style={styles.metaRow}>
                <Meta icon="bed-outline" label={listing.beds ? `${listing.beds} bedrooms` : '—'} />
                <Meta icon="water-outline" label={listing.baths ? `${listing.baths} baths` : '—'} />
                <Meta icon="home-outline" label={listing.kind} />
              </View>

              {listing.mode === 'rent' && listing.audience ? (
                <AppText variant="captionSM" tone="muted">{audienceLabel(listing.audience)}</AppText>
              ) : null}

              {photos.length === 0 ? (
                <AppText variant="captionSM" tone="muted">
                  The owner has not added photos to this listing yet.
                </AppText>
              ) : null}

              <View style={styles.actions}>
                {isOwner ? (
                  <>
                    <SecondaryButton
                      label={updateStatus.isPending
                        ? 'Updating…'
                        : sold ? 'Put back on the market' : 'Mark as sold'}
                      icon={sold ? 'refresh' : 'checkmark-done'}
                      disabled={updateStatus.isPending}
                      onPress={toggleSold}
                    />
                    <AppText variant="captionSM" tone="muted" center>
                      {sold
                        ? 'Sold properties are hidden from Explore and Home.'
                        : 'Marking it sold removes it from Explore and Home for everyone else.'}
                    </AppText>
                  </>
                ) : listing.isSample ? null : (
                  <>
                    <PrimaryButton
                      label={startConversation.isPending ? 'Opening chat…' : 'Message seller'}
                      icon="chatbubble-ellipses-outline"
                      disabled={startConversation.isPending}
                      onPress={message}
                    />
                    <AppText variant="captionSM" tone="muted" center>
                      Chat inside Nele. Your phone number stays private until you share it.
                    </AppText>
                    <ConnectionStatus error={startConversation.error} />
                  </>
                )}
              </View>

              <View style={styles.divider} />

              <AppText variant="titleMD">Documents</AppText>
              {documentCount ? (
                <View style={styles.documents}>
                  {detail.data!.documents.map((document) => (
                    <Pressable
                      key={document.id}
                      accessibilityRole="link"
                      accessibilityLabel={`Open ${document.name}`}
                      onPress={() => { void Linking.openURL(document.url).catch(() => undefined); }}
                      style={({ pressed }) => [styles.documentRow, pressed && styles.documentPressed]}>
                      <Ionicons
                        name={document.mimeType === 'application/pdf' ? 'document-text-outline' : 'image-outline'}
                        size={18}
                        color={colors.body}
                      />
                      <View style={styles.documentBody}>
                        <AppText variant="captionSM" numberOfLines={1}>{document.name}</AppText>
                        <AppText variant="captionSM" tone="muted">
                          {documentKindLabel(document.kind)} · {formatSize(document.size)}
                        </AppText>
                      </View>
                      <Ionicons name="open-outline" size={16} color={colors.mutedSoft} />
                    </Pressable>
                  ))}
                </View>
              ) : (
                <AppText variant="captionSM" tone="muted">
                  Documents are optional. Only you can see papers you attach — buyers never do.
                </AppText>
              )}
            </View>
          </ScrollView>
        )}
      </View>
    </Screen>
  );
}

function Meta({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.meta}>
      <Ionicons name={icon} size={16} color={colors.muted} />
      <AppText variant="captionSM" tone="body">{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  back: {
    position: 'absolute',
    zIndex: 2,
    width: 38,
    height: 38,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.canvas,
    ...shadow,
  },
  content: {
    paddingBottom: spacing.section,
  },
  photo: {
    aspectRatio: 4 / 3,
    backgroundColor: colors.surfaceStrong,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xxs + 2,
    paddingTop: spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.hairline,
  },
  dotActive: {
    backgroundColor: colors.ink,
  },
  body: {
    paddingTop: spacing.md,
    gap: spacing.xs,
  },
  price: {
    paddingTop: spacing.xxs,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs + 2,
  },
  actions: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  soldPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.ink,
  },
  divider: {
    height: 1,
    backgroundColor: colors.hairlineSoft,
    marginVertical: spacing.md,
  },
  documents: {
    gap: spacing.sm,
  },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSoft,
  },
  documentPressed: {
    backgroundColor: colors.surfaceStrong,
  },
  documentBody: {
    flex: 1,
    gap: 1,
  },
});
