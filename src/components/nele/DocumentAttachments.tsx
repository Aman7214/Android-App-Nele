import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import type { DocumentDraft } from '@/hooks/use-listing-media';
import { colors, radius, spacing } from '@/theme/tokens';
import type { DocumentKind } from '../../../shared/listings';

import { AppText } from './AppText';

export const DOCUMENT_KINDS: { id: DocumentKind; label: string }[] = [
  { id: 'ownership', label: 'Ownership proof' },
  { id: 'tax', label: 'Tax receipt' },
  { id: 'id', label: 'ID proof' },
  { id: 'other', label: 'Other' },
];

export function documentKindLabel(kind: DocumentKind): string {
  return DOCUMENT_KINDS.find((entry) => entry.id === kind)?.label ?? 'Document';
}

function formatSize(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return bytes > 0 ? `${bytes} B` : 'PDF';
}

type Props = {
  documents: DocumentDraft[];
  onAdd: (kind: DocumentKind) => void;
  /** Photograph the paper instead of picking a file. */
  onCapture: (kind: DocumentKind) => void;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
};

/**
 * Optional paper trail. Nothing here is required to publish, and uploaded
 * documents stay private to the owner's account.
 */
export function DocumentAttachments({ documents, onAdd, onCapture, onRemove, onRetry }: Props) {
  // The camera needs to know what it is photographing, so ask before opening it.
  const askKindThenCapture = () => {
    Alert.alert('Photograph a document', 'What is this document?', [
      ...DOCUMENT_KINDS.map((kind) => ({ text: kind.label, onPress: () => onCapture(kind.id) })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.chipRow}>
        {DOCUMENT_KINDS.map((kind) => (
          <Pressable
            key={kind.id}
            accessibilityRole="button"
            accessibilityLabel={`Attach ${kind.label.toLowerCase()}`}
            onPress={() => onAdd(kind.id)}
            style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
            <Ionicons name="add" size={14} color={colors.ink} />
            <AppText variant="captionSM" tone="body">{kind.label}</AppText>
          </Pressable>
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Photograph a document with the camera"
        onPress={askKindThenCapture}
        style={({ pressed }) => [styles.cameraRow, pressed && styles.pressed]}>
        <Ionicons name="camera-outline" size={16} color={colors.ink} />
        <AppText variant="captionSM" tone="body">Photograph a document</AppText>
      </Pressable>

      {documents.length ? documents.map((document) => {
        const failed = document.status === 'failed';
        return (
          <Pressable
            key={document.id}
            accessibilityRole="button"
            accessibilityLabel={failed ? `Retry ${document.name}` : document.name}
            onPress={failed ? () => onRetry(document.id) : undefined}
            style={styles.row}>
            <Ionicons
              name={document.mimeType === 'application/pdf' ? 'document-text-outline' : 'image-outline'}
              size={18}
              color={failed ? colors.error : colors.muted}
            />
            <View style={styles.rowBody}>
              <AppText variant="captionSM" numberOfLines={1}>{document.name}</AppText>
              <AppText variant="captionSM" tone="muted">
                {failed
                  ? `${document.error ?? 'Upload failed'} Tap to retry.`
                  : `${documentKindLabel(document.kind)} · ${formatSize(document.size)}`}
              </AppText>
            </View>
            {document.status === 'uploading' ? <ActivityIndicator size="small" color={colors.muted} /> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${document.name}`}
              hitSlop={12}
              onPress={() => onRemove(document.id)}
              style={styles.remove}>
              <Ionicons name="close" size={16} color={colors.muted} />
            </Pressable>
          </Pressable>
        );
      }) : (
        <AppText variant="captionSM" tone="muted">
          Optional. Add ownership papers, a tax receipt or an ID if you want them on file.
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.md,
    height: 34,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.canvas,
  },
  pressed: {
    backgroundColor: colors.surfaceStrong,
  },
  cameraRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    height: 34,
    borderRadius: radius.full,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.hairline,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSoft,
  },
  rowBody: {
    flex: 1,
    gap: 1,
  },
  remove: {
    padding: spacing.xxs,
  },
});
