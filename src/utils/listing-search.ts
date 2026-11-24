import type { Listing } from '@/data/listings';

/** Match every search word across a property's name, type, and location. */
export function matchesListingSearch(listing: Listing, townLabel: string, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;

  const searchableText = [
    listing.title,
    listing.kind,
    `${listing.kind}s`,
    listing.locality,
    townLabel,
    listing.mode === 'sale' ? 'buy sell sale' : 'rent rental',
    listing.audience,
    listing.beds ? `${listing.beds}bhk ${listing.beds} beds` : '',
  ].join(' ').toLowerCase();

  return words.every((word) => searchableText.includes(word));
}
