import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { AppText } from '@/components/nele/AppText';
import { PrimaryButton, SecondaryButton } from '@/components/nele/Buttons';
import { Logo } from '@/components/nele/Logo';
import { useOnboardingStore } from '@/stores/onboarding';
import { useLayout } from '@/theme/layout';
import { colors, radius, spacing, touchTarget } from '@/theme/tokens';

type Slide = {
  id: string;
  title: string;
  body: string;
  image: number;
  icon: keyof typeof Ionicons.glyphMap;
};

const SLIDES: Slide[] = [
  {
    id: 's1',
    title: 'Buy, sell or rent in Raichur district',
    body: 'Plots, land, houses, shops, warehouses and apartments across Raichur, Manvi, Sindhanur, Lingasgur and Mudgal.',
    image: require('@/assets/images/nele/onboard1.webp'),
    icon: 'home-outline',
  },
  {
    id: 's2',
    title: 'Rooms for students and families',
    body: 'Filter by town, budget and type — from hostel rooms near college to family houses and farm land.',
    image: require('@/assets/images/nele/onboard2.webp'),
    icon: 'options-outline',
  },
  {
    id: 's3',
    title: 'Deal with owners, directly',
    body: 'List your own property in minutes, message the owner, book a visit and close the deal with no middlemen.',
    image: require('@/assets/images/nele/onboard3.webp'),
    icon: 'chatbubbles-outline',
  },
];

function Dot({ active }: { active: boolean }) {
  const style = useAnimatedStyle(() => ({
    width: withTiming(active ? 24 : 8, { duration: 220 }),
    backgroundColor: withTiming(active ? colors.primary : colors.hairline, { duration: 220 }),
  }));
  return <Animated.View style={[styles.dot, style]} />;
}

export default function OnboardingRoute() {
  const { width } = useWindowDimensions();
  const { gutter, displaySize, mediaHeight, isCompact } = useLayout();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<Slide>>(null);
  const completeOnboarding = useOnboardingStore((state) => state.complete);

  const isLast = index === SLIDES.length - 1;

  /**
   * First-run order: intro slides -> sign up / sign in -> location.
   * The intro is marked done here so a returning user never sees it again.
   */
  const toAuth = useCallback((mode: 'signup' | 'signin') => {
    completeOnboarding();
    router.replace({ pathname: '/auth', params: { returnTo: '/location', mode } });
  }, [completeOnboarding]);

  const goNext = useCallback(() => {
    if (isLast) {
      toAuth('signup');
      return;
    }
    const next = Math.min(index + 1, SLIDES.length - 1);
    listRef.current?.scrollToOffset({ offset: next * width, animated: true });
    setIndex(next);
  }, [index, isLast, toAuth, width]);

  // Skipping still needs an account to post, so it lands on the same sign-up step.
  const skip = useCallback(() => toAuth('signup'), [toAuth]);

  const onMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const page = Math.round(event.nativeEvent.contentOffset.x / width);
      setIndex(Math.max(0, Math.min(page, SLIDES.length - 1)));
    },
    [width]
  );

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom + spacing.lg }]}>
      <FlatList
        initialNumToRender={1}
        maxToRenderPerBatch={1}
        windowSize={3}
        ref={listRef}
        style={{ height: mediaHeight, flexGrow: 0 }}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        getItemLayout={(_, itemIndex) => ({
          length: width,
          offset: width * itemIndex,
          index: itemIndex,
        })}
        renderItem={({ item, index: slideIndex }) => (
          <View style={{ width }}>
            <View style={[styles.media, { height: mediaHeight }]}>
              <Image
                source={item.image}
                style={styles.image}
                contentFit="cover"
                loading={slideIndex === index ? 'eager' : 'lazy'}
                priority={slideIndex === index ? 'high' : 'normal'}
                recyclingKey={item.id}
                cachePolicy="disk"
                transition={260}
                accessibilityIgnoresInvertColors
              />
              <View style={styles.mediaScrim} />
            </View>
          </View>
        )}
      />

      <View style={[styles.brandRow, { top: insets.top + spacing.sm, left: gutter }]}>
        <View style={styles.brandChip}>
          <Logo size={26} />
          <AppText variant="titleSM" tone="onPrimary">
            Nele
          </AppText>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Skip onboarding"
        onPress={skip}
        hitSlop={10}
        style={[styles.skip, { top: insets.top + spacing.sm, right: gutter }]}>
        <AppText variant="caption" tone="muted">
          Skip
        </AppText>
      </Pressable>

      <Animated.View
        key={index}
        entering={FadeIn.duration(320)}
        style={[styles.copy, isCompact && styles.copyCompact, { paddingHorizontal: gutter }]}>
        <View style={[styles.iconRing, isCompact && styles.iconRingCompact]}>
          <Ionicons name={SLIDES[index].icon} size={20} color={colors.primary} />
        </View>
        <AppText
          center
          style={[
            styles.title,
            { fontSize: displaySize.fontSize, lineHeight: displaySize.lineHeight },
          ]}>
          {SLIDES[index].title}
        </AppText>
        <AppText
          variant="bodyMD"
          tone="muted"
          center
          style={[styles.body, { maxWidth: Math.min(340, width - gutter * 2) }]}>
          {SLIDES[index].body}
        </AppText>
      </Animated.View>

      <Animated.View
        entering={FadeIn.duration(300)}
        style={[styles.footer, { paddingHorizontal: gutter }]}>
        <View style={styles.dots}>
          {SLIDES.map((slide, dotIndex) => (
            <Dot key={slide.id} active={dotIndex === index} />
          ))}
        </View>

        <PrimaryButton label={isLast ? 'Get started' : 'Next'} onPress={goNext} />

        {isLast ? (
          <SecondaryButton label="I already have an account" tone="ghost" onPress={() => toAuth('signin')} />
        ) : (
          <AppText variant="captionSM" tone="mutedSoft" center>
            Swipe to see what Nele can do
          </AppText>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  media: {
    height: 380,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  mediaScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  brandRow: {
    position: 'absolute',
    left: spacing.base,
  },
  brandChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(34,34,34,0.45)',
    paddingRight: spacing.md,
    paddingLeft: spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  skip: {
    position: 'absolute',
    right: spacing.base,
    height: 36,
    minWidth: touchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.base,
    alignItems: 'center',
    gap: spacing.sm,
  },
  copyCompact: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.xxs,
  },
  iconRing: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  iconRingCompact: {
    width: 36,
    height: 36,
    marginBottom: 0,
  },
  title: {
    marginTop: spacing.xxs,
  },
  body: {
    maxWidth: 340,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  dot: {
    height: 8,
    borderRadius: radius.full,
  },
});
