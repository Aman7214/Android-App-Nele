/**
 * Raichur district service area. The app only lists property in these towns;
 * a device location resolves to the nearest one.
 */
export type TownId = 'raichur' | 'manvi' | 'sindhanur' | 'lingasgur' | 'mudgal';

export type Town = {
  id: TownId;
  label: string;
  lat: number;
  lng: number;
};

export const DISTRICT = 'Raichur district';

export const TOWNS: Town[] = [
  { id: 'raichur', label: 'Raichur', lat: 16.2076, lng: 77.3463 },
  { id: 'manvi', label: 'Manvi', lat: 15.9913, lng: 77.2744 },
  { id: 'sindhanur', label: 'Sindhanur', lat: 15.7668, lng: 76.756 },
  { id: 'lingasgur', label: 'Lingasgur', lat: 16.045, lng: 76.918 },
  { id: 'mudgal', label: 'Mudgal', lat: 16.0167, lng: 76.4333 },
];

export function townById(id: TownId): Town {
  return TOWNS.find((town) => town.id === id) ?? TOWNS[0];
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** Nearest service town to a coordinate; everything in the district resolves. */
export function nearestTown(lat: number, lng: number): Town {
  let best = TOWNS[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const town of TOWNS) {
    const distance = haversineKm(lat, lng, town.lat, town.lng);
    if (distance < bestDistance) {
      best = town;
      bestDistance = distance;
    }
  }
  return best;
}
