import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { colors, typography } from '@/theme/tokens';

export type TextVariant = keyof typeof typography;

type Tone = 'ink' | 'body' | 'muted' | 'mutedSoft' | 'primary' | 'onPrimary';

const toneColor: Record<Tone, string> = {
  ink: colors.ink,
  body: colors.body,
  muted: colors.muted,
  mutedSoft: colors.mutedSoft,
  primary: colors.primary,
  onPrimary: colors.onPrimary,
};

export type AppTextProps = TextProps & {
  variant?: TextVariant;
  tone?: Tone;
  center?: boolean;
};

export function AppText({
  variant = 'bodyMD',
  tone = 'ink',
  center = false,
  style,
  ...rest
}: AppTextProps) {
  return (
    <Text
      {...rest}
      style={[
        styles.base,
        typography[variant] as TextStyle,
        { color: toneColor[tone] },
        center && styles.center,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    // System stack; Inter/system sans is the documented Cereal substitute.
    fontFamily: undefined,
  },
  center: {
    textAlign: 'center',
  },
});
