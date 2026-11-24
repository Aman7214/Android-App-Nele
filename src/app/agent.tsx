import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View,
} from 'react-native';

import { AppText } from '@/components/nele/AppText';
import { PrimaryButton, SecondaryButton } from '@/components/nele/Buttons';
import { ConnectionStatus } from '@/components/nele/ConnectionStatus';
import { Screen } from '@/components/nele/Screen';
import { TOWNS, type TownId } from '@/data/locations';
import { useSubmitAgentRequest } from '@/hooks/use-support';
import { useAuthStore } from '@/stores/auth';
import { useLayout } from '@/theme/layout';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import {
  agentIntentLabels, agentIntents, agentRequestSchema, contactTimeLabels, contactTimes,
  type AgentIntent, type ContactTime,
} from '../../shared/support';

function Chips<T extends string>({
  options, active, onChange,
}: { options: { id: T; label: string }[]; active: T; onChange: (id: T) => void }) {
  return (
    <View style={styles.chipRow}>
      {options.map((option) => {
        const selected = option.id === active;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.id)}
            style={[styles.chip, selected && styles.chipActive]}>
            <AppText variant="buttonSM" tone={selected ? 'onPrimary' : 'muted'}>{option.label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <AppText variant="caption" tone="body">{label}</AppText>
      {children}
      {hint ? <AppText variant="captionSM" tone="muted">{hint}</AppText> : null}
    </View>
  );
}

export default function BookingAgentScreen() {
  const { gutter } = useLayout();
  const user = useAuthStore((state) => state.user);
  const submit = useSubmitAgentRequest();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [town, setTown] = useState<TownId>('raichur');
  const [intent, setIntent] = useState<AgentIntent>('buy');
  const [budget, setBudget] = useState('');
  const [contactTime, setContactTime] = useState<ContactTime>('anytime');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const send = () => {
    setError(null);
    const payload = {
      name: name.trim() || (user?.name ?? ''),
      phone: phone.trim(),
      town,
      intent,
      budget: budget.trim() || undefined,
      contactTime,
      notes: notes.trim() || undefined,
    };
    const parsed = agentRequestSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the form and try again.');
      return;
    }
    submit.mutate(parsed.data, { onSuccess: () => setSent(true) });
  };

  if (sent) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={[styles.success, { paddingHorizontal: gutter }]}>
          <View style={styles.successIcon}>
            <Ionicons name="call" size={26} color={colors.onPrimary} />
          </View>
          <AppText variant="displaySM" center>Request received</AppText>
          <AppText variant="bodySM" tone="muted" center>
            A booking agent will call {phone || 'you'} {contactTime === 'anytime' ? 'soon' : `in the ${contactTime}`} about
            {intent === 'sell' ? ' your property' : intent === 'rent' ? ' rentals' : ' buying'} in {TOWNS.find((item) => item.id === town)?.label}.
          </AppText>
          <PrimaryButton label="Back to home" onPress={() => router.replace('/home')} />
          <SecondaryButton label="Request another callback" tone="outline" onPress={() => { setSent(false); setNotes(''); }} />
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, { paddingHorizontal: gutter }]}>
          <View style={styles.header}>
            <SecondaryButton label="Back" icon="arrow-back" fullWidth={false} onPress={() => (router.canGoBack() ? router.back() : router.replace('/help'))} />
            <AppText variant="displayLG">Request a booking agent</AppText>
            <AppText variant="bodySM" tone="muted">
              Tell us what you are looking for and an agent who knows your town will call you. Free, and no obligation.
            </AppText>
          </View>

          {!user ? (
            <View style={styles.signIn}>
              <AppText variant="bodySM" tone="body">
                Sign in so we can keep your request history together — it takes a minute.
              </AppText>
              <PrimaryButton
                label="Sign in to continue"
                onPress={() => router.push({ pathname: '/auth', params: { returnTo: '/agent' } })}
              />
            </View>
          ) : (
            <>
              <Field label="Your name">
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder={user.name || 'Full name'}
                  placeholderTextColor={colors.mutedSoft}
                  style={inputStyle}
                  maxLength={80}
                  autoComplete="name"
                />
              </Field>

              <Field label="Phone number" hint="An agent will call this number. It is not shown to other users.">
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="e.g. 98765 43210"
                  placeholderTextColor={colors.mutedSoft}
                  style={inputStyle}
                  keyboardType="phone-pad"
                  maxLength={20}
                  autoComplete="tel"
                />
              </Field>

              <Field label="Town">
                <Chips options={TOWNS.map((item) => ({ id: item.id, label: item.label }))} active={town} onChange={setTown} />
              </Field>

              <Field label="I need help with">
                <Chips
                  options={agentIntents.map((id) => ({ id, label: agentIntentLabels[id] }))}
                  active={intent}
                  onChange={setIntent}
                />
              </Field>

              <Field label="Budget (optional)" hint="A range is fine, e.g. 15–25 lakh or ₹8,000/month.">
                <TextInput
                  value={budget}
                  onChangeText={setBudget}
                  placeholder="e.g. 15-25 lakh"
                  placeholderTextColor={colors.mutedSoft}
                  style={inputStyle}
                  maxLength={40}
                />
              </Field>

              <Field label="Best time to call">
                <Chips
                  options={contactTimes.map((id) => ({ id, label: contactTimeLabels[id] }))}
                  active={contactTime}
                  onChange={setContactTime}
                />
              </Field>

              <Field label="Anything else? (optional)" hint="Locality you want, number of bedrooms, or a good time to visit.">
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="e.g. 2BHK near the bus stand, weekends only"
                  placeholderTextColor={colors.mutedSoft}
                  style={[inputStyle, styles.textArea]}
                  multiline
                  maxLength={500}
                />
              </Field>

              {error ? <AppText variant="captionSM" tone="primary">{error}</AppText> : null}
              <ConnectionStatus error={submit.error} />

              <PrimaryButton
                label={submit.isPending ? 'Sending request…' : 'Request a callback'}
                icon="call-outline"
                disabled={submit.isPending}
                onPress={send}
              />
              <AppText variant="captionSM" tone="muted" center>
                By sending this you agree to our terms and that an agent may call you at the time you chose.
              </AppText>
            </>
          )}
          <View style={styles.footerSpace} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  header: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  signIn: {
    gap: spacing.sm,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  field: {
    gap: spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.base,
    height: 38,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  input: {
    height: 48,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.canvas,
    paddingHorizontal: spacing.base,
    color: colors.ink,
  },
  textArea: {
    height: 96,
    paddingTop: spacing.md,
    textAlignVertical: 'top',
  },
  success: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingTop: spacing.section,
    paddingBottom: spacing.section,
  },
  successIcon: {
    width: 60,
    height: 60,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerSpace: {
    height: spacing.md,
  },
});

const inputStyle = [typography.bodyMD, styles.input];
