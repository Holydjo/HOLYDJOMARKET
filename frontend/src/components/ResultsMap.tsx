'use client';

/**
 * Map of search results (Leaflet + OpenStreetMap tiles, no API key needed).
 * Loaded with next/dynamic(ssr:false) because Leaflet touches `window`.
 * Markers are custom HTML pills showing the starting price, highlighted when
 * the matching card is hovered in the list.
 */
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import Link from 'next/link';
import { useEffect } from 'react';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { money } from '@/lib/labels';
import type { SearchResponse } from '@/lib/types';

function pin(label: string, active: boolean) {
  return L.divIcon({
    className: '',
    html: `<div style="transform:translate(-50%,-100%);display:inline-block;white-space:nowrap;padding:5px 10px;border-radius:999px;font:700 12px var(--font-body),sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.25);background:${active ? 'var(--primary)' : '#fff'};color:${active ? '#fff' : 'var(--ink)'};border:1px solid ${active ? 'var(--primary)' : 'var(--line)'}">${label}</div>`,
    iconSize: [0, 0],
  });
}

/**
 * Re-fit the map whenever the result set changes, and whenever its container
 * is resized — on mobile the map starts hidden (list view) and Leaflet must
 * recompute its size once the "Carte" toggle reveals it.
 */
function FitBounds({ data }: { data: SearchResponse }) {
  const map = useMap();
  useEffect(() => {
    const fit = () => {
      map.invalidateSize();
      const pts: [number, number][] = data.results.map((r) => [r.latitude, r.longitude]);
      if (data.center) pts.push([data.center.lat, data.center.lng]);
      if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.15), { maxZoom: 14 });
    };
    fit();
    const ro = new ResizeObserver(() => {
      if (map.getContainer().clientWidth > 0) fit();
    });
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [data, map]);
  return null;
}

export default function ResultsMap({ data, activeId }: { data: SearchResponse; activeId: string | null }) {
  const start: [number, number] = data.center ? [data.center.lat, data.center.lng] : [45.52, -73.6];
  return (
    <MapContainer center={start} zoom={12} scrollWheelZoom className="h-full w-full">
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FitBounds data={data} />
      {data.center && (
        <Circle center={[data.center.lat, data.center.lng]} radius={data.radiusKm * 1000} pathOptions={{ color: '#c8502a', weight: 1, fillOpacity: 0.05 }} />
      )}
      {data.results.map((r) => (
        <Marker
          key={r.id}
          position={[r.latitude, r.longitude]}
          icon={pin(r.priceFromCents != null ? money(r.priceFromCents) : '•', r.id === activeId)}
          zIndexOffset={r.id === activeId ? 1000 : 0}
        >
          <Popup>
            <Link href={`/p/${r.slug}`} className="font-semibold">{r.displayName}</Link>
            <br />
            {r.neighbourhood ?? r.city}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
