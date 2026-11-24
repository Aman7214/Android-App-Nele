import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { uploadResultSchema, type DocumentKind, type UploadPurpose, type UploadResult } from '../../shared/listings';
import { requestApiForm } from './api';

/** A file the pickers handed back, normalised for upload. */
export type PickedMedia = {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
  /** Web only — the picker gives a real browser `File`. */
  blob?: Blob;
};

/**
 * Sends one photo or document to the API, which stores it in Neon Object
 * Storage and returns the object key the listing will reference.
 *
 * Photos land in a public bucket (so the feed can show them); documents land in
 * a private bucket and are only ever reachable through a signed link.
 */
export async function uploadMedia(
  media: PickedMedia,
  purpose: UploadPurpose,
  userId: string,
  kind?: DocumentKind,
): Promise<UploadResult> {
  const form = new FormData();
  form.append('purpose', purpose);
  form.append('name', media.name);
  if (kind) form.append('kind', kind);
  if (Platform.OS === 'web' && media.blob) {
    form.append('file', media.blob, media.name);
  } else {
    // `File` wraps the picked asset URI and lets the runtime stream the bytes.
    form.append('file', new File(media.uri) as unknown as Blob, media.name);
  }
  return requestApiForm('uploads', form, uploadResultSchema, userId);
}
