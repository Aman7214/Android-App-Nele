import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/nele/AppText';
import { PrimaryButton } from '@/components/nele/Buttons';
import { ConnectionStatus } from '@/components/nele/ConnectionStatus';
import { PropertyCard } from '@/components/nele/PropertyCard';
import { PropertySkeletonList } from '@/components/nele/PropertySkeleton';
import { Screen } from '@/components/nele/Screen';
import { usePropertyFeed } from '@/hooks/use-properties';
import { useAuthStore } from '@/stores/auth';
import { useLayout } from '@/theme/layout';
import { colors, radius, spacing } from '@/theme/tokens';
import { PROPERTY_LIST_PERFORMANCE } from '@/utils/list-performance';

export default function SavedScreen() {
  const user = useAuthStore((state) => state.user);
  const ready = useAuthStore((state) => state.ready);
  const feed = usePropertyFeed({}, 'saved');
  const { gutter } = useLayout();
  const saved = feed.listings;

  return (
    <Screen>
      <View style={[styles.header, { paddingHorizontal: gutter }]}>
        <AppText variant="displayLG">Saved</AppText>
        <AppText variant="bodySM" tone="muted">
          {user ? `${saved.length}${feed.hasNextPage ? '+' : ''} properties you liked` : 'Keep your favourite properties together'}
        </AppText>
      </View>

      <ConnectionStatus error={feed.error} onRetry={() => { void feed.refetch(); }} />
      {ready && !user ? (
        <View style={[styles.empty, { paddingHorizontal: gutter }]}>
          <AppText variant="displaySM" center>Save properties to your account</AppText>
          <AppText variant="bodySM" tone="muted" center style={styles.emptyBody}>Sign in to find your saved properties on any device.</AppText>
          <PrimaryButton label="Sign in" onPress={() => router.push({ pathname: '/auth', params: { returnTo: '/saved' } })} style={styles.emptyButton} />
        </View>
      ) : !feed.loading && !feed.error && saved.length === 0 ? (
        <View style={[styles.empty, { paddingHorizontal: gutter }]}>
          <View style={styles.emptyIcon}>
            <Ionicons name="heart-outline" size={28} color={colors.primary} />
          </View>
          <AppText variant="displaySM" center>
            Nothing saved yet
          </AppText>
          <AppText variant="bodySM" tone="muted" center style={styles.emptyBody}>
            Tap the heart on any listing to keep it here for later.
          </AppText>
          <PrimaryButton
            label="Explore properties"
            onPress={() => router.push('/explore')}
            style={styles.emptyButton}
          />
        </View>
      ) : (
        <FlatList
          {...PROPERTY_LIST_PERFORMANCE}
          data={saved}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          refreshing={feed.isRefetching}
          onRefresh={() => { void feed.refetch(); }}
          onEndReached={feed.loadNextPage}
          onEndReachedThreshold={0.5}
          contentContainerStyle={[styles.list, { paddingHorizontal: gutter }]}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={!ready || feed.loading ? <PropertySkeletonList /> : undefined}
          ListFooterComponent={
            <View style={styles.footer}>
              <AppText variant="bodySM" tone="muted" center>
                Saved to your account, so you can find them on any device.
              </AppText>
              <PrimaryButton label="Find more properties" onPress={() => router.push('/explore')} />
              {feed.isFetchingNextPage ? <PropertySkeletonList count={1} /> : null}
            </View>
          }
          renderItem={({ item, index }) => (
            <PropertyCard
              listing={item}
              imagePriority={index < 2 ? 'high' : 'normal'}
              onPress={() => router.push(`/property/${item.id}`)}
            />
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.base + spacing.xs,
    gap: spacing.xs,
  },
  list: {
    paddingBottom: spacing.xl,
  },
  separator: {
    height: spacing.lg,
  },
  footer: {
    paddingTop: spacing.xl,
    gap: spacing.md,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: spacing.section,
    gap: spacing.sm,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyBody: {
    maxWidth: 280,
  },
  emptyButton: {
    marginTop: spacing.base,
  },
});
