import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/nele/AppText';
import { SecondaryButton } from '@/components/nele/Buttons';
import { CategoryChips } from '@/components/nele/CategoryChips';
import { ConnectionStatus } from '@/components/nele/ConnectionStatus';
import { Logo } from '@/components/nele/Logo';
import { PropertyCard } from '@/components/nele/PropertyCard';
import { PropertySkeletonList } from '@/components/nele/PropertySkeleton';
import { Screen } from '@/components/nele/Screen';
import { SearchPill } from '@/components/nele/SearchPill';
import { HeaderIconButton, SectionHeader } from '@/components/nele/SectionHeader';
import { CATEGORIES, KIND_IDS, type ListingKind } from '@/data/listings';
import { DISTRICT, townById } from '@/data/locations';
import { useLocationStore } from '@/stores/location';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { usePropertyFeed } from '@/hooks/use-properties';
import { useLayout } from '@/theme/layout';
import { colors, radius, spacing } from '@/theme/tokens';
import { PROPERTY_LIST_PERFORMANCE } from '@/utils/list-performance';

export default function HomeScreen() {
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const { gutter, isCompact } = useLayout();
  const townId = useLocationStore((state) => state.town);
  const search = useDebouncedValue(query.trim().slice(0, 100));
  const feed = usePropertyFeed({
    town: townId ?? undefined,
    kind: category === 'all' ? undefined : (Object.keys(KIND_IDS) as ListingKind[]).find((kind) => KIND_IDS[kind] === category),
    q: search || undefined,
  });
  const listings = feed.listings;

  const town = townId ? townById(townId) : null;
  const where = town?.label ?? DISTRICT;
  const hasQuery = query.trim().length > 0;

  return (
    <Screen>
      <FlatList
        {...PROPERTY_LIST_PERFORMANCE}
        data={listings}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshing={feed.isRefetching}
        onRefresh={() => { void feed.refetch(); }}
        onEndReached={feed.loadNextPage}
        onEndReachedThreshold={0.5}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View>
            <View
              style={[
                styles.header,
                { paddingHorizontal: gutter, paddingTop: isCompact ? spacing.sm : spacing.md },
              ]}>
              <Logo size={isCompact ? 30 : 32} showWordmark />
              <View style={styles.headerActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Change town"
                  onPress={() => router.push({ pathname: '/location', params: { from: 'home' } })}
                  style={({ pressed }) => [styles.townPill, pressed && styles.pressed]}>
                  <Ionicons name="location" size={14} color={colors.primary} />
                  <AppText variant="buttonSM" numberOfLines={1}>
                    {town?.label ?? 'Choose town'}
                  </AppText>
                  <Ionicons name="chevron-down" size={12} color={colors.muted} />
                </Pressable>
                <HeaderIconButton icon="notifications-outline" label="Notifications" badge />
              </View>
            </View>

            <View style={[styles.hero, { paddingHorizontal: gutter }]}>
              <AppText style={styles.heroTitle}>
                Find your next place in {where}
              </AppText>
              <AppText variant="bodySM" tone="muted" style={styles.heroBody}>
                Buy, sell or rent nearby.
              </AppText>
            </View>

            <View style={[styles.searchWrap, { paddingHorizontal: gutter }]}>
              <SearchPill value={query} onChangeText={setQuery} />
            </View>

            <View style={styles.chipsWrap}>
              <CategoryChips options={CATEGORIES} active={category} onChange={setCategory} />
            </View>

            <SectionHeader
              title={hasQuery
                ? `${listings.length}${feed.hasNextPage ? '+' : ''} ${listings.length === 1 ? 'property' : 'properties'} found`
                : town ? `Featured in ${town.label}` : `Featured across ${DISTRICT}`}
              actionLabel={hasQuery ? undefined : 'See all'}
              onAction={() => router.push('/explore')}
            />
            <ConnectionStatus error={feed.error} onRetry={() => { void feed.refetch(); }} />
          </View>
        }
        ListEmptyComponent={
          feed.loading ? <PropertySkeletonList style={{ paddingHorizontal: gutter }} /> : feed.error ? undefined : <View style={[styles.empty, { paddingHorizontal: gutter }]}>
            <AppText variant="titleMD">
              {hasQuery ? 'No matching properties' : 'Nothing here yet'}
            </AppText>
            <AppText variant="bodySM" tone="muted" center>
              {hasQuery
                ? 'Try another locality, property type or category.'
                : `No ${category === 'all' ? '' : 'matching '}listings in ${where} right now. Try another town.`}
            </AppText>
            {hasQuery ? (
              <SecondaryButton
                label="Clear search"
                fullWidth={false}
                onPress={() => setQuery('')}
                style={styles.clearSearch}
              />
            ) : null}
          </View>
        }
        ListFooterComponent={feed.isFetchingNextPage ? <PropertySkeletonList count={1} style={{ paddingHorizontal: gutter }} /> : <View style={styles.footerSpace} />}
        renderItem={({ item, index }) => (
          <View style={{ paddingHorizontal: gutter }}>
            <PropertyCard listing={item} imagePriority={index < 2 ? 'high' : 'normal'} onPress={() => router.push({ pathname: '/property/[id]', params: { id: item.id } })} />
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  townPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.canvas,
    maxWidth: 170,
  },
  pressed: {
    opacity: 0.65,
  },
  hero: {
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  heroTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '500',
    color: colors.ink,
    letterSpacing: -0.2,
  },
  heroBody: {
    lineHeight: 22,
  },
  searchWrap: {
    paddingTop: spacing.lg,
  },
  chipsWrap: {
    paddingTop: spacing.md,
  },
  separator: {
    height: spacing.lg,
  },
  empty: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.xs,
  },
  clearSearch: {
    marginTop: spacing.md,
  },
  footerSpace: {
    height: spacing.sm,
  },
});
