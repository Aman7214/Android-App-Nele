import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/nele/AppText';
import { PrimaryButton, SecondaryButton } from '@/components/nele/Buttons';
import { ConnectionStatus } from '@/components/nele/ConnectionStatus';
import { ProfileAvatar } from '@/components/nele/ProfileAvatar';
import { Screen } from '@/components/nele/Screen';
import { useProfile } from '@/hooks/use-profile';
import { useDeleteAccount } from '@/hooks/use-support';
import { useAuthStore } from '@/stores/auth';
import { useLayout } from '@/theme/layout';
import { colors, radius, spacing } from '@/theme/tokens';

type Row = { id: string; label: string; hint?: string; icon: keyof typeof Ionicons.glyphMap };

const ROWS: { title: string; rows: Row[] }[] = [
  {
    title: 'Account',
    rows: [
      { id: 'edit', label: 'Edit profile', hint: 'Name and picture', icon: 'person-circle-outline' },
      { id: 'town', label: 'Change town', icon: 'location-outline' },
      { id: 'messages', label: 'Messages', icon: 'chatbubbles-outline' },
      { id: 'properties', label: 'My properties', icon: 'business-outline' },
    ],
  },
  {
    title: 'Support',
    rows: [
      { id: 'agent', label: 'Booking agent', hint: 'Ask for a callback', icon: 'call-outline' },
      { id: 'help', label: 'Help centre', hint: 'FAQs', icon: 'help-circle-outline' },
    ],
  },
  {
    title: 'Legal',
    rows: [
      { id: 'terms', label: 'Terms of use', icon: 'document-text-outline' },
      { id: 'privacy', label: 'Privacy policy', icon: 'shield-checkmark-outline' },
      { id: 'delete', label: 'Delete my account', icon: 'trash-outline' },
    ],
  },
];

/** Payments stay locked until they ship — mirrors the Profile row. */
const LOCKED: Row = { id: 'payments', label: 'Payments & payouts', icon: 'card-outline' };

export default function SettingsScreen() {
  const { gutter } = useLayout();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const profile = useProfile();
  const removeAccount = useDeleteAccount();

  const go = (id: string) => {
    switch (id) {
      case 'edit': router.push('/profile-edit'); break;
      case 'town': router.push({ pathname: '/location', params: { from: 'home' } }); break;
      case 'messages': router.push('/messages'); break;
      case 'properties': router.push('/my-properties'); break;
      case 'agent': router.push('/agent'); break;
      case 'help': router.push('/help'); break;
      case 'terms': router.push('/legal/terms'); break;
      case 'privacy': router.push('/legal/privacy'); break;
      case 'delete':
        Alert.alert(
          'Delete your account?',
          'This removes your account, listings, photos, documents, conversations and callback requests. It cannot be undone.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => removeAccount.mutate() },
          ],
        );
        break;
      default: break;
    }
  };

  const displayName = profile.data?.displayName ?? user?.name ?? 'Guest';

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingHorizontal: gutter }]}>
        <View style={styles.header}>
          <SecondaryButton label="Back" icon="arrow-back" fullWidth={false} onPress={() => (router.canGoBack() ? router.back() : router.replace('/profile'))} />
          <AppText variant="displayLG">Settings</AppText>
        </View>

        <View style={styles.identity}>
          <ProfileAvatar avatarId={profile.data?.avatarId} name={displayName} size={56} bordered />
          <View style={styles.identityText}>
            <AppText variant="displaySM">{displayName}</AppText>
            <AppText variant="captionSM" tone="muted">{user?.email ?? 'Not signed in'}</AppText>
          </View>
        </View>

        {ROWS.map((section) => (
          <View key={section.title} style={styles.section}>
            <AppText variant="caption" tone="muted" style={styles.sectionLabel}>
              {section.title.toUpperCase()}
            </AppText>
            <View style={styles.card}>
              {section.rows.map((row, index) => (
                <View key={row.id}>
                  {index > 0 ? <View style={styles.divider} /> : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={row.label}
                    onPress={() => go(row.id)}
                    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                    <View style={styles.rowIcon}>
                      <Ionicons name={row.icon} size={19} color={row.id === 'delete' ? colors.error : colors.ink} />
                    </View>
                    <AppText variant="bodyMD" style={styles.rowLabel} tone={row.id === 'delete' ? 'body' : 'ink'}>
                      {row.label}
                    </AppText>
                    {row.hint ? <AppText variant="captionSM" tone="muted">{row.hint}</AppText> : null}
                    <Ionicons name="chevron-forward" size={16} color={colors.mutedSoft} />
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.section}>
          <AppText variant="caption" tone="muted" style={styles.sectionLabel}>PAYMENTS</AppText>
          <View style={styles.card}>
            <View accessibilityRole="text" accessibilityLabel={`${LOCKED.label}, coming soon`} style={styles.row}>
              <View style={styles.rowIcon}>
                <Ionicons name={LOCKED.icon} size={19} color={colors.mutedSoft} />
              </View>
              <AppText variant="bodyMD" tone="muted" style={styles.rowLabel}>{LOCKED.label}</AppText>
              <View style={styles.lockPill}>
                <Ionicons name="lock-closed" size={11} color={colors.muted} />
                <AppText variant="badge" tone="muted">Coming soon</AppText>
              </View>
            </View>
          </View>
        </View>

        <ConnectionStatus error={removeAccount.error} />

        {user ? (
          <View style={styles.actions}>
            <PrimaryButton
              label="Sign out"
              icon="log-out-outline"
              onPress={() => { void signOut(); }}
            />
          </View>
        ) : (
          <PrimaryButton
            label="Sign in or create an account"
            icon="log-in-outline"
            onPress={() => router.push({ pathname: '/auth', params: { returnTo: '/settings' } })}
          />
        )}

        <AppText variant="captionSM" tone="mutedSoft" center style={styles.version}>
          Nele v1.0.0 · Made for Raichur district
        </AppText>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, paddingBottom: spacing.section, gap: spacing.lg },
  header: { gap: spacing.sm },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  identityText: { flex: 1, gap: 2 },
  section: { gap: spacing.sm },
  sectionLabel: { paddingLeft: spacing.xxs },
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    backgroundColor: colors.canvas,
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: colors.hairlineSoft },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  rowPressed: { backgroundColor: colors.surfaceSoft },
  rowIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSoft,
  },
  rowLabel: { flex: 1 },
  lockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceStrong,
  },
  actions: { gap: spacing.sm },
  version: { paddingTop: spacing.sm },
});
