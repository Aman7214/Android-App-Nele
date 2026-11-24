import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLayout } from '@/theme/layout';
import { colors } from '@/theme/tokens';

type Props = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  /** Set false for full-bleed screens (onboarding, splash). */
  padsTop?: boolean;
}>;

/**
 * Page shell: safe-area aware, and centres content with a readable measure on
 * tablets while staying full-bleed on phones.
 */
export function Screen({ children, style, padsTop = true }: Props) {
  const insets = useSafeAreaInsets();
  const { maxContentWidth } = useLayout();

  return (
    <View style={[styles.root, padsTop && { paddingTop: insets.top }, style]}>
      <View style={[styles.inner, maxContentWidth !== null && { maxWidth: maxContentWidth }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  inner: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
  },
});
