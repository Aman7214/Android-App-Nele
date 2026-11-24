import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme/tokens';

export function PropertySkeleton({ compact = false }: { compact?: boolean }) {
  return <View style={styles.card} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <View style={[styles.photo, compact && styles.square]} />
    <View style={styles.lines}>
      <View style={[styles.line, styles.title]} />
      {compact ? <View style={[styles.line, styles.short]} /> : null}
      <View style={[styles.line, styles.location]} />
      <View style={[styles.line, styles.short]} />
      {!compact ? <View style={[styles.line, styles.location]} /> : null}
      <View style={[styles.line, styles.price]} />
    </View>
  </View>;
}

export function PropertySkeletonList({ columns = 1, count = 3, style }: {
  columns?: number;
  count?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.list, style]} accessible accessibilityRole="progressbar"
    accessibilityLabel="Loading properties" accessibilityState={{ busy: true }}>
    {Array.from({ length: count }, (_, row) => <View key={row} style={styles.row}>
      {Array.from({ length: columns }, (_, column) => <PropertySkeleton key={column} compact={columns > 1} />)}
    </View>)}
  </View>;
}

export function StatSkeleton() {
  return <View style={styles.stat} accessible accessibilityLabel="Loading account counts" accessibilityState={{ busy: true }}>
    <View style={[styles.line, styles.statValue]} />
  </View>;
}

const styles = StyleSheet.create({
  list: { gap: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.md },
  card: { flex: 1, gap: spacing.sm },
  photo: { aspectRatio: 4 / 3, borderRadius: radius.md, backgroundColor: colors.surfaceStrong },
  square: { aspectRatio: 1 },
  lines: { gap: spacing.xs },
  line: { height: typography.cardMeta.lineHeight, backgroundColor: colors.surfaceStrong, borderRadius: radius.xs },
  title: { height: typography.titleMD.lineHeight, width: '85%' },
  location: { width: '75%' },
  short: { width: '55%' },
  price: { height: typography.titleMD.lineHeight, width: '45%', marginTop: spacing.xs },
  stat: { height: typography.displaySM.lineHeight, justifyContent: 'center' },
  statValue: { width: 40, height: 20 },
});
