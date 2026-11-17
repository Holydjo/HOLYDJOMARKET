/**
 * Small geo helpers. For V1 we compute distances in Node rather than with
 * PostGIS: a bounding-box pre-filter in SQL keeps the candidate set small,
 * then the exact haversine distance is computed here. Good enough for a few
 * thousand providers per city; switch to PostGIS when that stops being true.
 */
const EARTH_RADIUS_KM = 6371;

export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/** Lat/lng rectangle that contains the circle (center, radiusKm). */
export function boundingBox(lat: number, lng: number, radiusKm: number) {
  const dLat = radiusKm / 111; // ~111 km per degree of latitude
  const dLng = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  return { minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng };
}

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}
