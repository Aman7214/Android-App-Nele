import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useLayout } from '@/theme/layout';
import { colors, radius, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { Screen } from './Screen';

export type LegalSection = { heading: string; body: string[] };

type Props = {
  title: string;
  updatedAt: string;
  summary: string;
  sections: LegalSection[];
  footer?: string;
};

/** Long-form legal copy, laid out for reading on a phone. */
export function LegalDocument({ title, updatedAt, summary, sections, footer }: Props) {
  const { gutter } = useLayout();
  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingHorizontal: gutter }]}>
        <View style={styles.header}>
          <Ionicons
            name="chevron-back"
            size={24}
            color={colors.ink}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/profile'))}
          />
          <AppText variant="displayLG">{title}</AppText>
          <AppText variant="captionSM" tone="muted">Last updated {updatedAt}</AppText>
        </View>

        <View style={styles.summary}>
          <AppText variant="captionSM" tone="body">{summary}</AppText>
        </View>

        {sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <AppText variant="titleMD">{section.heading}</AppText>
            {section.body.map((paragraph) => (
              <AppText key={paragraph.slice(0, 40)} variant="bodySM" tone="body">{paragraph}</AppText>
            ))}
          </View>
        ))}

        {footer ? (
          <View style={styles.footer}>
            <AppText variant="captionSM" tone="muted">{footer}</AppText>
          </View>
        ) : null}
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
    gap: spacing.xs,
  },
  summary: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  section: {
    gap: spacing.xs,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.hairlineSoft,
    paddingTop: spacing.md,
  },
});
