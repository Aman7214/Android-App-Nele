import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';

import { useUploadMedia } from '@/hooks/use-properties';
import type { PickedMedia } from '@/services/media-upload';
import { MAX_LISTING_DOCUMENTS, MAX_LISTING_PHOTOS, type DocumentKind } from '../../shared/listings';

const MAX_PHOTO_BYTES = 8_388_608;
const MAX_DOCUMENT_BYTES = 15_728_640;

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export type MediaStatus = 'uploading' | 'ready' | 'failed';

export type PhotoDraft = {
  id: string;
  uri: string;
  name: string;
  mimeType: string;
  width?: number;
  height?: number;
  key?: string;
  status: MediaStatus;
  error?: string;
};

export type DocumentDraft = {
  id: string;
  uri: string;
  kind: DocumentKind;
  name: string;
  mimeType: string;
  size: number;
  key?: string;
  status: MediaStatus;
  error?: string;
};

/** Pickers may omit the MIME type; fall back to the file extension. */
function documentMime(name: string, reported?: string): string {
  if (reported && reported !== 'application/octet-stream') return reported;
  const extension = name.toLowerCase().split('.').pop();
  if (extension === 'pdf') return 'application/pdf';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  return 'image/jpeg';
}

function reason(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
  return 'The upload failed. Tap to retry.';
}

type Options = {
  /** Called when an upload needs an account; the screen routes to sign-in. */
  onNeedsSignIn: () => void;
  signedIn: boolean;
};

/**
 * Owns the photo and document selection for a new listing.
 *
 * Photos are optional, and documents are optional: neither ever blocks
 * publishing. Each pick uploads immediately so the seller sees a real thumbnail
 * and a retryable error instead of a stuck spinner at submit time.
 */
