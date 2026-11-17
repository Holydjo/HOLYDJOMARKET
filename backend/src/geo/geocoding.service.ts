import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PLACES } from '../common/places';

export interface GeoResult {
  label: string; // what we show: "Rue Masson, Rosemont, Montréal"
  name: string; // main part: street + number, district or city
  neighbourhood: string | null;
  city: string | null;
  lat: number;
  lng: number;
  kind: 'address' | 'street' | 'district' | 'city' | 'other';
}

/**
 * Address / neighbourhood search ("geocoding").
 *
 * Uses Photon (https://photon.komoot.io), a free OpenStreetMap geocoder with
 * no API key. Results are biased towards the service area (GEO_BIAS_LAT/LNG,
 * default Montréal), limited to Canada, and cached in memory for 24 h.
 * To use another provider (Mapbox, Google…), only this file changes.
 *
 * Fair use: the API rate-limits /places/search and the website waits until
 * the user stops typing before calling it. For high traffic, self-host Photon
 * or switch to a paid provider.
 */
@Injectable()
export class GeocodingService {
  private readonly log = new Logger('Geocoding');
  private readonly url: string;
  private readonly bias: { lat: number; lng: number };
  private readonly cache = new Map<string, { at: number; results: GeoResult[] }>();

  constructor(config: ConfigService) {
    this.url = config.get('GEOCODER_URL', 'https://photon.komoot.io/api/');
    this.bias = { lat: Number(config.get('GEO_BIAS_LAT', 45.52)), lng: Number(config.get('GEO_BIAS_LNG', -73.6)) };
  }

  /** Suggestions while typing. Known neighbourhoods come first, then OpenStreetMap results. */
  async search(query: string, limit = 6): Promise<GeoResult[]> {
    const q = query.trim();
    if (q.length < 2) return [];
    const local = this.localMatches(q);
    const remote = q.length >= 3 ? await this.photon(q, limit) : [];
    // De-duplicate: OpenStreetMap often returns the same place several times
    // (city boundary + city node, both sides of a street…). Keep the first label.
    const seen = new Set<string>();
    return [...local, ...remote]
      .filter((r) => {
        const k = norm(r.label);
        return seen.has(k) ? false : (seen.add(k), true);
      })
      .slice(0, limit);
  }

  /** Best single match (used when a search URL contains free text instead of coordinates). */
  async resolve(query: string): Promise<GeoResult | null> {
    return (await this.search(query, 1))[0] ?? null;
  }

  private localMatches(q: string): GeoResult[] {
    const n = norm(q);
    return PLACES.filter((p) => norm(p.name).includes(n) || norm(p.city) === n).map((p) => ({
      label: p.name === p.city ? p.city : `${p.name}, ${p.city}`,
      name: p.name,
      neighbourhood: p.name === p.city ? null : p.name,
      city: p.city,
      lat: p.lat,
      lng: p.lng,
      kind: p.name === p.city ? 'city' : 'district',
    }));
  }

  private async photon(q: string, limit: number): Promise<GeoResult[]> {
    const key = `${norm(q)}|${limit}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < 24 * 3600_000) return hit.results;

    const params = new URLSearchParams({
      q,
      lat: String(this.bias.lat),
      lon: String(this.bias.lng),
      zoom: '11',
      location_bias_scale: '0.6',
      limit: String(limit + 4), // a few extra: some are filtered out below
      lang: 'fr',
    });
    try {
      const res = await fetch(`${this.url}?${params}`, {
        headers: { 'User-Agent': 'HOLYDJO-MARKET/1.0 (local services marketplace)' },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { features: PhotonFeature[] };
      const results = body.features
        .filter((f) => f.properties.countrycode === 'CA')
        .map(toResult)
        .slice(0, limit);
      if (this.cache.size > 1000) this.cache.clear(); // crude cap, enough for one server
      this.cache.set(key, { at: Date.now(), results });
      return results;
    } catch (e) {
      // The geocoder being down must never break search: fall back to the local list.
      this.log.warn(`Photon unavailable (${(e as Error).message})`);
      return [];
    }
  }
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string; housenumber?: string; street?: string; district?: string; locality?: string;
    city?: string; county?: string; state?: string; countrycode?: string; type?: string;
  };
}

function toResult(f: PhotonFeature): GeoResult {
  const p = f.properties;
  const [lng, lat] = f.geometry.coordinates;
  const street = p.street ? [p.housenumber, p.street].filter(Boolean).join(' ') : null;
  const name = p.type === 'house' && street ? street : p.name ?? street ?? p.city ?? '';
  const neighbourhood = p.district ?? p.locality ?? (p.type === 'district' ? p.name ?? null : null);
  const city = p.city ?? (p.type === 'city' ? p.name ?? null : p.county ?? null);
  const kind: GeoResult['kind'] =
    p.type === 'house' ? 'address' : p.type === 'street' ? 'street' : p.type === 'district' || p.type === 'locality' ? 'district' : p.type === 'city' ? 'city' : 'other';
  const label = [name, neighbourhood !== name ? neighbourhood : null, city !== name ? city : null].filter(Boolean).join(', ');
  return { label, name, neighbourhood: neighbourhood ?? null, city, lat, lng, kind };
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
