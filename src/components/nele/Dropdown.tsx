import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View, type HostInstance, type LayoutRectangle } from 'react-native';

import { useLayout } from '@/theme/layout';
import { colors, radius, shadow, spacing } from '@/theme/tokens';

import { AppText } from './AppText';

export type DropdownOption = { id: string; label: string };

type Props = {
  options: DropdownOption[];
  selected: string;
  onSelect: (id: string) => void;
  accessibilityLabel?: string;
};

/** Anchored dropdown — pill button that opens a menu under its tap point. */
export function Dropdown({ options, selected, onSelect, accessibilityLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<LayoutRectangle | null>(null);
  const anchorRef = useRef<HostInstance | null>(null);
  const { width, gutter } = useLayout();

  const current = options.find((option) => option.id === selected) ?? options[0];

  const openMenu = useCallback(() => {
    anchorRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setOpen(true);
    });
  }, []);

  const choose = useCallback(
    (id: string) => {
      onSelect(id);
      setOpen(false);
    },
    [onSelect]
  );

  return (
    <View ref={anchorRef} collapsable={false} style={styles.anchor}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? current.label}
        accessibilityState={{ expanded: open }}
        hitSlop={4}
        onPress={openMenu}
        style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}>
        <Ionicons name="location" size={14} color={colors.primary} />
        <AppText variant="buttonSM" numberOfLines={1} style={styles.pillLabel}>
          {current.label}
        </AppText>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={13} color={colors.muted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          accessibilityLabel="Close menu"
          style={styles.backdrop}
          onPress={() => setOpen(false)}>
          {anchor ? (
            <View
              style={[
                styles.menu,
                shadow,
                {
                  top: anchor.y + anchor.height + spacing.sm,
                  right: Math.max(gutter, width - anchor.x - anchor.width),
                  width: Math.min(220, width - gutter * 2),
                },
              ]}>
              {options.map((option) => {
                const isActive = option.id === current.id;
                return (
                  <Pressable
                    key={option.id}
                    accessibilityRole="menuitem"
                    onPress={() => choose(option.id)}
                    style={({ pressed }) => [
                      styles.item,
                      isActive && styles.itemActive,
                      pressed && styles.itemPressed,
                    ]}>
                    <AppText
                      variant="bodySM"
                      tone={isActive ? 'primary' : 'ink'}
                      style={styles.itemLabel}>
                      {option.label}
                    </AppText>
                    {isActive ? (
                      <Ionicons name="checkmark" size={16} color={colors.primary} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    alignSelf: 'flex-start',
    flexShrink: 1,
    maxWidth: '100%',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    height: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.canvas,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  pillPressed: {
    backgroundColor: colors.surfaceSoft,
  },
  pillLabel: {
    flexShrink: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  menu: {
    position: 'absolute',
    backgroundColor: colors.canvas,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    paddingVertical: spacing.xs,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.base,
    paddingHorizontal: spacing.base,
    minHeight: 48,
    paddingVertical: spacing.md,
  },
  itemActive: {
    backgroundColor: colors.primarySoft,
  },
  itemPressed: {
    backgroundColor: colors.surfaceSoft,
  },
  itemLabel: {
    flexShrink: 1,
  },
});
