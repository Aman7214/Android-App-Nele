import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { audienceLabel, formatPrice, type Listing } from '@/data/listings';
import { townById } from '@/data/locations';
import { useSaveProperty } from '@/hooks/use-properties';
import { useAuthStore } from '@/stores/auth';
import { colors, radius, shadow, spacing, touchTarget, typography } from '@/theme/tokens';

import { AppText } from './AppText';

type Props = {
  listing: Listing;
  onPress?: () => void;
  compact?: boolean;
  showSave?: boolean;
  imagePriority?: 'low' | 'normal' | 'high';
};

/** `property-card` — photo-first, 14px clipping, heart top-right, meta beneath. */
export function PropertyCard({
  listing,
  onPress,
  compact = false,
  showSave = true,
  imagePriority = 'normal',
}: Props) {
  const saved = listing.isSaved ?? false;
  const [failedImage, setFailedImage] = useState<Props['listing']['image'] | null>(null);
  const image = failedImage === listing.image && listing.fallbackImage ? listing.fallbackImage : listing.image;
  const signedIn = useAuthStore((state) => state.user !== null);
  const save = useSaveProperty(listing.id);
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const details = [
    listing.beds ? `${listing.beds} bed${listing.beds > 1 ? 's' : ''}` : null,
    listing.areaSqft ? `${listing.areaSqft.toLocaleString('en-IN')} sq ft` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const context = [
    listing.mode === 'rent' ? 'For rent' : 'For sale',
    listing.audience ? audienceLabel(listing.audience) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const toggleSave = () => {
    if (save.pending) return;
    if (!signedIn) {
      router.push({ pathname: '/auth', params: { returnTo: '/saved' } });
      return;
    }
    save.mutate({ saved: !saved, previous: saved });
  };

  return (
    <Animated.View style={[styles.wrapper, animatedStyle]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${listing.title}, ${formatPrice(listing)}`}
        onPress={onPress}
        onPressIn={() => {
          scale.set(withSpring(0.985, { damping: 20, stiffness: 400 }));
        }}
        onPressOut={() => {
          scale.set(withSpring(1, { damping: 20, stiffness: 400 }));
        }}
        style={styles.pressable}>
        <View style={[styles.photoWrap, compact && styles.photoWrapCompact]}>
          <Image
            source={image}
            onError={() => { if (listing.fallbackImage) setFailedImage(listing.image); }}
            style={styles.photo}
            contentFit="cover"
            loading={imagePriority === 'high' ? 'eager' : 'lazy'}
            priority={imagePriority}
            cachePolicy="disk"
            recyclingKey={listing.id}
            transition={220}
            accessibilityIgnoresInvertColors
          />

          {listing.badge ? (
            <View style={[styles.badge, compact && styles.badgeCompact]}>
              <AppText variant="badge" numberOfLines={1}>
                {listing.badge}
              </AppText>
            </View>
          ) : null}
        </View>

        <View style={styles.meta}>
          <AppText
            variant={compact ? 'cardTitle' : 'titleMD'}
            numberOfLines={2}
            style={compact && styles.titleCompact}>
            {listing.title}
          </AppText>

          <AppText
            variant={compact ? 'cardMeta' : 'bodySM'}
            tone="muted"
            numberOfLines={compact ? 2 : 1}
            style={compact && styles.locationCompact}>
            {listing.kind} · {listing.locality}, {townById(listing.town).label}
          </AppText>

          <AppText variant={compact ? 'cardMeta' : 'bodySM'} tone="muted" numberOfLines={1}>
            {details}
          </AppText>
          {!compact ? (
            <AppText variant="cardMeta" tone="muted">{context}</AppText>
          ) : null}

          <View style={styles.priceRow}>
            <AppText variant="titleMD" numberOfLines={1} style={styles.price}>
              {formatPrice(listing).replace('/month', '')}
              {listing.mode === 'rent' ? (
                <AppText variant="captionSM" tone="muted"> /mo</AppText>
              ) : null}
            </AppText>
            <View style={styles.rating}>
              <Ionicons name="star" size={11} color={colors.ink} />
              <AppText variant="captionSM">{listing.rating.toFixed(2)}</AppText>
            </View>
          </View>
        </View>
      </Pressable>

      {/* Sibling of the card pressable so we never nest buttons. */}
      {showSave ? <Pressable
        accessibilityRole="button"
        accessibilityLabel={saved ? 'Remove from saved' : 'Save listing'}
        accessibilityState={{ selected: saved, disabled: save.pending, busy: save.pending }}
        disabled={save.pending}
        hitSlop={8}
        onPress={toggleSave}
        style={styles.heart}>
        {save.pending ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons
          name={saved ? 'heart' : 'heart-outline'}
          size={19}
          color={saved ? colors.primary : colors.ink}
        />}
      </Pressable> : null}
      {save.error ? <AppText variant="captionSM" style={styles.saveError} accessibilityLiveRegion="polite">{save.error.message}</AppText> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  saveError: { color: colors.error, paddingTop: spacing.sm },
  wrapper: {
    flex: 1,
  },
  pressable: {
    gap: spacing.sm,
  },
  photoWrap: {
    aspectRatio: 4 / 3,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceStrong,
  },
  photoWrapCompact: {
    aspectRatio: 1,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    backgroundColor: colors.canvas,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
    ...shadow,
  },
  badgeCompact: {
    top: spacing.sm,
    left: spacing.sm,
    maxWidth: '60%',
    paddingHorizontal: spacing.sm,
  },
  heart: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    minWidth: touchTarget - 12,
    minHeight: touchTarget - 12,
  },
  meta: {
    gap: spacing.xs,
  },
  titleCompact: {
    minHeight: typography.cardTitle.lineHeight * 2,
  },
  locationCompact: {
    minHeight: typography.cardMeta.lineHeight * 2,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    flexShrink: 0,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  price: {
    flexShrink: 1,
  },
});
