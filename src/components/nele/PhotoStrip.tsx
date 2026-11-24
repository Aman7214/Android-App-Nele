import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { PhotoDraft } from '@/hooks/use-listing-media';
import { colors, radius, spacing } from '@/theme/tokens';
import { MAX_LISTING_PHOTOS } from '../../../shared/listings';

import { AppText } from './AppText';

type Props = {
  photos: PhotoDraft[];
  onAddFromLibrary: () => void;
  onTakePhoto: () => void;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
};

/** Photo picker strip: local thumbnails, upload state, and the cover marker. */
export function PhotoStrip({ photos, onAddFromLibrary, onTakePhoto, onRemove, onRetry }: Props) {
  const failed = photos.find((photo) => photo.status === 'failed');
  const full = photos.length >= MAX_LISTING_PHOTOS;

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}>
        {photos.map((photo, index) => (
          <Pressable
            key={photo.id}
            accessibilityRole="button"
            accessibilityLabel={
              photo.status === 'failed'
                ? `Photo failed to upload. ${photo.error ?? ''} Tap to retry.`
                : index === 0 ? 'Cover photo' : `Photo ${index + 1}`
            }
            onPress={photo.status === 'failed' ? () => onRetry(photo.id) : undefined}
            style={styles.tile}>
            <Image source={{ uri: photo.uri }} style={styles.image} contentFit="cover" />
            {photo.status === 'uploading' ? (
              <View style={styles.overlay}>
                <ActivityIndicator color={colors.onPrimary} />
              </View>
            ) : null}
            {photo.status === 'failed' ? (
              <View style={[styles.overlay, styles.overlayFailed]}>
                <Ionicons name="refresh" size={20} color={colors.onPrimary} />
              </View>
            ) : null}
            {index === 0 && photo.status === 'ready' ? (
              <View style={styles.cover}>
                <AppText variant="badge" tone="onPrimary">Cover</AppText>
              </View>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove photo ${index + 1}`}
              hitSlop={12}
              onPress={() => onRemove(photo.id)}
              style={styles.remove}>
              <Ionicons name="close" size={14} color={colors.onPrimary} />
            </Pressable>
          </Pressable>
        ))}

        {full ? null : (
          <>
            <AddTile icon="images-outline" label="Photos" onPress={onAddFromLibrary} />
            <AddTile icon="camera-outline" label="Camera" onPress={onTakePhoto} />
          </>
        )}
      </ScrollView>
      {failed?.error ? (
        <AppText variant="captionSM" tone="muted">{failed.error} Tap the photo to retry.</AppText>
      ) : null}
    </View>
  );
}

function AddTile({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === 'Photos' ? 'Add photos from your library' : 'Take a photo'}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, styles.addTile, pressed && styles.pressed]}>
      <Ionicons name={icon} size={22} color={colors.ink} />
      <AppText variant="captionSM" tone="muted">{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  row: {
    gap: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  tile: {
    width: 84,
    height: 84,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceSoft,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  addTile: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.hairline,
    backgroundColor: colors.canvas,
  },
  pressed: {
    backgroundColor: colors.surfaceStrong,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  overlayFailed: {
    backgroundColor: 'rgba(193, 53, 21, 0.55)',
  },
  cover: {
    position: 'absolute',
    left: spacing.xxs,
    bottom: spacing.xxs,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: radius.xs,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  remove: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 24,
    height: 24,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
});
