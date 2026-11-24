import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/nele/AppText';
import { CategoryChips } from '@/components/nele/CategoryChips';
import { ConnectionStatus } from '@/components/nele/ConnectionStatus';
import { Dropdown, type DropdownOption } from '@/components/nele/Dropdown';
import { PropertyCard } from '@/components/nele/PropertyCard';
import { PropertySkeletonList } from '@/components/nele/PropertySkeleton';
import { SearchPill } from '@/components/nele/SearchPill';
import { Screen } from '@/components/nele/Screen';
import {
  CATEGORIES,
  KIND_IDS,
  type ListingKind,
  type DealMode,
  type RentalAudience,
} from '@/data/listings';
import { DISTRICT, nearestTown, TOWNS, type TownId } from '@/data/locations';
import { usePropertyFeed } from '@/hooks/use-properties';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useLayout } from '@/theme/layout';
import { colors, radius, spacing } from '@/theme/tokens';
import { PROPERTY_LIST_PERFORMANCE } from '@/utils/list-performance';

const MODES: { id: DealMode; label: string }[] = [
  { id: 'sale', label: 'Buy' },
  { id: 'rent', label: 'Rent' },
];

const TOWN_OPTIONS: DropdownOption[] = [
  { id: 'all', label: 'All district' },
  ...TOWNS.map((town) => ({ id: town.id, label: town.label })),
];

const AUDIENCES = [
  { id: 'all', label: 'Everyone', icon: 'people-outline' },
  { id: 'students', label: 'Students', icon: 'school-outline' },
  { id: 'family', label: 'Families', icon: 'people-circle-outline' },
];

