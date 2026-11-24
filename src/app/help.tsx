import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/nele/AppText';
import { PrimaryButton, SecondaryButton } from '@/components/nele/Buttons';
import { Screen } from '@/components/nele/Screen';
import { useLayout } from '@/theme/layout';
import { colors, radius, spacing } from '@/theme/tokens';

type Faq = { id: string; question: string; answer: string; group: 'Listing' | 'Chat' | 'Privacy' | 'Account' };

const FAQS: Faq[] = [
  {
    id: 'post',
    group: 'Listing',
    question: 'How do I list a property?',
    answer: 'Sign in, open the List tab, fill in the town, title, locality, price and area, add photos if you have them, then tap Post property. It appears in Explore and Home for that town immediately.',
  },
  {
    id: 'photos',
    group: 'Listing',
    question: 'Why does my listing show a generic picture?',
    answer: 'Listings without an uploaded photo use an illustration for that property type. Add real photos from List → Photos; the first one becomes the cover.',
  },
  {
    id: 'sold',
    group: 'Listing',
    question: 'How do I mark a property as sold?',
    answer: 'Open My properties and tap Mark as sold under the listing, or open the property and use the button there. It disappears from Explore and Home but stays in your list with a Sold badge. Tap Put back on the market if the deal falls through.',
  },
  {
    id: 'documents',
    group: 'Listing',
    question: 'Do I have to upload documents?',
    answer: 'No. Ownership proof, tax receipts and ID are optional. If you add them they are private to your account and are never shown to buyers.',
  },
  {
    id: 'chat',
    group: 'Chat',
    question: 'How do I contact an owner?',
    answer: 'Open the property and tap Message seller. You get an in-app chat, so neither side sees the other\'s phone number unless you choose to share it in a message.',
  },
  {
    id: 'chat-not-live',
    group: 'Chat',
    question: 'Messages seem delayed by a few seconds',
    answer: 'An open conversation refreshes every few seconds, so a reply can take a moment to appear. You do not need to close and reopen the screen.',
  },
  {
    id: 'phone',
    group: 'Privacy',
    question: 'Will other users see my phone number?',
    answer: 'No. Your phone number is only collected if you ask a booking agent to call you, and it goes only to the person handling that request.',
  },
  {
    id: 'delete-account',
    group: 'Account',
    question: 'How do I delete my account and data?',
    answer: 'Profile → Delete account. It removes your account, listings, photos, documents, conversations and agent requests. Without the app installed, use nele.app/delete-account or email support@nele.app.',
  },
  {
    id: 'payments',
    group: 'Account',
    question: 'Can I pay or receive money in the app?',
    answer: 'Not yet. Payments and payouts are locked while we finish them, so Nele never asks for payment details. Agree money directly with the other person after you have verified the property.',
  },
  {
    id: 'agent',
    group: 'Listing',
    question: 'What is a booking agent?',
    answer: 'A local agent who can show you properties and handle visits on your behalf. Request a callback from Help centre → Booking agent, and one will call you at the time you choose.',
  },
  {
    id: 'safety',
    group: 'Privacy',
    question: 'How do I avoid property scams?',
    answer: 'Visit the property before paying anything, ask for ownership documents, and never send a deposit before seeing the property and meeting the owner. Nobody from Nele will ask you for money or an OTP.',
  },
];

const GROUPS: Faq['group'][] = ['Listing', 'Chat', 'Privacy', 'Account'];

export default function HelpCentreScreen() {
  const { gutter } = useLayout();
  const [open, setOpen] = useState<string | null>(FAQS[0]?.id ?? null);

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingHorizontal: gutter }]}>
        <View style={styles.header}>
          <SecondaryButton label="Back to profile" icon="arrow-back" fullWidth={false} onPress={() => router.replace('/profile')} />
          <AppText variant="displayLG">Help centre</AppText>
          <AppText variant="bodySM" tone="muted">
            Answers to the questions we get most. Still stuck? Ask a booking agent to call you.
          </AppText>
        </View>

        {GROUPS.map((group) => (
          <View key={group} style={styles.group}>
            <AppText variant="caption" tone="muted" style={styles.groupLabel}>{group.toUpperCase()}</AppText>
            <View style={styles.card}>
              {FAQS.filter((faq) => faq.group === group).map((faq, index) => {
                const expanded = open === faq.id;
                return (
                  <View key={faq.id}>
                    {index > 0 ? <View style={styles.divider} /> : null}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={faq.question}
                      accessibilityState={{ expanded }}
                      onPress={() => setOpen(expanded ? null : faq.id)}
                      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                      <AppText variant="bodyMD" style={styles.question}>{faq.question}</AppText>
                      <Ionicons name={expanded ? 'remove' : 'add'} size={18} color={colors.muted} />
                    </Pressable>
                    {expanded ? (
                      <View style={styles.answerWrap}>
                        <AppText variant="captionSM" tone="body">{faq.answer}</AppText>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        ))}

        <View style={styles.contact}>
          <AppText variant="titleMD">Need a person?</AppText>
          <AppText variant="captionSM" tone="muted">
            Tell us what you are looking for and a booking agent will call you back.
          </AppText>
          <PrimaryButton label="Request a booking agent" icon="call-outline" onPress={() => router.push('/agent')} />
          <SecondaryButton label="Terms of use" tone="ghost" onPress={() => router.push('/legal/terms')} />
          <SecondaryButton label="Privacy policy" tone="ghost" onPress={() => router.push('/legal/privacy')} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.section,
    gap: spacing.lg,
  },
  header: {
    gap: spacing.base,
  },
  group: {
    gap: spacing.sm,
  },
  groupLabel: {
    paddingLeft: spacing.xxs,
  },
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    backgroundColor: colors.canvas,
    overflow: 'hidden',
  },
  divider: {
    height: 1,
    backgroundColor: colors.hairlineSoft,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  rowPressed: {
    backgroundColor: colors.surfaceSoft,
  },
  question: {
    flex: 1,
  },
  answerWrap: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  contact: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
});
