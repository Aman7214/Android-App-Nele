import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { AppText } from '@/components/nele/AppText';
import { PrimaryButton, SecondaryButton } from '@/components/nele/Buttons';
import { ConnectionStatus } from '@/components/nele/ConnectionStatus';
import { DocumentAttachments } from '@/components/nele/DocumentAttachments';
import { PhotoStrip } from '@/components/nele/PhotoStrip';
import { Screen } from '@/components/nele/Screen';
import {
  KIND_IDS,
  type DealMode,
  type Listing,
  type ListingKind,
  type RentalAudience,
} from '@/data/listings';
import { TOWNS, type TownId } from '@/data/locations';
import { imageAssetForKind, toListing } from '@/data/listing-images';
import { useListingMedia } from '@/hooks/use-listing-media';
import { useCreateProperty } from '@/hooks/use-properties';
import { useAuthStore } from '@/stores/auth';
import { useLayout } from '@/theme/layout';
import { colors, radius, spacing, typography } from '@/theme/tokens';

const requestId = () => `mobile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;

const KINDS: ListingKind[] = ['House', 'Apartment', 'Plot', 'Land', 'Shop', 'Warehouse', 'Hostel'];

const AUDIENCES: { id: RentalAudience; label: string }[] = [
  { id: 'students', label: 'Students' },
  { id: 'family', label: 'Families' },
  { id: 'anyone', label: 'Anyone' },
];

type Option = { id: string; label: string };

function ChipRow({
  options,
  active,
  onChange,
}: {
  options: Option[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((option) => {
        const isActive = option.id === active;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            onPress={() => onChange(option.id)}
            style={[styles.chip, isActive && styles.chipActive]}>
            <AppText variant="buttonSM" tone={isActive ? 'onPrimary' : 'muted'}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <AppText variant="caption" tone="body">
        {label}
      </AppText>
      {children}
    </View>
  );
}

export default function ListScreen() {
  const { gutter, isCompact } = useLayout();
  const createProperty = useCreateProperty();
  const user = useAuthStore((state) => state.user);
  const draftId = useRef(requestId());
  const publishing = useRef(false);
  const media = useListingMedia({
    signedIn: Boolean(user),
    onNeedsSignIn: () => router.push({ pathname: '/auth', params: { returnTo: '/list' } }),
  });

  const [mode, setMode] = useState<DealMode>('sale');
  const [kind, setKind] = useState<ListingKind>('House');
  const [town, setTown] = useState<TownId>('raichur');
  const [audience, setAudience] = useState<RentalAudience>('anyone');
  const [title, setTitle] = useState('');
  const [locality, setLocality] = useState('');
  const [price, setPrice] = useState('');
  const [area, setArea] = useState('');
  const [beds, setBeds] = useState('');
  const [baths, setBaths] = useState('');
  const [submitted, setSubmitted] = useState<Listing | null>(null);

  const priceValue = Number(price.replace(/[^\d]/g, ''));
  const areaValue = Number(area.replace(/[^\d]/g, ''));
  const canSubmit =
    title.trim().length > 2 && locality.trim().length > 1 && priceValue > 0 && areaValue > 0;

  const submit = async () => {
    if (!canSubmit || createProperty.isPending || publishing.current) return;
    if (!user) {
      router.push({ pathname: '/auth', params: { returnTo: '/list' } });
      return;
    }
    publishing.current = true;
    try {
      const record = await createProperty.mutateAsync({
      requestId: draftId.current,
      title: title.trim(),
      kind,
      locality: locality.trim(),
      town,
      price: priceValue,
      mode,
      audience: mode === 'rent' ? audience : undefined,
      beds: hasRooms && beds ? Number(beds) : undefined,
      baths: hasRooms && baths ? Number(baths) : undefined,
      areaSqft: areaValue,
      imageAsset: imageAssetForKind(kind),
      photos: media.attachedPhotos.length ? media.attachedPhotos : undefined,
      documents: media.attachedDocuments.length ? media.attachedDocuments : undefined,
      });
      setSubmitted(toListing(record));
    } catch { /* The form displays the mutation error and retains the draft for retry. */ }
    finally { publishing.current = false; }
  };

  const reset = () => {
    setSubmitted(null);
    draftId.current = requestId();
    createProperty.reset();
    setTitle('');
    setLocality('');
    setPrice('');
    setArea('');
    setBeds('');
    setBaths('');
    media.resetMedia();
  };

  const hasRooms = kind === 'House' || kind === 'Apartment' || kind === 'Hostel';

  if (submitted) {
    return (
      <Screen>
        <View style={[styles.success, { paddingHorizontal: gutter }]}>
          <View style={[styles.successIcon, isCompact && styles.successIconCompact]}>
            <Ionicons name="checkmark" size={30} color={colors.onPrimary} />
          </View>
          <AppText variant="displaySM" center>
            Listing posted
          </AppText>
          <AppText variant="bodyMD" tone="muted" center style={styles.successBody}>
            Your {submitted.kind.toLowerCase()} in {submitted.locality} is live across Raichur
            district. Owners nearby can now find it.
          </AppText>
          <PrimaryButton label="View my properties" onPress={() => router.push('/my-properties')} />
          <SecondaryButton label="List another property" tone="outline" onPress={reset} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingHorizontal: gutter }]}>
          <View style={styles.header}>
            <AppText variant="displayLG">List your property</AppText>
            <AppText variant="bodySM" tone="muted">
              Sell or rent out across Raichur, Manvi, Sindhanur, Lingasgur and Mudgal.
            </AppText>
          </View>

          <Field label="I want to">
            <ChipRow
              options={[
                { id: 'sale', label: 'Sell' },
                { id: 'rent', label: 'Rent out' },
              ]}
              active={mode}
              onChange={(id) => setMode(id as DealMode)}
            />
          </Field>

          <Field label="Property type">
            <ChipRow options={KINDS.map((item) => ({ id: item, label: item }))} active={kind} onChange={(id) => setKind(id as ListingKind)} />
          </Field>

          <Field label="Town">
            <ChipRow
              options={TOWNS.map((item) => ({ id: item.id, label: item.label }))}
              active={town}
              onChange={(id) => setTown(id as TownId)}
            />
          </Field>

          {mode === 'rent' ? (
            <Field label="Who is it for?">
              <ChipRow
                options={AUDIENCES.map((item) => ({ id: item.id, label: item.label }))}
                active={audience}
                onChange={(id) => setAudience(id as RentalAudience)}
              />
            </Field>
          ) : null}

          <Field label="Title">
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={`e.g. 2BHK ${kind.toLowerCase()} near main road`}
              placeholderTextColor={colors.mutedSoft}
              style={inputStyle}
              maxLength={60}
            />
          </Field>

          <Field label="Locality / area">
            <TextInput
              value={locality}
              onChangeText={setLocality}
              placeholder="e.g. Gandhi Chowk, Bank Colony"
              placeholderTextColor={colors.mutedSoft}
              style={inputStyle}
              maxLength={40}
            />
          </Field>

          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <Field label={mode === 'rent' ? 'Rent per month (₹)' : 'Asking price (₹)'}>
                <TextInput
                  value={price}
                  onChangeText={setPrice}
                  placeholder="e.g. 25000"
                  placeholderTextColor={colors.mutedSoft}
                  style={inputStyle}
                  keyboardType="number-pad"
                  maxLength={10}
                />
              </Field>
            </View>
            <View style={styles.fieldHalf}>
              <Field label="Area (sq ft)">
                <TextInput
                  value={area}
                  onChangeText={setArea}
                  placeholder="e.g. 1200"
                  placeholderTextColor={colors.mutedSoft}
                  style={inputStyle}
                  keyboardType="number-pad"
                  maxLength={8}
                />
              </Field>
            </View>
          </View>

          {hasRooms ? (
            <View style={styles.fieldRow}>
              <View style={styles.fieldHalf}>
                <Field label="Bedrooms">
                  <TextInput
                    value={beds}
                    onChangeText={setBeds}
                    placeholder="e.g. 2"
                    placeholderTextColor={colors.mutedSoft}
                    style={inputStyle}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </Field>
              </View>
              <View style={styles.fieldHalf}>
                <Field label="Bathrooms">
                  <TextInput
                    value={baths}
                    onChangeText={setBaths}
                    placeholder="e.g. 1"
                    placeholderTextColor={colors.mutedSoft}
                    style={inputStyle}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </Field>
              </View>
            </View>
          ) : null}

          <View style={styles.mediaSection}>
            <Field label="Photos (optional)">
              <AppText variant="captionSM" tone="muted">
                Up to 8. The first photo becomes the cover buyers see in Explore.
              </AppText>
              <PhotoStrip
                photos={media.photos}
                onAddFromLibrary={() => { void media.pickFromLibrary(); }}
                onTakePhoto={() => { void media.takePhoto(); }}
                onRemove={media.removePhoto}
                onRetry={media.retry}
              />
            </Field>
            {media.notice ? <AppText variant="captionSM" tone="primary">{media.notice}</AppText> : null}
          </View>

          <Field label="Documents (optional)">
            <DocumentAttachments
              documents={media.documents}
              onAdd={(kind) => { void media.addDocument(kind); }}
              onCapture={(kind) => { void media.captureDocument(kind); }}
              onRemove={media.removeDocument}
              onRetry={media.retry}
            />
          </Field>

          <View style={styles.note}>
            <Ionicons name="information-circle-outline" size={16} color={colors.muted} />
            <AppText variant="captionSM" tone="muted" style={styles.noteText}>
              {KIND_IDS[kind] === 'hostel'
                ? 'Student room listings go to the Student rooms category in Explore.'
                : 'Your listing appears instantly in Explore and Home for your town.'}
            </AppText>
          </View>

          <PrimaryButton
            label={
              media.uploading ? 'Uploading photos…'
                : createProperty.isPending ? 'Posting property…'
                  : !user ? 'Sign in to post'
                    : mode === 'rent' ? 'Post rental listing' : 'Post property for sale'
            }
            icon="checkmark"
            disabled={!canSubmit || createProperty.isPending || media.uploading}
            onPress={() => { void submit(); }}
          />
          <ConnectionStatus error={createProperty.error} />
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
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  header: {
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  field: {
    gap: spacing.xs,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  fieldHalf: {
    flex: 1,
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
  mediaSection: {
    gap: spacing.xs,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  noteText: {
    flex: 1,
  },
  footerSpace: {
    height: spacing.md,
  },
  success: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingBottom: spacing.section,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  successIconCompact: {
    width: 54,
    height: 54,
  },
  successBody: {
    maxWidth: 300,
  },
});

const inputStyle = [typography.bodyMD, styles.input];
