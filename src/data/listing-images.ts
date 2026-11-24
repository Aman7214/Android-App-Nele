import type { ImageAsset, ListingRecord } from '../../shared/listings';

import type { Listing, ListingKind } from './listings';
import { imageSource } from './image-source';

export const LISTING_IMAGES: Record<ImageAsset, number> = {
  house: require('@/assets/images/nele/house.webp'),
  apartment: require('@/assets/images/nele/apartment.webp'),
  flat: require('@/assets/images/nele/flat.webp'),
  plot: require('@/assets/images/nele/plot.webp'),
  land: require('@/assets/images/nele/land.webp'),
  shop: require('@/assets/images/nele/shop.webp'),
  warehouse: require('@/assets/images/nele/warehouse.webp'),
  hostel: require('@/assets/images/nele/hostel.webp'),
};

const kindAssets: Record<ListingKind, ImageAsset> = {
  House: 'house', Apartment: 'apartment', Plot: 'plot', Land: 'land',
  Shop: 'shop', Warehouse: 'warehouse', Hostel: 'hostel',
};

export function imageAssetForKind(kind: ListingKind): ImageAsset { return kindAssets[kind]; }

export function toListing(record: ListingRecord): Listing {
  const { imageAsset, saved, photos, ...details } = record;
  const urls = photos.map((photo) => photo.url);
  // An uploaded cover replaces the stock illustration; the illustration stays as
  // the fallback shown if the cover fails to load.
  return {
    ...details,
    photos: urls,
    image: urls[0] ? { uri: urls[0] } : imageSource(imageAsset, LISTING_IMAGES[imageAsset]),
    fallbackImage: LISTING_IMAGES[imageAsset],
    isSaved: saved,
  };
}
