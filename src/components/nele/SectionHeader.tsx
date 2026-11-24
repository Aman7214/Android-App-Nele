import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { useLayout } from '@/theme/layout';
import { colors, radius, spacing, touchTarget } from '@/theme/tokens';

import { AppText } from './AppText';

type Props = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function SectionHeader({ title, actionLabel, onAction }: Props) {
  const { gutter } = useLayout();

  return (
    <View style={[styles.row, { paddingHorizontal: gutter }]}>
      <AppText variant="displaySM" style={styles.title}>{title}</AppText>
      {actionLabel ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          hitSlop={8}
          style={styles.action}>
          <AppText variant="caption" tone="muted">
            {actionLabel}
          </AppText>
          <Ionicons name="arrow-forward" size={14} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

type HeaderActionProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  badge?: boolean;
};

/** Circular 40px outline icon button used in screen headers. */
export function HeaderIconButton({ icon, label, onPress, badge = false }: HeaderActionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
      <Ionicons name={icon} size={20} color={colors.ink} />
      {badge ? <View style={styles.dot} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xl,
    paddingBottom: spacing.base,
    gap: spacing.base,
  },
  title: {
    flex: 1,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 0,
    minHeight: 40,
  },
  iconButton: {
    width: 40,
    height: 40,
    minWidth: touchTarget - 8,
    minHeight: touchTarget - 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.canvas,
  },
  pressed: {
    opacity: 0.65,
  },
  dot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 7,
    height: 7,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
});
