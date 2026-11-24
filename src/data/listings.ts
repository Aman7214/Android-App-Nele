import type { TownId } from '@/data/locations';

export type ListingStatus = 'active' | 'sold';

export type ListingKind =
  | 'House'
  | 'Apartment'
  | 'Plot'
  | 'Land'
  | 'Shop'
  | 'Warehouse'
  | 'Hostel';

export type DealMode = 'rent' | 'sale';

/** Who a rental is aimed at; empty for sale listings. */
export type RentalAudience = 'students' | 'family' | 'anyone';

export type Listing = {
  id: string;
  title: string;
  kind: ListingKind;
  locality: string;
  town: TownId;
  /** INR. Monthly amount when `mode` is `rent`. */
  price: number;
  mode: DealMode;
  audience?: RentalAudience;
  beds?: number;
  baths?: number;
  areaSqft: number;
  rating: number;
  reviews: number;
  badge?: string;
  isSaved?: boolean;
  /** Uploaded photo URLs, cover first. Empty means the stock illustration is used. */
  photos?: string[];
  /** Sold properties leave the public feeds but stay readable and badged. */
  status?: ListingStatus;
  soldAt?: string;
  /** Demo rows have no owner, so they cannot be messaged or marked sold. */
  isSample?: boolean;
  image: number | { uri: string };
  fallbackImage?: number;
};

export const KIND_IDS: Record<ListingKind, string> = {
  House: 'house',
  Apartment: 'apartment',
  Plot: 'plot',
  Land: 'land',
  Shop: 'shop',
  Warehouse: 'warehouse',
  Hostel: 'hostel',
};

export const CATEGORIES: { id: string; label: string; icon: string }[] = [
  { id: 'all', label: 'All', icon: 'grid-outline' },
  { id: 'house', label: 'Houses', icon: 'home-outline' },
  { id: 'apartment', label: 'Apartments', icon: 'business-outline' },
  { id: 'plot', label: 'Plots', icon: 'map-outline' },
  { id: 'land', label: 'Land', icon: 'leaf-outline' },
  { id: 'shop', label: 'Shops', icon: 'storefront-outline' },
  { id: 'warehouse', label: 'Warehouses', icon: 'cube-outline' },
  { id: 'hostel', label: 'Student rooms', icon: 'school-outline' },
];


export function formatPrice(listing: Listing): string {
  const { mode, price } = listing;
  let short: string;

  if (price >= 10000000) {
    short = `₹${(price / 10000000).toFixed(price % 10000000 === 0 ? 0 : 2)} Cr`;
  } else if (price >= 100000) {
    short = `₹${(price / 100000).toFixed(price % 100000 === 0 ? 0 : 1)} L`;
  } else {
    short = `₹${price.toLocaleString('en-IN')}`;
  }

  return mode === 'rent' ? `${short}/month` : short;
}

export function audienceLabel(audience: RentalAudience): string {
  switch (audience) {
    case 'students':
      return 'For students';
    case 'family':
      return 'For families';
    default:
      return 'For anyone';
  }
}
