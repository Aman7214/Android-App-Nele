import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/nele/AppText';
import { PrimaryButton, SecondaryButton } from '@/components/nele/Buttons';
import { ConnectionStatus } from '@/components/nele/ConnectionStatus';
import { StatSkeleton } from '@/components/nele/PropertySkeleton';
import { Screen } from '@/components/nele/Screen';
import { HeaderIconButton } from '@/components/nele/SectionHeader';
import { ProfileAvatar } from '@/components/nele/ProfileAvatar';
import { useProfile } from '@/hooks/use-profile';
import { useAccountCounts } from '@/hooks/use-properties';
import { useAuthStore } from '@/stores/auth';
import { useMyListingsStore } from '@/stores/my-listings';
import { useLayout } from '@/theme/layout';
import { colors, radius, shadow, spacing } from '@/theme/tokens';

type Row = {
  id: string;
  label: string;
  hint?: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Visible but not usable yet — shown with a lock instead of a chevron. */
  locked?: boolean;
};

const ACCOUNT_ROWS: Row[] = [
  { id: 'listings', label: 'My properties', icon: 'business-outline' },
  { id: 'messages', label: 'Messages', icon: 'chatbubbles-outline' },
  { id: 'visits', label: 'Scheduled visits', icon: 'calendar-outline' },
  // Deliberately locked: no money moves through Nele yet.
  { id: 'payments', label: 'Payments & payouts', icon: 'card-outline', locked: true },
];

const SUPPORT_ROWS: Row[] = [
  { id: 'agent', label: 'Booking agent', icon: 'call-outline' },
  { id: 'help', label: 'Help centre', icon: 'help-circle-outline' },
  { id: 'settings', label: 'Settings', icon: 'settings-outline' },
  { id: 'legal', label: 'Terms & privacy', icon: 'shield-checkmark-outline' },
];

function Stat({ value, label, loading = false }: { value: string; label: string; loading?: boolean }) {
  return (
    <View style={styles.stat}>
      {loading ? <StatSkeleton /> : <AppText variant="displaySM">{value}</AppText>}
      <AppText variant="captionSM" tone="muted">
        {label}
      </AppText>
    </View>
  );
}