export default function ExploreScreen() {
  const [mode, setMode] = useState<DealMode>('sale');
  const [category, setCategory] = useState('all');
  const [town, setTown] = useState<string>('all');
  const [audience, setAudience] = useState<RentalAudience | 'all'>('all');
  const [query, setQuery] = useState('');
  const [locating, setLocating] = useState(false);
  const [locationNote, setLocationNote] = useState<string | null>(null);
  const search = useDebouncedValue(query.trim().slice(0, 100));
  const { width, maxContentWidth, gutter, isCompact, gridColumns } = useLayout();
  const feed = usePropertyFeed({
    mode,
    town: town === 'all' ? undefined : town as TownId,
    kind: category === 'all' ? undefined : (Object.keys(KIND_IDS) as ListingKind[]).find((kind) => KIND_IDS[kind] === category),
    audience: mode === 'rent' && audience !== 'all' ? audience : undefined,
    q: search || undefined,
  });
  const results = feed.listings;

  const where = town === 'all' ? DISTRICT : TOWNS.find((item) => item.id === town)?.label;

  /**
   * Location access outside the first-run district screen: resolve the device
   * position to the nearest service town and filter the feed by it.
   */
  const applyNearbyTown = useCallback(async () => {
    setLocating(true);
    setLocationNote(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setLocationNote('Location is blocked for Nele. Allow it in settings, or pick a town.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const near = nearestTown(position.coords.latitude, position.coords.longitude);
      setTown(near.id);
      setLocationNote(`Showing ${near.label} — the closest town to you.`);
    } catch {
      setLocationNote('Your location could not be read. Pick a town instead.');
    } finally {
      setLocating(false);
    }
  }, []);
  const gridGap = spacing.md;
  const contentWidth = maxContentWidth === null ? width : Math.min(width, maxContentWidth);
  const cardWidth = (contentWidth - gutter * 2 - gridGap * (gridColumns - 1)) / gridColumns;

  return (
    <Screen>
      <View style={[styles.header, { paddingHorizontal: gutter }]}>
        <AppText variant="displayLG">Explore</AppText>
        <AppText variant="bodySM" tone="muted">
          {results.length}{feed.hasNextPage ? '+' : ''} propert{results.length === 1 ? 'y' : 'ies'} in {where}
        </AppText>
      </View>

      <View style={[styles.controls, { paddingHorizontal: gutter }]}>
        <SearchPill value={query} onChangeText={setQuery} />

        <View style={styles.modes}>
          {MODES.map((item) => {
            const isActive = item.id === mode;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                hitSlop={4}
                onPress={() => setMode(item.id)}
                style={[
                  styles.mode,
                  isCompact && styles.modeCompact,
                  isActive && styles.modeActive,
                ]}>
                <AppText variant="buttonSM" tone={isActive ? 'onPrimary' : 'muted'}>
                  {item.label}
                </AppText>
              </Pressable>
            );
          })}
          <View style={styles.dropdownSlot}>
            <Dropdown options={TOWN_OPTIONS} selected={town} onSelect={setTown} />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Use my location to choose my town"
            accessibilityState={{ busy: locating, disabled: locating }}
            disabled={locating}
            hitSlop={4}
            onPress={() => { void applyNearbyTown(); }}
            style={[styles.nearMe, locating && styles.nearMeBusy]}>
            {locating
              ? <ActivityIndicator size="small" color={colors.ink} />
              : <Ionicons name="locate-outline" size={16} color={colors.ink} />}
            {isCompact ? null : (
              <AppText variant="captionSM" tone="body">Near me</AppText>
            )}
          </Pressable>
        </View>
        {locationNote ? (
          <AppText variant="captionSM" tone="muted">{locationNote}</AppText>
        ) : null}
      </View>

      <CategoryChips options={CATEGORIES} active={category} onChange={setCategory} />
      {mode === 'rent' ? (
        <CategoryChips
          options={AUDIENCES}
          active={audience}
          onChange={(id) => setAudience(id as RentalAudience | 'all')}
        />
      ) : null}

      <ConnectionStatus error={feed.error} onRetry={() => { void feed.refetch(); }} />

      <FlatList
        {...PROPERTY_LIST_PERFORMANCE}
        key={`grid-${gridColumns}`}
        data={results}
        keyExtractor={(item) => item.id}
        numColumns={gridColumns}
        showsVerticalScrollIndicator={false}
        refreshing={feed.isRefetching}
        onRefresh={() => { void feed.refetch(); }}
        onEndReached={feed.loadNextPage}
        onEndReachedThreshold={0.5}
        ListFooterComponent={feed.isFetchingNextPage ? <PropertySkeletonList columns={gridColumns} count={1} /> : undefined}
        columnWrapperStyle={[styles.gridRow, { gap: gridGap }]}
        contentContainerStyle={[
          styles.grid,
          { paddingHorizontal: gutter, gap: spacing.lg },
        ]}
        ListEmptyComponent={
          feed.loading ? <PropertySkeletonList columns={gridColumns} count={2} /> : feed.error ? undefined : <View style={styles.empty}>
            <Ionicons name="home-outline" size={26} color={colors.mutedSoft} />
            <AppText variant="titleMD">No matches yet</AppText>
            <AppText variant="bodySM" tone="muted" center style={styles.emptyBody}>
              Try a different town or category, or switch between Buy and Rent.
            </AppText>
          </View>
        }
        renderItem={({ item, index }) => (
          <View style={{ width: cardWidth }}>
            <PropertyCard listing={item} imagePriority={index < gridColumns ? 'high' : 'normal'} compact onPress={() => router.push(`/property/${item.id}`)} />
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.base + spacing.xs,
    gap: spacing.xs,
  },
  controls: {
    gap: spacing.base,
    paddingBottom: spacing.sm,
  },
  nearMe: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    height: 34,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.canvas,
  },
  nearMeBusy: {
    opacity: 0.6,
  },
  dropdownSlot: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  mode: {
    paddingHorizontal: spacing.base,
    height: 40,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeCompact: {
    paddingHorizontal: spacing.md,
  },
  modeActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  grid: {
    paddingTop: spacing.base,
    paddingBottom: spacing.xl,
  },
  gridRow: {
    alignItems: 'stretch',
  },
  empty: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  emptyBody: {
    maxWidth: 300,
  },
});
