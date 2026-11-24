import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View,
} from 'react-native';

import { AppText } from '@/components/nele/AppText';
import { PrimaryButton, SecondaryButton } from '@/components/nele/Buttons';
import { ConnectionStatus } from '@/components/nele/ConnectionStatus';
import { ProfileAvatar } from '@/components/nele/ProfileAvatar';
import { Screen } from '@/components/nele/Screen';
import { AVATARS, AVATAR_GROUPS } from '@/data/avatars';
import { useProfile, useUpdateProfile } from '@/hooks/use-profile';
import { useAuthStore } from '@/stores/auth';
import { useLayout } from '@/theme/layout';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { DISPLAY_NAME_MAX, DISPLAY_NAME_MIN, type AvatarId } from '../../shared/profile';

export default function ProfileEditScreen() {
  const { gutter } = useLayout();
  const user = useAuthStore((state) => state.user);
  const profile = useProfile();
  const update = useUpdateProfile();

  const currentName = profile.data?.displayName ?? user?.name ?? '';
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [avatarId, setAvatarId] = useState<AvatarId | null | undefined>(undefined);

  const name = displayName ?? currentName;
  const avatar: AvatarId | null = avatarId === undefined ? profile.data?.avatarId ?? null : avatarId;

  const trimmed = name.trim();
  const nameValid = trimmed.length >= DISPLAY_NAME_MIN && trimmed.length <= DISPLAY_NAME_MAX;
  const changed = (displayName !== null && trimmed !== currentName.trim())
    || (avatarId !== undefined && avatarId !== (profile.data?.avatarId ?? null));

  const save = () => {
    if (!nameValid) return;
    update.mutate({ displayName: trimmed, avatarId: avatar }, {
      onSuccess: () => router.back(),
    });
  };

  return (
    <Screen>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingHorizontal: gutter }]}>
          <View style={styles.header}>
            <SecondaryButton label="Back" icon="arrow-back" fullWidth={false} onPress={() => (router.canGoBack() ? router.back() : router.replace('/profile'))} />
            <AppText variant="displayLG">Edit profile</AppText>
            <AppText variant="bodySM" tone="muted">
              This is the name and picture other people see when you message them about a property.
            </AppText>
          </View>

          {!user ? (
            <View style={styles.card}>
              <AppText variant="bodySM" tone="body">Sign in to set a display name and avatar.</AppText>
              <PrimaryButton label="Sign in" onPress={() => router.push({ pathname: '/auth', params: { returnTo: '/profile-edit' } })} />
            </View>
          ) : (
            <>
              <View style={styles.preview}>
                <ProfileAvatar avatarId={avatar} name={name} size={84} bordered />
                <View style={styles.previewText}>
                  <AppText variant="titleMD">{name.trim() || 'Your name'}</AppText>
                  <AppText variant="captionSM" tone="muted">{user.email}</AppText>
                </View>
              </View>

              <View style={styles.field}>
                <AppText variant="caption" tone="body">Display name</AppText>
                <TextInput
                  accessibilityLabel="Display name"
                  value={name}
                  onChangeText={setDisplayName}
                  placeholder="How should people see you?"
                  placeholderTextColor={colors.mutedSoft}
                  style={inputStyle}
                  maxLength={DISPLAY_NAME_MAX}
                  autoComplete="name"
                />
                <AppText variant="captionSM" tone="muted">
                  {nameValid
                    ? `${trimmed.length}/${DISPLAY_NAME_MAX} characters`
                    : `Use at least ${DISPLAY_NAME_MIN} characters.`}
                </AppText>
              </View>

              {AVATAR_GROUPS.map((group) => (
                <View key={group.title} style={styles.group}>
                  <AppText variant="caption" tone="muted" style={styles.groupLabel}>{group.title.toUpperCase()}</AppText>
                  <View style={styles.avatarRow}>
                    {group.ids.map((id) => {
                      const item = AVATARS.find((entry) => entry.id === id);
                      if (!item) return null;
                      const selected = avatar === id;
                      return (
                        <Pressable
                          key={id}
                          accessibilityRole="button"
                          accessibilityLabel={item.label}
                          accessibilityState={{ selected }}
                          onPress={() => setAvatarId(id)}
                          style={[styles.avatarOption, selected && styles.avatarSelected]}>
                          <ProfileAvatar avatarId={id} size={56} />
                          {selected ? (
                            <View style={styles.check}>
                              <Ionicons name="checkmark" size={11} color={colors.onPrimary} />
                            </View>
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}

              <SecondaryButton
                label="Remove picture"
                icon="close-circle-outline"
                tone="ghost"
                disabled={avatar === null}
                onPress={() => setAvatarId(null)}
              />

              {update.error ? <ConnectionStatus error={update.error} /> : null}
              <PrimaryButton
                label={update.isPending ? 'Saving…' : 'Save profile'}
                disabled={!nameValid || !changed || update.isPending}
                onPress={save}
              />
              {!changed ? (
                <AppText variant="captionSM" tone="muted" center>
                  Change your name or pick a picture to save.
                </AppText>
              ) : null}
            </>
          )}
          <View style={styles.footerSpace} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  header: { gap: spacing.sm, paddingBottom: spacing.xs },
  card: {
    gap: spacing.sm,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  previewText: { flex: 1, gap: 2 },
  field: { gap: spacing.xs },
  group: { gap: spacing.sm },
  groupLabel: { paddingLeft: spacing.xxs },
  avatarRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  avatarOption: {
    padding: 3,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarSelected: {
    borderColor: colors.ink,
  },
  check: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 18,
    height: 18,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ink,
  },
  footerSpace: { height: spacing.md },
});

const inputStyle = [typography.bodyMD, {
  height: 48,
  borderRadius: radius.sm,
  borderWidth: 1,
  borderColor: colors.hairline,
  backgroundColor: colors.canvas,
  paddingHorizontal: spacing.base,
  color: colors.ink,
}];
