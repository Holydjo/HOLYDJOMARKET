/**
 * Time-zone helpers for the browser. Appointments happen at the provider's
 * location, so dates are entered and shown in the provider's time zone,
 * whatever the time zone of the person looking (customer travelling, admin…).
 */
export const DEFAULT_TZ = 'America/Toronto';

const browserTz = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return DEFAULT_TZ;
  }
};

/** Wall-clock parts of `date` as seen in `tz`. */
function partsIn(date: Date, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short',
    })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  );
  return p as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'weekday', string>;
}

/**
 * "2026-12-05" + "14:00" in America/Vancouver → the matching UTC ISO string.
 * (Two passes handle daylight-saving changes.)
 */
export function zonedToUtcIso(date: string, time: string, tz: string): string {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const target = Date.UTC(y, mo - 1, d, h, mi);
  let guess = target;
  for (let i = 0; i < 2; i++) {
    const p = partsIn(new Date(guess), tz);
    const seen = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
    guess += target - seen;
  }
  return new Date(guess).toISOString();
}

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Current weekday (0 = Sunday) and "HH:MM" at the provider's location. */
export function nowIn(tz: string) {
  const p = partsIn(new Date(), tz);
  return { weekday: WEEKDAY_INDEX[p.weekday] ?? new Date().getDay(), hhmm: `${p.hour}:${p.minute}` };
}

/** Short zone label ("HNP", "HNR"…) or null when it's the viewer's own zone. */
export function zoneLabelIfDifferent(tz?: string | null): string | null {
  if (!tz || tz === browserTz()) return null;
  return (
    new Intl.DateTimeFormat('fr-CA', { timeZone: tz, timeZoneName: 'short' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value ??
    tz
  );
}

/** Human city name from an IANA zone: "America/St_Johns" → "St Johns". */
export const zoneCity = (tz: string) => tz.split('/').pop()!.replace(/_/g, ' ');
