import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputInstance } from 'react-native';

import { colors, radius, shadow, spacing, touchTarget, typography } from '@/theme/tokens';

type Props = {
  value: string;
  onChangeText: (value: string) => void;
};

/** Editable search field that keeps results on the current screen. */
export function SearchPill({ value, onChangeText }: Props) {
  const inputRef = useRef<TextInputInstance | null>(null);
  const [focused, setFocused] = useState(false);

  const submit = () => {
    if (value.trim()) {
      onChangeText(value.trim());
      inputRef.current?.blur();
    } else {
      inputRef.current?.focus();
    }
  };

  return (
    <View
      accessibilityRole="search"
      style={[styles.shell, shadow, focused && styles.shellFocused]}>
      <Ionicons name="search-outline" size={20} color={colors.muted} />
      <TextInput
        ref={inputRef}
        role="searchbox"
        accessibilityLabel="Search properties"
        accessibilityHint="Filters properties on this screen."
        placeholder="Search properties"
        placeholderTextColor={colors.muted}
        value={value}
        maxLength={100}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onSubmitEditing={submit}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        underlineColorAndroid="transparent"
        style={styles.input}
      />

      {value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={8}
          onPress={() => {
            onChangeText('');
            inputRef.current?.focus();
          }}
          style={styles.clear}>
          <Ionicons name="close-circle" size={20} color={colors.muted} />
        </Pressable>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Search properties"
        hitSlop={4}
        onPress={submit}
        style={({ pressed }) => [styles.orb, pressed && styles.orbPressed]}>
        <Ionicons name="search" size={19} color={colors.onPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingLeft: spacing.base,
    paddingRight: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surfaceSoft,
    gap: spacing.sm,
  },
  shellFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.canvas,
  },
  input: {
    ...typography.bodyMD,
    flex: 1,
    minWidth: 0,
    color: colors.ink,
    height: touchTarget,
    padding: 0,
    outlineWidth: 0,
  },
  clear: {
    flexShrink: 0,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orb: {
    flexShrink: 0,
    width: touchTarget - spacing.sm,
    height: touchTarget - spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbPressed: {
    backgroundColor: colors.primaryActive,
  },
});