export function useListingMedia({ onNeedsSignIn, signedIn }: Options) {
  const upload = useUploadMedia();
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [documents, setDocuments] = useState<DocumentDraft[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const patchPhoto = useCallback((id: string, patch: Partial<PhotoDraft>) => {
    setPhotos((current) => current.map((photo) => (photo.id === id ? { ...photo, ...patch } : photo)));
  }, []);
  const patchDocument = useCallback((id: string, patch: Partial<DocumentDraft>) => {
    setDocuments((current) => current.map((document) => (document.id === id ? { ...document, ...patch } : document)));
  }, []);

  const sendPhoto = useCallback(async (draft: PhotoDraft, media: PickedMedia) => {
    try {
      const result = await upload.mutateAsync({ media, purpose: 'photo' });
      patchPhoto(draft.id, { key: result.key, status: 'ready', error: undefined });
    } catch (error) {
      patchPhoto(draft.id, { status: 'failed', error: reason(error) });
    }
  }, [patchPhoto, upload]);

  const sendDocument = useCallback(async (draft: DocumentDraft, media: PickedMedia) => {
    try {
      const result = await upload.mutateAsync({ media, purpose: 'document', kind: draft.kind });
      patchDocument(draft.id, {
        key: result.key, name: result.name, mimeType: result.mimeType, size: result.size,
        status: 'ready', error: undefined,
      });
    } catch (error) {
      patchDocument(draft.id, { status: 'failed', error: reason(error) });
    }
  }, [patchDocument, upload]);

  const addAssets = useCallback((assets: { media: PickedMedia; width?: number; height?: number }[]) => {
    setNotice(null);
    const room = MAX_LISTING_PHOTOS - photos.length;
    if (room <= 0) { setNotice(`You can add up to ${MAX_LISTING_PHOTOS} photos.`); return; }
    for (const asset of assets.slice(0, room)) {
      const id = newId();
      if ((asset.media.size ?? 0) > MAX_PHOTO_BYTES) {
        setPhotos((current) => [...current, {
          id, uri: asset.media.uri, name: asset.media.name, mimeType: asset.media.mimeType,
          width: asset.width, height: asset.height,
          status: 'failed', error: 'Keep each photo under 8 MB.',
        }]);
        continue;
      }
      const draft: PhotoDraft = {
        id, uri: asset.media.uri, name: asset.media.name, mimeType: asset.media.mimeType,
        width: asset.width, height: asset.height, status: 'uploading',
      };
      setPhotos((current) => [...current, draft]);
      void sendPhoto(draft, asset.media);
    }
  }, [photos.length, sendPhoto]);

  const pickFromLibrary = useCallback(async () => {
    if (!signedIn) { onNeedsSignIn(); return; }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { setNotice('Allow photo access in settings to add pictures.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      // SDK 58 uses the string `MediaType` enum; `MediaTypeOptions` is deprecated.
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: Math.max(1, MAX_LISTING_PHOTOS - photos.length),
      quality: 0.8,
      exif: false,
      allowsEditing: false,
    });
    if (result.canceled) return;
    addAssets(result.assets.map((asset) => ({
      media: {
        uri: asset.uri,
        name: asset.fileName ?? 'photo.jpg',
        mimeType: asset.mimeType ?? 'image/jpeg',
        size: asset.fileSize,
        blob: Platform.OS === 'web' ? asset.file : undefined,
      },
      width: asset.width,
      height: asset.height,
    })));
  }, [addAssets, onNeedsSignIn, photos.length, signedIn]);

  const takePhoto = useCallback(async () => {
    if (!signedIn) { onNeedsSignIn(); return; }
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) { setNotice('Allow camera access in settings to take pictures.'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8, exif: false });
    if (result.canceled) return;
    addAssets(result.assets.map((asset) => ({
      media: {
        uri: asset.uri,
        name: asset.fileName ?? 'photo.jpg',
        mimeType: asset.mimeType ?? 'image/jpeg',
        size: asset.fileSize,
        blob: Platform.OS === 'web' ? asset.file : undefined,
      },
      width: asset.width,
      height: asset.height,
    })));
  }, [addAssets, onNeedsSignIn, signedIn]);

  const addDocument = useCallback(async (kind: DocumentKind) => {
    if (!signedIn) { onNeedsSignIn(); return; }
    if (documents.length >= MAX_LISTING_DOCUMENTS) {
      setNotice(`You can attach up to ${MAX_LISTING_DOCUMENTS} documents.`);
      return;
    }
    setNotice(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
      multiple: false,
      // Required so the file can be read straight after picking.
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const id = newId();
    const draft: DocumentDraft = {
      id,
      uri: asset.uri,
      kind,
      name: asset.name || 'document',
      mimeType: documentMime(asset.name || 'document', asset.mimeType),
      size: asset.size ?? 0,
      status: 'uploading',
    };
    if ((asset.size ?? 0) > MAX_DOCUMENT_BYTES) {
      setDocuments((current) => [...current, { ...draft, status: 'failed', error: 'Keep each document under 15 MB.' }]);
      return;
    }
    setDocuments((current) => [...current, draft]);
    void sendDocument(draft, {
      uri: asset.uri,
      name: draft.name,
      mimeType: draft.mimeType,
      size: asset.size,
      blob: Platform.OS === 'web' ? asset.file : undefined,
    });
  }, [documents.length, onNeedsSignIn, sendDocument, signedIn]);

  /** Photograph a paper document with the camera instead of picking a file. */
  const captureDocument = useCallback(async (kind: DocumentKind) => {
    if (!signedIn) { onNeedsSignIn(); return; }
    if (documents.length >= MAX_LISTING_DOCUMENTS) {
      setNotice(`You can attach up to ${MAX_LISTING_DOCUMENTS} documents.`);
      return;
    }
    setNotice(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setNotice('Allow camera access in settings to photograph a document.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.9, exif: false });
    if (result.canceled) return;
    const asset = result.assets[0];
    const id = newId();
    const name = `${kind}-${new Date().toISOString().slice(0, 10)}.jpg`;
    const draft: DocumentDraft = {
      id, uri: asset.uri, kind, name, mimeType: 'image/jpeg', size: asset.fileSize ?? 0, status: 'uploading',
    };
    if ((asset.fileSize ?? 0) > MAX_DOCUMENT_BYTES) {
      setDocuments((current) => [...current, { ...draft, status: 'failed', error: 'Keep each document under 15 MB.' }]);
      return;
    }
    setDocuments((current) => [...current, draft]);
    void sendDocument(draft, {
      uri: asset.uri,
      name,
      mimeType: 'image/jpeg',
      size: asset.fileSize,
      blob: Platform.OS === 'web' ? asset.file : undefined,
    });
  }, [documents.length, onNeedsSignIn, sendDocument, signedIn]);

  const retry = useCallback((id: string) => {
    const photo = photos.find((item) => item.id === id);
    if (photo) {
      patchPhoto(id, { status: 'uploading', error: undefined });
      void sendPhoto({ ...photo, status: 'uploading' }, {
        uri: photo.uri, name: photo.name, mimeType: photo.mimeType, size: undefined,
      });
      return;
    }
    const document = documents.find((item) => item.id === id);
    if (document) {
      patchDocument(id, { status: 'uploading', error: undefined });
      void sendDocument({ ...document, status: 'uploading' }, {
        uri: document.uri, name: document.name, mimeType: document.mimeType, size: document.size,
      });
    }
  }, [documents, patchDocument, patchPhoto, photos, sendDocument, sendPhoto]);

  const removePhoto = useCallback((id: string) => {
    setPhotos((current) => current.filter((photo) => photo.id !== id));
  }, []);
  const removeDocument = useCallback((id: string) => {
    setDocuments((current) => current.filter((document) => document.id !== id));
  }, []);
  const resetMedia = useCallback(() => {
    setPhotos([]);
    setDocuments([]);
    setNotice(null);
  }, []);

  const uploading = photos.some((photo) => photo.status === 'uploading')
    || documents.some((document) => document.status === 'uploading');

  return {
    photos,
    documents,
    notice,
    uploading,
    /** Photos ready to attach, cover first. */
    attachedPhotos: photos
      .filter((photo) => photo.status === 'ready' && photo.key)
      .map((photo) => ({ key: photo.key!, width: photo.width, height: photo.height })),
    attachedDocuments: documents
      .filter((document) => document.status === 'ready' && document.key)
      .map((document) => ({
        key: document.key!, kind: document.kind, name: document.name,
        mimeType: document.mimeType, size: document.size,
      })),
    pickFromLibrary,
    takePhoto,
    addDocument,
    captureDocument,
    removePhoto,
    removeDocument,
    retry,
    resetMedia,
  };
}
