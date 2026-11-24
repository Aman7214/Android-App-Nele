import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { SecondaryButton } from './Buttons';

type Props = { loading?: boolean; error?: Error | null; onRetry?: () => void };

export function ConnectionStatus({ loading, error, onRetry }: Props) {
  if (!loading && !error) return null;
  return (
    <View style={styles.container} accessibilityLiveRegion="polite">
      {loading ? <ActivityIndicator color={colors.primary} accessibilityLabel="Loading properties" /> : null}
      <AppText variant="bodySM" tone="muted" center>
        {error ? error.message : 'Loading properties…'}
      </AppText>
      {error && onRetry ? <SecondaryButton label="Try again" onPress={onRetry} fullWidth={false} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.base, gap: spacing.sm, alignItems: 'center' },
});
