import { z } from 'zod';

export const listingKinds = ['House', 'Apartment', 'Plot', 'Land', 'Shop', 'Warehouse', 'Hostel'] as const;
export const towns = ['raichur', 'manvi', 'sindhanur', 'lingasgur', 'mudgal'] as const;
export const imageAssets = ['house', 'apartment', 'flat', 'plot', 'land', 'shop', 'warehouse', 'hostel'] as const;

export const documentKinds = ['ownership', 'tax', 'id', 'other'] as const;
export const listingStatuses = ['active', 'sold'] as const;

export type ListingKind = (typeof listingKinds)[number];
export type DealMode = 'rent' | 'sale';
export type RentalAudience = 'students' | 'family' | 'anyone';
export type ImageAsset = (typeof imageAssets)[number];
export type DocumentKind = (typeof documentKinds)[number];
export type ListingStatus = (typeof listingStatuses)[number];

export const MAX_LISTING_PHOTOS = 8;
export const MAX_LISTING_DOCUMENTS = 6;

/** Object keys are generated server-side; this only rejects obviously wrong input. */
const objectKey = z.string().min(8).max(200).regex(/^[a-zA-Z0-9/_.-]+$/);

/** A photo the client already uploaded, before the listing exists. */
export const uploadedPhotoSchema = z.strictObject({
  key: objectKey,
  width: z.number().int().positive().max(20000).optional(),
  height: z.number().int().positive().max(20000).optional(),
});

/**
 * Documents are optional. When present they are private to the owner and are
 * only ever returned as short-lived signed URLs.
 */
export const uploadedDocumentSchema = z.strictObject({
  key: objectKey,
  kind: z.enum(documentKinds),
  name: z.string().trim().min(1).max(120),
  mimeType: z.string().min(3).max(100),
  size: z.number().int().positive().max(15_728_640),
});

export const listingPhotoSchema = z.object({
  key: z.string(),
  url: z.string(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
});

export const listingDocumentSchema = z.object({
  id: z.string(),
  kind: z.enum(documentKinds),
  name: z.string(),
  mimeType: z.string(),
  size: z.number().int(),
  /** Signed, short-lived read URL. */
  url: z.string(),
});

const listingFields = {
  title: z.string().trim().min(3).max(60),
  kind: z.enum(listingKinds),
  locality: z.string().trim().min(2).max(40),
  town: z.enum(towns),
  price: z.number().int().positive().max(9_999_999_999),
  mode: z.enum(['rent', 'sale']),
  audience: z.enum(['students', 'family', 'anyone']).optional(),
  beds: z.number().int().min(0).max(99).optional(),
  baths: z.number().int().min(0).max(99).optional(),
  areaSqft: z.number().int().positive().max(99_999_999),
  imageAsset: z.enum(imageAssets),
};

export const createListingSchema = z.strictObject({
  ...listingFields,
  requestId: z.string().min(8).max(80).regex(/^[a-zA-Z0-9_-]+$/),
  /** Ordered: the first photo is the cover. Omitted or empty keeps the stock illustration. */
  photos: z.array(uploadedPhotoSchema).max(MAX_LISTING_PHOTOS).optional(),
  documents: z.array(uploadedDocumentSchema).max(MAX_LISTING_DOCUMENTS).optional(),
}).refine((listing) => listing.mode !== 'rent' || listing.audience !== undefined, {
  message: 'Choose who the rental is for.',
  path: ['audience'],
}).refine((listing) => listing.mode !== 'sale' || listing.audience === undefined, {
  message: 'Sale properties cannot have a rental audience.',
  path: ['audience'],
});

export const listingRecordSchema = z.object({
  ...listingFields,
  id: z.string(),
  rating: z.number().min(0).max(5),
  reviews: z.number().int().nonnegative(),
  badge: z.string().optional(),
  createdAt: z.string(),
  saved: z.boolean(),
  isSample: z.boolean(),
  status: z.enum(listingStatuses).default('active'),
  /** Set the moment an owner marks the property sold. */
  soldAt: z.string().optional(),
  /** Uploaded photos, cover first. Empty means the stock `imageAsset` is shown. */
  photos: z.array(listingPhotoSchema).default([]),
});

/** One listing plus the private documents only its owner may see. */
export const listingDetailSchema = listingRecordSchema.extend({
  documents: z.array(listingDocumentSchema).default([]),
  /** True when the caller owns the listing, which unlocks sold/relist controls. */
  isOwner: z.boolean().default(false),
});

/** Owner-only: flip a listing between live and sold. */
export const updateListingStatusSchema = z.strictObject({
  status: z.enum(listingStatuses),
});

export const uploadPurposeSchema = z.enum(['photo', 'document']);

export const uploadResultSchema = z.strictObject({
  key: z.string(),
  purpose: uploadPurposeSchema,
  /** Public URL for photos; null for private documents. */
  url: z.string().nullable(),
  name: z.string(),
  mimeType: z.string(),
  size: z.number().int().nonnegative(),
});

export const listingPageSchema = z.object({
  listings: z.array(listingRecordSchema),
  nextCursor: z.string().nullable(),
});

export const accountCountsSchema = z.object({
  listed: z.number().int().nonnegative(),
  saved: z.number().int().nonnegative(),
});

export const listingFiltersSchema = z.object({
  kind: z.enum(listingKinds).optional(),
  town: z.enum(towns).optional(),
  mode: z.enum(['rent', 'sale']).optional(),
  audience: z.enum(['students', 'family', 'anyone']).optional(),
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(512).optional(),
});

export type CreateListingInput = z.infer<typeof createListingSchema>;
export type ListingRecord = z.infer<typeof listingRecordSchema>;
export type UpdateListingStatusInput = z.infer<typeof updateListingStatusSchema>;
export type ListingDetail = z.infer<typeof listingDetailSchema>;
export type ListingPhoto = z.infer<typeof listingPhotoSchema>;
export type ListingDocument = z.infer<typeof listingDocumentSchema>;
export type UploadPurpose = z.infer<typeof uploadPurposeSchema>;
export type UploadResult = z.infer<typeof uploadResultSchema>;
export type UploadedPhoto = z.infer<typeof uploadedPhotoSchema>;
export type UploadedDocument = z.infer<typeof uploadedDocumentSchema>;
export type ListingPage = z.infer<typeof listingPageSchema>;
export type AccountCounts = z.infer<typeof accountCountsSchema>;
export type ListingFilters = Pick<z.infer<typeof listingFiltersSchema>, 'kind' | 'town' | 'mode' | 'audience' | 'q'>;
export type ListingQuery = z.infer<typeof listingFiltersSchema>;
export type ListingScope = 'listings' | 'saved' | 'mine';
