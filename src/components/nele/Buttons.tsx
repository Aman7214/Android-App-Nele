import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { colors, radius, spacing, touchTarget } from '@/theme/tokens';

import { AppText } from './AppText';

type Props = {
  label: string;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** `button-primary` — Rausch fill, 8px radius, 48px tall, weight 500. */
export function PrimaryButton({
  label,
  onPress,
  icon,
  disabled = false,
  fullWidth = true,
  style,
}: Props) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[fullWidth && styles.fullWidth, animatedStyle, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        onPressIn={() => {
          scale.set(withSpring(0.98, { damping: 18, stiffness: 400 }));
        }}
        onPressOut={() => {
          scale.set(withSpring(1, { damping: 18, stiffness: 400 }));
        }}
        style={[styles.base, disabled ? styles.disabled : styles.enabled]}>
        {icon ? <Ionicons name={icon} size={18} color={colors.onPrimary} /> : null}
        <AppText variant="buttonMD" tone="onPrimary">
          {label}
        </AppText>
      </Pressable>
    </Animated.View>
  );
}

type SecondaryProps = Props & { tone?: 'outline' | 'ghost' };

/** `button-secondary` (1px ink outline) and `button-tertiary-text` (plain label). */
export function SecondaryButton({
  label,
  onPress,
  icon,
  tone = 'outline',
  fullWidth = true,
  style,
  disabled = false,
}: SecondaryProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        fullWidth && styles.fullWidth,
        tone === 'outline' ? styles.outline : styles.ghost,
        pressed && styles.pressed,
        disabled && styles.pressed,
        style,
      ]}>
      {icon ? <Ionicons name={icon} size={18} color={colors.ink} /> : null}
      <AppText variant="buttonMD">{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touchTarget,
    height: 48,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  enabled: {
    backgroundColor: colors.primary,
  },
  disabled: {
    backgroundColor: colors.primaryDisabled,
  },
  outline: {
    borderWidth: 1,
    borderColor: colors.ink,
    backgroundColor: colors.canvas,
  },
  ghost: {
    backgroundColor: 'transparent',
    height: 'auto',
    minHeight: 0,
    paddingHorizontal: spacing.sm,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  pressed: {
    opacity: 0.7,
  },
});
