import { router } from 'expo-router';
import { useMemo, useRef } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/nele/AppText';
import { PrimaryButton, SecondaryButton } from '@/components/nele/Buttons';
import { ConnectionStatus } from '@/components/nele/ConnectionStatus';
import { PropertyCard } from '@/components/nele/PropertyCard';
import { PropertySkeletonList } from '@/components/nele/PropertySkeleton';
import { Screen } from '@/components/nele/Screen';
import { imageAssetForKind } from '@/data/listing-images';
import type { Listing } from '@/data/listings';
import { useCreateProperty, usePropertyFeed, useUpdateListingStatus } from '@/hooks/use-properties';
import { useAuthStore } from '@/stores/auth';
import { useMyListingsStore } from '@/stores/my-listings';
import { useLayout } from '@/theme/layout';
import { spacing } from '@/theme/tokens';
import { PROPERTY_LIST_PERFORMANCE } from '@/utils/list-performance';

type PropertyRow =
  | { kind: 'published'; listing: Listing }
  | { kind: 'device'; listing: Listing }
  | { kind: 'device-header' }
  | { kind: 'next-page' };

const rowKey = (row: PropertyRow) => 'listing' in row ? `${row.kind}:${row.listing.id}` : row.kind;

function DeviceProperty({ listing }: { listing: Listing }) {
  const publish = useCreateProperty();
  const publishing = useRef(false);
  const remove = useMyListingsStore((state) => state.removeListing);
  const user = useAuthStore((state) => state.user);
  const post = async () => {
    if (publishing.current) return;
    if (!user) { router.push({ pathname: '/auth', params: { returnTo: '/my-properties' } }); return; }
    publishing.current = true;
    try {
      await publish.mutateAsync({
        requestId: `legacy-${listing.id}`, title: listing.title, kind: listing.kind,
        locality: listing.locality, town: listing.town, price: listing.price, mode: listing.mode,
        audience: listing.mode === 'rent' ? listing.audience ?? 'anyone' : undefined,
        beds: listing.beds, baths: listing.baths, areaSqft: listing.areaSqft,
        imageAsset: imageAssetForKind(listing.kind),
      });
      remove(listing.id);
    } catch { /* Keep the on-device property available for retry. */ }
    finally { publishing.current = false; }
  };
  return <View style={styles.deviceProperty}>
    <PropertyCard listing={{ ...listing, badge: 'On this device' }} showSave={false} />
    <PrimaryButton label={publish.isPending ? 'Posting property…' : 'Publish this property'} disabled={publish.isPending} onPress={() => { void post(); }} />
    <ConnectionStatus error={publish.error} />
  </View>;
}

function PublishedProperty({ listing, index }: { listing: Listing; index: number }) {
  const update = useUpdateListingStatus();
  const sold = listing.status === 'sold';
  return <View style={styles.deviceProperty}>
    <PropertyCard
      listing={{ ...listing, badge: sold ? 'Sold' : 'Yours' }}
      imagePriority={index < 2 ? 'high' : 'normal'}
      onPress={() => router.push(`/property/${listing.id}`)}
    />
    <SecondaryButton
      label={update.isPending ? 'Updating…' : sold ? 'Put back on the market' : 'Mark as sold'}
      icon={sold ? 'refresh' : 'checkmark-done'}
      disabled={update.isPending}
      onPress={() => update.mutate({ listingId: listing.id, status: sold ? 'active' : 'sold' })}
    />
    <ConnectionStatus error={update.error} />
  </View>;
}

export default function MyPropertiesScreen() {
  const { gutter } = useLayout();
  const user = useAuthStore((state) => state.user);
  const ready = useAuthStore((state) => state.ready);
  const feed = usePropertyFeed({}, 'mine');
  const device = useMyListingsStore((state) => state.listings);
  const rows = useMemo(() => {
    const result: PropertyRow[] = [];
    for (const listing of feed.listings) result.push({ kind: 'published', listing });
    if (feed.isFetchingNextPage) result.push({ kind: 'next-page' });
    if (device.length) result.push({ kind: 'device-header' });
    for (const listing of device) result.push({ kind: 'device', listing });
    return result;
  }, [feed.listings, feed.isFetchingNextPage, device]);
  return <Screen>
    <FlatList
      {...PROPERTY_LIST_PERFORMANCE}
      data={rows}
      keyExtractor={rowKey}
      contentContainerStyle={[styles.content, { paddingHorizontal: gutter }]}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      refreshing={feed.isRefetching}
      onRefresh={() => { if (user) void feed.refetch(); }}
      onEndReached={feed.loadNextPage}
      onEndReachedThreshold={0.5}
      ListHeaderComponent={<View style={styles.header}>
        <SecondaryButton label="Back to profile" icon="arrow-back" fullWidth={false} onPress={() => router.replace('/profile')} />
        <AppText variant="displayLG">My properties</AppText>
        <ConnectionStatus error={feed.error} onRetry={() => { void feed.refetch(); }} />
        {ready && !user ? <PrimaryButton label="Sign in to see your properties" onPress={() => router.push({ pathname: '/auth', params: { returnTo: '/my-properties' } })} /> : null}
        {!feed.listings.length ? !ready || feed.loading ? <PropertySkeletonList /> : user && !feed.error ? <AppText variant="bodyMD" tone="muted">Your published properties will appear here.</AppText> : null : null}
      </View>}
      renderItem={({ item, index }) => {
        switch (item.kind) {
          case 'published': return <PublishedProperty listing={item.listing} index={index} />;
          case 'device': return <DeviceProperty listing={item.listing} />;
          case 'next-page': return <PropertySkeletonList count={1} />;
          case 'device-header': return <View style={styles.deviceHeader}>
            <AppText variant="displaySM">Properties on this device</AppText>
            <AppText variant="bodySM" tone="muted">These were saved before account publishing was available. Review each property and publish it to make it visible to others.</AppText>
          </View>;
        }
      }}
      ListFooterComponent={<View style={styles.footer}>
        <PrimaryButton label="List a new property" icon="add" onPress={() => router.push('/list')} />
      </View>}
    />
  </Screen>;
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  header: { gap: spacing.base, paddingBottom: spacing.lg },
  separator: { height: spacing.lg },
  footer: { gap: spacing.base, paddingTop: spacing.lg },
  deviceHeader: { gap: spacing.sm },
  deviceProperty: { gap: spacing.md },
});
