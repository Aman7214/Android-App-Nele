import { randomUUID } from 'node:crypto';

import {
  DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import type { DocumentKind } from '../../shared/listings.ts';

/** Public bucket: listing photos are meant to be seen by everyone browsing. */
export const PHOTO_BUCKET = 'listing-photos';
/** Private bucket: ownership papers and IDs never leave the owner's account. */
export const DOCUMENT_BUCKET = 'assets';

const PHOTO_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  // Android content providers sometimes report the short alias.
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const DOCUMENT_TYPES: Record<string, string> = {
  ...PHOTO_TYPES,
  'application/pdf': 'pdf',
};

export const MAX_PHOTO_BYTES = 8_388_608;
export const MAX_DOCUMENT_BYTES = 15_728_640;

export function photoExtension(mimeType: string): string | undefined {
  return PHOTO_TYPES[mimeType];
}

export function documentExtension(mimeType: string): string | undefined {
  return DOCUMENT_TYPES[mimeType];
}

function endpoint(): string | null {
  const value = process.env.AWS_ENDPOINT_URL_S3;
  return value ? value.replace(/\/+$/, '') : null;
}

/** Absolute, anonymously readable URL for an uploaded photo. */
export function photoUrl(key: string): string {
  const base = endpoint();
  if (!base) return key;
  return `${base}/${PHOTO_BUCKET}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

export type StoredMedia = { key: string; name: string; mimeType: string; size: number };

export interface MediaStorage {
  putPhoto(ownerId: string, file: { bytes: Uint8Array; mimeType: string; name: string; size: number }): Promise<StoredMedia>;
  putDocument(ownerId: string, file: { bytes: Uint8Array; mimeType: string; name: string; size: number }, kind: DocumentKind): Promise<StoredMedia>;
  /** Short-lived read URL for a private document. */
  signDocument(key: string): Promise<string>;
  /** Removes every object the account uploaded. Used by account deletion. */
  deleteOwned(ownerId: string): Promise<number>;
}

function client() {
  // Credentials, endpoint and region all come from the injected AWS_* variables;
  // Neon Object Storage only speaks path-style addressing.
  return new S3Client({ forcePathStyle: true });
}

function safeName(value: string): string {
  return value.replace(/[^\w.\- ]+/g, '').trim().slice(0, 120) || 'file';
}

export function createMediaStorage(): MediaStorage | null {
  if (!endpoint() || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) return null;
  const s3 = client();

  return {
    async putPhoto(ownerId, file) {
      const extension = photoExtension(file.mimeType) ?? 'jpg';
      const key = `listings/${ownerId}/${randomUUID()}.${extension}`;
      await s3.send(new PutObjectCommand({
        Bucket: PHOTO_BUCKET,
        Key: key,
        Body: file.bytes,
        ContentType: file.mimeType,
        // Keys are unique per upload, so a photo never changes under a cached URL.
        CacheControl: 'public, max-age=31536000, immutable',
      }));
      return { key, name: safeName(file.name), mimeType: file.mimeType, size: file.size };
    },
    async putDocument(ownerId, file, kind) {
      const extension = documentExtension(file.mimeType) ?? 'pdf';
      const key = `documents/${ownerId}/${kind}-${randomUUID()}.${extension}`;
      await s3.send(new PutObjectCommand({
        Bucket: DOCUMENT_BUCKET,
        Key: key,
        Body: file.bytes,
        ContentType: file.mimeType,
        // Private: never readable without a signed link.
        CacheControl: 'private, no-store',
      }));
      return { key, name: safeName(file.name), mimeType: file.mimeType, size: file.size };
    },
    async signDocument(key) {
      return getSignedUrl(s3, new GetObjectCommand({ Bucket: DOCUMENT_BUCKET, Key: key }), { expiresIn: 300 });
    },
    async deleteOwned(ownerId) {
      let removed = 0;
      for (const [bucket, prefix] of [
        [PHOTO_BUCKET, `listings/${ownerId}/`],
        [DOCUMENT_BUCKET, `documents/${ownerId}/`],
      ] as const) {
        let token: string | undefined;
        do {
          const page = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }));
          const keys = (page.Contents ?? []).flatMap((object) => object.Key ? [{ Key: object.Key }] : []);
          if (keys.length) {
            // DeleteObjects caps at 1000 keys per call; a page never exceeds that.
            await s3.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys, Quiet: true } }));
            removed += keys.length;
          }
          token = page.IsTruncated ? page.NextContinuationToken : undefined;
        } while (token);
      }
      return removed;
    },
  };
}