function MenuRow({ row, onPress }: { row: Row; onPress?: () => void }) {
  if (row.locked) {
    return (
      <View
        accessibilityRole="text"
        accessibilityLabel={`${row.label}, coming soon`}
        style={[styles.row, styles.rowLocked]}>
        <View style={styles.rowIcon}>
          <Ionicons name={row.icon} size={19} color={colors.mutedSoft} />
        </View>
        <AppText variant="bodyMD" tone="muted" style={styles.rowLabel}>
          {row.label}
        </AppText>
        <View style={styles.lockPill}>
          <Ionicons name="lock-closed" size={11} color={colors.muted} />
          <AppText variant="badge" tone="muted">Coming soon</AppText>
        </View>
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={row.label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <View style={styles.rowIcon}>
        <Ionicons name={row.icon} size={19} color={colors.ink} />
      </View>
      <AppText variant="bodyMD" style={styles.rowLabel}>
        {row.label}
      </AppText>
      {row.hint ? (
        <AppText variant="captionSM" tone="muted">
          {row.hint}
        </AppText>
      ) : null}
      <Ionicons name="chevron-forward" size={16} color={colors.mutedSoft} />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { gutter, isCompact } = useLayout();
  const user = useAuthStore((state) => state.user);
  const ready = useAuthStore((state) => state.ready);
  const pending = useAuthStore((state) => state.pending);
  const signOut = useAuthStore((state) => state.signOut);
  const authError = useAuthStore((state) => state.error);
  const account = useAccountCounts();
  const countsLoading = !ready || (Boolean(user) && account.isPending);
  const deviceCount = useMyListingsStore((state) => state.listings.length);
  const profile = useProfile();
  const displayName = profile.data?.displayName ?? user?.name ?? 'Guest';

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingHorizontal: gutter }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <AppText variant="displayLG">Profile</AppText>
          <HeaderIconButton icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={user ? 'Edit your name and picture' : 'Profile'}
          disabled={!user}
          onPress={() => router.push('/profile-edit')}
          style={({ pressed }) => [styles.identity, pressed && user ? styles.identityPressed : null]}>
          <ProfileAvatar
            avatarId={profile.data?.avatarId}
            name={displayName}
            size={isCompact ? 56 : 64}
            bordered
          />
          <View style={styles.identityText}>
            <AppText variant="displaySM">{displayName}</AppText>
            <View style={styles.verifiedRow}>
              <Ionicons name={user?.emailVerified ? 'checkmark-circle' : 'person-outline'} size={14} color={colors.primary} />
              <AppText variant="captionSM" tone="muted">
                {user?.email ?? 'Browse Raichur district'}
              </AppText>
            </View>
            {user ? (
              <AppText variant="captionSM" tone="primary">Edit name and picture</AppText>
            ) : null}
          </View>
          {user ? <Ionicons name="chevron-forward" size={16} color={colors.mutedSoft} /> : null}
        </Pressable>

        <View style={styles.statsCard}>
          <Stat value={user ? String(account.data?.saved ?? '—') : '0'} label="Saved" loading={countsLoading} />
          <View style={styles.statDivider} />
          <Stat value={user ? String(account.data?.listed ?? '—') : '0'} label="Listed" loading={countsLoading} />
          <View style={styles.statDivider} />
          <Stat value="—" label="Visits" />
        </View>
        <ConnectionStatus error={account.error} onRetry={() => { void account.refetch(); }} />

        <PrimaryButton
          label="List your property"
          icon="add"
          onPress={() => router.push('/list')}
        />
        {deviceCount ? <SecondaryButton label={`Review ${deviceCount} on-device ${deviceCount === 1 ? 'property' : 'properties'}`} onPress={() => router.push('/my-properties')} /> : null}

        <View style={styles.section}>
          <AppText variant="caption" tone="muted" style={styles.sectionLabel}>
            ACCOUNT
          </AppText>
          <View style={styles.card}>
            {ACCOUNT_ROWS.map((row, index) => (
              <View key={row.id}>
                {index > 0 ? <View style={styles.rowDivider} /> : null}
                <MenuRow row={row.id === 'listings' ? { ...row, hint: `${account.data?.listed ?? 0} listed` } : row}
                  onPress={row.id === 'listings' ? () => router.push('/my-properties')
                    : row.id === 'messages' ? () => router.push('/messages')
                      : undefined} />
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <AppText variant="caption" tone="muted" style={styles.sectionLabel}>
            SUPPORT
          </AppText>
          <View style={styles.card}>
            {SUPPORT_ROWS.map((row, index) => (
              <View key={row.id}>
                {index > 0 ? <View style={styles.rowDivider} /> : null}
                <MenuRow
                  row={row}
                  onPress={row.id === 'agent' ? () => router.push('/agent')
                    : row.id === 'help' ? () => router.push('/help')
                      : row.id === 'settings' ? () => router.push('/settings')
                        : row.id === 'legal' ? () => router.push('/legal/terms')
                          : undefined} />
              </View>
            ))}
          </View>
        </View>

        <SecondaryButton
          label={pending ? 'Please wait…' : user ? 'Sign out' : 'Sign in or create an account'}
          icon={user ? 'log-out-outline' : 'log-in-outline'}
          disabled={pending}
          tone="outline"
          onPress={() => { if (user) void signOut(); else router.push({ pathname: '/auth', params: { returnTo: '/profile' } }); }}
        />
        {authError ? <AppText variant="bodySM" style={styles.feedback} accessibilityLiveRegion="polite">{authError}</AppText> : null}

        <AppText variant="captionSM" tone="mutedSoft" center style={styles.version}>
          Nele v1.0.0 · Made for Raichur district
        </AppText>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  feedback: { color: colors.error },
  content: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    paddingTop: spacing.xs,
  },
  identityPressed: {
    opacity: 0.7,
  },
  identityText: {
    gap: 2,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    backgroundColor: colors.canvas,
    paddingVertical: spacing.base,
    ...shadow,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.hairlineSoft,
  },
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    paddingLeft: spacing.xs,
    letterSpacing: 0.6,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.canvas,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md + 2,
    minHeight: 56,
  },
  rowLocked: {
    opacity: 0.75,
  },
  lockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceStrong,
  },
  rowPressed: {
    backgroundColor: colors.surfaceSoft,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairlineSoft,
    marginLeft: spacing.base + 34 + spacing.md,
  },
  version: {
    paddingTop: spacing.sm,
  },
});
