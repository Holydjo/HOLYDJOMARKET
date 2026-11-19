/**
 * Time zone helpers. A provider's time zone comes from their location
 * (offline lookup, no API call), so appointment times and "open now" are
 * correct anywhere in Canada (Vancouver, Regina, Halifax, St. John's…).
 */
// tz-lookup has no type definitions; it exports a single (lat, lng) => IANA name function.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tzLookup: (lat: number, lng: number) => string = require('tz-lookup');

/** Used when a location is missing or the lookup fails (Eastern time, Montréal/Toronto). */
export const DEFAULT_TZ = 'America/Toronto';

export function timeZoneAt(lat?: number | null, lng?: number | null): string {
  if (lat == null || lng == null) return DEFAULT_TZ;
  try {
    return tzLookup(lat, lng);
  } catch {
    return DEFAULT_TZ;
  }
}
