import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { useLayout } from '@/theme/layout';
import { colors, radius, spacing } from '@/theme/tokens';

import { AppText } from './AppText';

export type ChipOption = { id: string; label: string; icon?: string };

type Props = {
  options: ChipOption[];
  active: string;
  onChange: (id: string) => void;
};

/** `category-strip` — scrollable chips, ink when active, muted otherwise. */
export function CategoryChips({ options, active, onChange }: Props) {
  const { gutter, isCompact } = useLayout();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroller}
      contentContainerStyle={[styles.row, { paddingHorizontal: gutter }]}>
      {options.map((option) => {
        const isActive = option.id === active;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            hitSlop={4}
            onPress={() => onChange(option.id)}
            style={[styles.chip, isCompact && styles.chipCompact, isActive && styles.chipActive]}>
            {option.icon ? (
              <Ionicons
                name={option.icon as keyof typeof Ionicons.glyphMap}
                size={isCompact ? 15 : 16}
                color={isActive ? colors.onPrimary : colors.muted}
              />
            ) : null}
            <AppText
              variant="buttonSM"
              tone={isActive ? 'onPrimary' : 'muted'}
              numberOfLines={1}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // On web a horizontal ScrollView stretches under a column parent; pin its
  // growth so the rows below it never get squeezed off screen.
  scroller: {
    flexGrow: 0,
    flexShrink: 0,
  },
  row: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    height: 40,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.canvas,
  },
  chipCompact: {
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  chipActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
});
