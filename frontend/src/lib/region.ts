/**
 * Where the user probably is, to favour nearby address suggestions
 * ("King Street" → Toronto for someone in Toronto, not a street near Montréal).
 *
 * 1. Their last position from "Autour de moi" (kept for this browser session).
 * 2. Otherwise their device's time zone, mapped to a reference city. Eastern
 *    time (America/Toronto) covers both Montréal and Toronto, so we don't
 *    guess there and let the API use its default (Montréal, the launch city).
 */
const KEY = 'holydjo_last_pos';

const TZ_CITY: Record<string, { lat: number; lng: number }> = {
  'America/Vancouver': { lat: 49.28, lng: -123.12 },
  'America/Edmonton': { lat: 51.05, lng: -114.07 }, // Calgary / Edmonton
  'America/Regina': { lat: 50.45, lng: -104.61 },
  'America/Winnipeg': { lat: 49.9, lng: -97.14 },
  'America/Halifax': { lat: 44.65, lng: -63.57 },
  'America/Moncton': { lat: 46.09, lng: -64.78 },
  'America/St_Johns': { lat: 47.56, lng: -52.71 },
  'America/Whitehorse': { lat: 60.72, lng: -135.06 },
  'America/Yellowknife': { lat: 62.45, lng: -114.37 },
  'America/Iqaluit': { lat: 63.75, lng: -68.52 },
};

export function rememberPosition(p: { lat: number; lng: number }) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* private mode: ignore */
  }
}

export function guessRegion(): { lat: number; lng: number } | null {
  try {
    const saved = sessionStorage.getItem(KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    /* ignore */
  }
  try {
    return TZ_CITY[Intl.DateTimeFormat().resolvedOptions().timeZone] ?? null;
  } catch {
    return null;
  }
}

/** "&lat=..&lng=.." (or "") to append to a /places/search URL. */
export function nearParams(near?: { lat: number; lng: number } | null, prefix = '') {
  const n = near ?? guessRegion();
  if (!n) return '';
  const k = (s: string) => (prefix ? `${prefix}${s[0].toUpperCase()}${s.slice(1)}` : s);
  return `&${k('lat')}=${n.lat.toFixed(3)}&${k('lng')}=${n.lng.toFixed(3)}`;
}
