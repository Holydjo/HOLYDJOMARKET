'use client';

/**
 * Results page — /recherche?category=braids&place=Verdun (or &lat=&lng=)
 * The URL is the single source of truth for filters, so results are
 * shareable and the back button works. Mobile: list with a "Carte" toggle.
 * Desktop: list on the left, sticky map on the right.
 */
import dynamic from 'next/dynamic';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { ProviderCard } from '@/components/ProviderCard';
import { SearchBar, toQuery } from '@/components/SearchBar';
import { Alert, Empty, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { useCategories } from '@/lib/hooks';
import { MODE_LABEL, MODES } from '@/lib/labels';
import type { SearchResponse } from '@/lib/types';

const ResultsMap = dynamic(() => import('@/components/ResultsMap'), { ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-line/40" /> });

export default function SearchPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <Results />
    </Suspense>
  );
}

function Results() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const cats = useCategories();
  // Results are stored with the query they belong to, so a new query
  // shows the spinner without resetting state inside the effect.
  const [res, setRes] = useState<{ qs: string; data?: SearchResponse; error?: string } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'map'>('list');

  const get = (k: string) => params.get(k) ?? undefined;
  const qs = params.toString();

  useEffect(() => {
    api
      .get<SearchResponse>(`/providers/search?${qs}`)
      .then((data) => setRes({ qs, data }))
      .catch((e) => setRes({ qs, error: e.message }));
  }, [qs]);
  const data = res?.qs === qs ? res.data ?? null : null;
  const error = res?.qs === qs ? res.error ?? '' : '';

  /** Update one filter in the URL (undefined removes it). */
  function setFilter(key: string, value?: string) {
    const next = Object.fromEntries(params.entries());
    if (value === undefined || next[key] === value) delete next[key];
    else next[key] = value;
    router.replace(`${pathname}?${toQuery(next)}`, { scroll: false });
  }

  const category = cats.find((c) => c.slug === get('category'));
  const where = data?.center?.label ?? get('place');
  const lat = get('lat'), lng = get('lng');

  return (
    <div className="container-x pt-4 md:pt-6">
      <SearchBar compact initial={{ category: get('category'), place: get('place'), lat: lat ? +lat : undefined, lng: lng ? +lng : undefined }} />

      {/* ---------- filters (horizontal scroll on mobile) ---------- */}
      <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {MODES.map((m) => (
          <button key={m} onClick={() => setFilter('mode', m)} className={`chip ${get('mode') === m ? 'chip-on' : ''}`}>
            {MODE_LABEL[m].icon} {MODE_LABEL[m].label}
          </button>
        ))}
        <span className="mx-1 w-px shrink-0 bg-line" />
        <button onClick={() => setFilter('kind', 'INDEPENDENT')} className={`chip ${get('kind') === 'INDEPENDENT' ? 'chip-on' : ''}`}>Indépendant·e</button>
        <button onClick={() => setFilter('kind', 'BUSINESS')} className={`chip ${get('kind') === 'BUSINESS' ? 'chip-on' : ''}`}>Entreprise</button>
        <span className="mx-1 w-px shrink-0 bg-line" />
        <select aria-label="Prix maximum" value={get('maxPrice') ?? ''} onChange={(e) => setFilter('maxPrice', e.target.value || undefined)} className="chip pr-2 outline-none">
          <option value="">Tous les prix</option>
          {[30, 60, 100, 200].map((p) => <option key={p} value={p}>Jusqu’à {p} $</option>)}
        </select>
        {data?.center && (
          <select aria-label="Rayon" value={get('radiusKm') ?? '15'} onChange={(e) => setFilter('radiusKm', e.target.value)} className="chip pr-2 outline-none">
            {[3, 5, 10, 15, 25, 50].map((r) => <option key={r} value={r}>{r} km</option>)}
          </select>
        )}
        <select aria-label="Trier" value={get('sort') ?? ''} onChange={(e) => setFilter('sort', e.target.value || undefined)} className="chip pr-2 outline-none">
          <option value="">{data?.center ? 'Plus proches' : 'Mieux notés'}</option>
          {data?.center && <option value="rating">Mieux notés</option>}
          <option value="price">Prix croissant</option>
        </select>
      </div>

      {/* ---------- header line ---------- */}
      <div className="mt-5 flex items-end justify-between gap-3">
        <h1 className="h-display text-xl font-bold md:text-2xl">
          {category ? `${category.icon} ${category.name}` : 'Tous les services'}
          {where && <span className="text-muted"> · {where}</span>}
        </h1>
        {data && <p className="shrink-0 text-sm text-muted">{data.total} résultat{data.total > 1 ? 's' : ''}</p>}
      </div>
      {get('place') && data && !data.center && (
        <p className="mt-1 text-xs text-muted">Quartier non reconnu : recherche par nom de ville. Activez « Autour de moi » pour trier par distance.</p>
      )}

      {error && <div className="mt-4"><Alert>{error}</Alert></div>}

      <div className="mt-4 grid gap-6 md:grid-cols-[1fr_minmax(320px,42%)]">
        {/* list */}
        <div className={view === 'map' ? 'hidden md:block' : ''}>
          {!data && !error && <Spinner label="Recherche des pros près de vous…" />}
          {data && data.results.length === 0 && (
            <Empty icon="🧭" title="Aucun pro trouvé ici… pour l’instant">
              Essayez un rayon plus large, un autre quartier, ou retirez un filtre.
            </Empty>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {data?.results.map((p) => <ProviderCard key={p.id} p={p} active={p.id === activeId} onHover={setActiveId} />)}
          </div>
        </div>
        {/* map */}
        <div className={`${view === 'list' ? 'hidden md:block' : ''} h-[calc(100dvh-14rem)] overflow-hidden rounded-3xl border border-line md:sticky md:top-20 md:h-[calc(100dvh-7rem)]`}>
          {data && <ResultsMap data={data} activeId={activeId} />}
        </div>
      </div>

      {/* floating list/map toggle (mobile only) */}
      <button
        onClick={() => setView(view === 'list' ? 'map' : 'list')}
        className="btn-dark fixed bottom-20 left-1/2 z-30 -translate-x-1/2 shadow-lg md:hidden"
      >
        {view === 'list' ? '🗺️ Carte' : '☰ Liste'}
      </button>
    </div>
  );
}
