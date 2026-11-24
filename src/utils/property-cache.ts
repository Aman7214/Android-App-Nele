import type { InfiniteData } from '@tanstack/react-query';

import type { ListingPage } from '../../shared/listings';

export function setSavedFlag(data: InfiniteData<ListingPage> | undefined, listingId: string, saved: boolean) {
  return data ? {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      listings: page.listings.map((listing) => listing.id === listingId ? { ...listing, saved } : listing),
    })),
  } : data;
}
