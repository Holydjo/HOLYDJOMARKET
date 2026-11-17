/**
 * Known neighbourhoods / cities with their approximate centre.
 * Lets customers who don't share their location still search by distance
 * ("Plateau-Mont-Royal" → lat/lng). Extend this list (or plug in a geocoding
 * API such as Mapbox / Google) when opening new cities.
 */
export interface Place {
  name: string; // neighbourhood or city name shown to the user
  city: string;
  lat: number;
  lng: number;
}

export const PLACES: Place[] = [
  { name: 'Montréal (centre-ville)', city: 'Montréal', lat: 45.5019, lng: -73.5674 },
  { name: 'Plateau-Mont-Royal', city: 'Montréal', lat: 45.5225, lng: -73.5810 },
  { name: 'Rosemont–La Petite-Patrie', city: 'Montréal', lat: 45.5440, lng: -73.5900 },
  { name: 'Villeray–Saint-Michel–Parc-Extension', city: 'Montréal', lat: 45.5560, lng: -73.6200 },
  { name: 'Montréal-Nord', city: 'Montréal', lat: 45.5940, lng: -73.6330 },
  { name: 'Saint-Léonard', city: 'Montréal', lat: 45.5870, lng: -73.5970 },
  { name: 'Côte-des-Neiges', city: 'Montréal', lat: 45.4960, lng: -73.6290 },
  { name: 'Notre-Dame-de-Grâce', city: 'Montréal', lat: 45.4730, lng: -73.6150 },
  { name: 'Hochelaga-Maisonneuve', city: 'Montréal', lat: 45.5470, lng: -73.5420 },
  { name: 'Verdun', city: 'Montréal', lat: 45.4560, lng: -73.5710 },
  { name: 'Saint-Laurent', city: 'Montréal', lat: 45.5070, lng: -73.6930 },
  { name: 'Ahuntsic-Cartierville', city: 'Montréal', lat: 45.5560, lng: -73.6670 },
  { name: 'LaSalle', city: 'Montréal', lat: 45.4310, lng: -73.6290 },
  { name: 'Laval', city: 'Laval', lat: 45.5700, lng: -73.7200 },
  { name: 'Longueuil', city: 'Longueuil', lat: 45.5310, lng: -73.5180 },
  { name: 'Brossard', city: 'Brossard', lat: 45.4590, lng: -73.4650 },
];

export function findPlace(query: string): Place | undefined {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;
  return (
    PLACES.find((p) => p.name.toLowerCase() === q) ??
    PLACES.find((p) => p.name.toLowerCase().includes(q)) ??
    PLACES.find((p) => p.city.toLowerCase() === q)
  );
}
