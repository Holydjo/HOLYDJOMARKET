import Link from 'next/link';
import { KIND_LABEL, MODE_LABEL, MODES, money } from '@/lib/labels';
import type { SearchResult } from '@/lib/types';
import { Cover, Stars } from './ui';

/**
 * Listing card used in results and on the home page.
 * Shows up to 3 services with their price (those matching the search first),
 * so a customer searching "Ménage" sees the cleaning service even when the
 * profile's name is about something else.
 */
export function ProviderCard({ p, active, onHover }: { p: SearchResult; active?: boolean; onHover?: (id: string | null) => void }) {
  const modes = MODES.filter((m) => p.modes[m]);
  return (
    <Link
      href={`/p/${p.slug}`}
      onMouseEnter={() => onHover?.(p.id)}
      onMouseLeave={() => onHover?.(null)}
      className={`card group flex gap-4 overflow-hidden p-3 transition hover:-translate-y-0.5 hover:shadow-[0_14px_40px_-24px_rgba(60,30,10,.5)] sm:flex-col sm:p-0 ${active ? 'ring-2 ring-primary' : ''}`}
    >
      <div className="relative shrink-0">
        <Cover url={p.coverUrl} alt={p.displayName} className="h-28 w-28 rounded-2xl sm:aspect-[4/3] sm:h-auto sm:w-full sm:rounded-none" />
        {p.distanceKm != null && (
          <span className="badge absolute left-2 top-2 bg-card/95 text-ink shadow-sm">{p.distanceKm < 1 ? '< 1' : p.distanceKm} km</span>
        )}
      </div>
      <div className="min-w-0 flex-1 sm:p-4 sm:pt-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="h-display truncate text-[17px] font-bold leading-tight">{p.displayName}</h3>
          <Stars value={p.ratingAvg} count={p.ratingCount} />
        </div>
        <p className="mt-0.5 truncate text-xs text-muted">
          {KIND_LABEL[p.kind]} · {p.neighbourhood ?? p.city}
        </p>
        {p.tagline && <p className="mt-1.5 line-clamp-1 text-sm text-ink/80">{p.tagline}</p>}

        {p.services.length > 0 && (
          <ul className="mt-2.5 space-y-1" aria-label="Services">
            {p.services.map((s, i) => (
              // On phones only the first 2 fit comfortably; the 3rd appears from the sm breakpoint.
              <li key={`${s.name}-${i}`} className={`flex items-baseline gap-2 text-sm ${i === 2 ? 'hidden sm:flex' : ''}`}>
                <span aria-hidden className="shrink-0 text-xs">{s.icon}</span>
                <span className="min-w-0 flex-1 truncate">{s.name}</span>
                <span className="shrink-0 font-semibold">
                  {s.priceFrom && <span className="text-xs font-normal text-muted">dès </span>}
                  {money(s.priceCents)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {p.moreServices + (p.services.length > 2 ? 1 : 0) > 0 && (
          <p className="mt-1 text-xs text-muted">
            {/* phones hide the 3rd service, so it counts as "other" there */}
            <span className="sm:hidden">+ {p.moreServices + (p.services.length > 2 ? 1 : 0)} autre{p.moreServices + (p.services.length > 2 ? 1 : 0) > 1 ? 's' : ''} service{p.moreServices + (p.services.length > 2 ? 1 : 0) > 1 ? 's' : ''}</span>
            {p.moreServices > 0 && <span className="hidden sm:inline">+ {p.moreServices} autre{p.moreServices > 1 ? 's' : ''} service{p.moreServices > 1 ? 's' : ''}</span>}
          </p>
        )}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {p.comesToYou && <span className="badge bg-green-soft text-green">🚗 Vient chez vous</span>}
          {modes.filter((m) => !(m === 'travels' && p.comesToYou)).slice(0, 2).map((m) => (
            <span key={m} className="badge bg-paper text-muted">{MODE_LABEL[m].icon} {MODE_LABEL[m].short}</span>
          ))}
        </div>
      </div>
    </Link>
  );
}
