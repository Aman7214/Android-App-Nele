import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme/tokens';

import { AppText } from './AppText';

type Props = {
  size?: number;
  /** Wordmark shown next to the mark. */
  showWordmark?: boolean;
  wordmarkColor?: string;
};

/**
 * Nele mark: a coral rounded tile holding an "N" and a small roof notch.
 * Drawn with views so it stays crisp at any size and needs no asset.
 */
export function Logo({ size = 72, showWordmark = false, wordmarkColor = colors.ink }: Props) {
  const radiusSize = size * 0.3;

  return (
    <View style={styles.row}>
      <View
        style={[
          styles.mark,
          {
            width: size,
            height: size,
            borderRadius: radiusSize,
          },
        ]}>
        <View
          style={[
            styles.roof,
            {
              width: size * 0.34,
              height: size * 0.1,
              borderRadius: size * 0.06,
              top: size * 0.18,
            },
          ]}
        />
        <AppText
          style={{
            fontSize: size * 0.46,
            lineHeight: size * 0.56,
            fontWeight: '700',
            color: colors.onPrimary,
            letterSpacing: -1,
          }}>
          N
        </AppText>
      </View>

      {showWordmark ? (
        <AppText
          style={{
            fontSize: size * 0.44,
            lineHeight: size * 0.52,
            fontWeight: '700',
            letterSpacing: -0.8,
            color: wordmarkColor,
          }}>
          Nele
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  mark: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  roof: {
    position: 'absolute',
    backgroundColor: colors.onPrimary,
    opacity: 0.9,
  },
});
