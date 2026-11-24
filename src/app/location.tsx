import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/nele/AppText';
import { PrimaryButton, SecondaryButton } from '@/components/nele/Buttons';
import { Screen } from '@/components/nele/Screen';
import { DISTRICT, TOWNS, nearestTown, type TownId } from '@/data/locations';
import { useLocationStore } from '@/stores/location';
import { useLayout } from '@/theme/layout';
import { colors, radius, spacing, touchTarget } from '@/theme/tokens';

export default function LocationRoute() {
  const { gutter, isCompact } = useLayout();
  const insets = useSafeAreaInsets();
  const setTown = useLocationStore((state) => state.setTown);
  const setPermission = useLocationStore((state) => state.setPermission);
  const skipLocation = useLocationStore((state) => state.skip);
  const { from } = useLocalSearchParams<{ from?: string }>();
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);

  // Reached from Home's "Change town" pill, we should go back rather than stack a
  // second Home under the first one. During first run there is nowhere to go back to.
  const goHome = useCallback(
    () => (from === 'home' && router.canGoBack() ? router.back() : router.replace('/home')),
    [from],
  );

  const skip = useCallback(() => {
    skipLocation();
    goHome();
  }, [goHome, skipLocation]);

  const useMyLocation = useCallback(async () => {
    setBusy(true);
    setDenied(false);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermission('denied');
        setDenied(true);
        setBusy(false);
        return;
      }
      setPermission('granted');
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const town = nearestTown(position.coords.latitude, position.coords.longitude);
      setTown(town.id);
      goHome();
    } catch {
      // Geolocation can fail on web/denied systems; fall back to manual pick.
      setDenied(true);
      setBusy(false);
    }
  }, [goHome, setPermission, setTown]);

  const pickTown = useCallback(
    (id: TownId) => {
      setTown(id);
      goHome();
    },
    [goHome, setTown]
  );

  return (
    <Screen>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingHorizontal: isCompact ? gutter : Math.max(gutter, spacing.lg),
            paddingBottom: insets.bottom + spacing.lg,
          },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.root}>
          <View style={styles.copy}>
            <View style={[styles.iconRing, isCompact && styles.iconRingCompact]}>
              <Ionicons name="location" size={28} color={colors.primary} />
            </View>
            <View style={styles.copyText}>
              <AppText variant="displayLG" center style={styles.title}>
                Where in {DISTRICT} are you?
              </AppText>
              <AppText variant="bodyMD" tone="muted" center style={styles.body}>
                Use your location to find plots, homes, shops and rentals near you.
              </AppText>
            </View>
          </View>

          <View style={styles.actions}>
            <PrimaryButton
              label={busy ? 'Finding your town…' : 'Use my location'}
              icon="locate"
              onPress={useMyLocation}
            />

            {denied ? (
              <View style={styles.denied}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
                <AppText variant="captionSM" tone="body" style={styles.deniedText}>
                  Location permission was blocked. You can still pick your town below.
                </AppText>
              </View>
            ) : null}

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <AppText variant="captionSM" tone="muted">
                or choose your town
              </AppText>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.towns}>
              {TOWNS.map((town) => (
                <View key={town.id} style={styles.townCell}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Choose ${town.label}`}
                    onPress={() => pickTown(town.id)}
                    style={({ pressed }) => [styles.townChip, pressed && styles.townChipPressed]}>
                    <Ionicons name="location-outline" size={18} color={colors.muted} />
                    <AppText variant="buttonSM" style={styles.townLabel}>
                      {town.label}
                    </AppText>
                  </Pressable>
                </View>
              ))}
            </View>

            <SecondaryButton
              label="Skip for now"
              tone="ghost"
              fullWidth={false}
              onPress={skip}
              style={styles.skip}
            />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: spacing.lg,
  },
  root: {
    width: '100%',
    maxWidth: 420,
    gap: spacing.xl,
  },
  copy: {
    alignItems: 'center',
    gap: spacing.lg,
  },
  copyText: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconRing: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconRingCompact: {
    width: 56,
    height: 56,
  },
  title: {
    maxWidth: 300,
  },
  body: {
    maxWidth: 340,
  },
  actions: {
    gap: spacing.base,
  },
  denied: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  deniedText: {
    flex: 1,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.hairline,
  },
  towns: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginHorizontal: -spacing.xs,
    marginVertical: -spacing.xs,
  },
  townCell: {
    width: '50%',
    padding: spacing.xs,
  },
  townChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: touchTarget + spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.canvas,
  },
  townChipPressed: {
    backgroundColor: colors.surfaceSoft,
  },
  townLabel: {
    flexShrink: 1,
  },
  skip: {
    alignSelf: 'center',
    minHeight: touchTarget,
    paddingHorizontal: spacing.lg,
  },
});
