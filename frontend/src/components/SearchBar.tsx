'use client';

/**
 * The main "what + where" search used on the home page and results page.
 * Location can be: a suggestion (address, neighbourhood, city — sent as
 * coordinates), free text (the API geocodes it), or the device position.
 */
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { getPosition, useCategories } from '@/lib/hooks';
import { PlaceInput } from './PlaceInput';

export interface SearchValue {
  category?: string;
  place?: string;
  label?: string;
  lat?: number;
  lng?: number;
}

export function toQuery(v: SearchValue & Record<string, string | number | undefined>) {
  const qs = new URLSearchParams();
  Object.entries(v).forEach(([k, val]) => val !== undefined && val !== '' && qs.set(k, String(val)));
  return qs.toString();
}

export function SearchBar({ initial = {}, compact = false }: { initial?: SearchValue; compact?: boolean }) {
  const router = useRouter();
  const cats = useCategories();
  const whereId = useId();
  const [category, setCategory] = useState(initial.category ?? '');
  const [place, setPlace] = useState(initial.place ?? initial.label ?? (initial.lat ? 'Autour de moi' : ''));
  // Coordinates of the picked suggestion / GPS; cleared as soon as the user edits the text.
  const [coords, setCoords] = useState(initial.lat && initial.lng ? { lat: initial.lat, lng: initial.lng } : null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');

  async function locate() {
    setError('');
    setLocating(true);
    try {
      const c = await getPosition();
      setCoords(c);
      setPlace('Autour de moi');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLocating(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = coords
      ? { category, lat: coords.lat, lng: coords.lng, label: place === 'Autour de moi' ? undefined : place }
      : { category, place };
    router.push(`/recherche?${toQuery(q)}`);
  }

  return (
    <form onSubmit={submit} className={`card grid gap-2 p-2 shadow-[0_10px_40px_-20px_rgba(60,30,10,.35)] ${compact ? 'md:grid-cols-[1fr_1.3fr_auto]' : 'md:grid-cols-[1fr_1.4fr_auto] md:p-2.5'}`}>
      <label className="flex items-center gap-3 rounded-2xl px-4 py-2.5 hover:bg-paper">
        <span className="text-lg" aria-hidden>🔎</span>
        <span className="flex-1">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted">Service</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-transparent text-[15px] font-medium outline-none">
            <option value="">Tous les services</option>
            {cats.map((c) => (
              <option key={c.slug} value={c.slug}>{c.icon} {c.name}</option>
            ))}
          </select>
        </span>
      </label>

      <div className="flex items-center gap-3 rounded-2xl px-4 py-2.5 hover:bg-paper md:border-l md:border-line">
        <span className="text-lg" aria-hidden>📍</span>
        <div className="min-w-0 flex-1">
          <label htmlFor={whereId} className="block text-[11px] font-semibold uppercase tracking-wide text-muted">Où ?</label>
          <PlaceInput
            id={whereId}
            value={place}
            onChange={(t) => {
              setPlace(t);
              setCoords(null);
            }}
            onPick={(r) => {
              setPlace(r.label);
              setCoords({ lat: r.lat, lng: r.lng });
            }}
            placeholder="Adresse, quartier ou ville"
            className="w-full bg-transparent text-[15px] font-medium outline-none placeholder:font-normal placeholder:text-muted/70"
          />
        </div>
        <button type="button" onClick={locate} className="chip shrink-0 hover:border-ink" disabled={locating}>
          {locating ? '…' : '◎'} <span className="hidden sm:inline">Autour de moi</span>
        </button>
      </div>

      <button className="btn-primary h-full min-h-12 md:px-7">Rechercher</button>
      {error && <p className="px-4 pb-1 text-xs text-danger md:col-span-3">{error}</p>}
    </form>
  );
}
