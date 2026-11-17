'use client';

/**
 * Home — the customer entry point.
 * 1. Hero with the "what + where" search.
 * 2. Category tiles (one tap → results).
 * 3. Top-rated pros nearby.
 * 4. How it works, for customers and for providers.
 */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ProviderCard } from '@/components/ProviderCard';
import { SearchBar } from '@/components/SearchBar';
import { api } from '@/lib/api';
import { useCategories } from '@/lib/hooks';
import type { SearchResponse } from '@/lib/types';

export default function Home() {
  const cats = useCategories();
  const [featured, setFeatured] = useState<SearchResponse['results']>([]);

  useEffect(() => {
    api.get<SearchResponse>('/providers/search?sort=rating').then((r) => setFeatured(r.results.slice(0, 6))).catch(() => {});
  }, []);

  return (
    <>
      {/* ---------- HERO ---------- */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-primary-soft blur-2xl md:h-[28rem] md:w-[28rem]" />
        <div aria-hidden className="pointer-events-none absolute -left-20 top-40 h-60 w-60 rounded-full bg-green-soft blur-2xl" />
        <div className="container-x relative pb-10 pt-10 md:pb-16 md:pt-20">
          <p className="chip mb-5 border-primary/30 bg-primary-soft text-primary">✦ Profils vérifiés avant publication</p>
          <h1 className="h-display max-w-3xl text-[40px] font-extrabold leading-[1.02] sm:text-6xl md:text-7xl">
            Les talents de votre quartier, <span className="text-primary">à deux rues de chez vous.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted md:text-lg">
            Tresses, coiffure, esthétique, ménage, petites réparations… Trouvez un pro près de chez vous, comparez les prix et demandez un rendez-vous en quelques secondes.
          </p>
          <div className="mt-8 max-w-4xl">
            <SearchBar />
          </div>
        </div>
      </section>

      {/* ---------- CATEGORIES ---------- */}
      <section className="container-x">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="h-display text-2xl font-bold md:text-3xl">Par service</h2>
          <Link href="/recherche" className="text-sm font-semibold text-primary">Tout voir →</Link>
        </div>
        {/* Horizontal scroll on phones, grid on larger screens */}
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-0">
          {(cats.length ? cats : Array.from({ length: 10 }, () => null)).map((c, i) =>
            c ? (
              <Link
                key={c.slug}
                href={`/recherche?category=${c.slug}`}
                className="card flex min-w-[112px] snap-start flex-col items-start gap-6 p-4 transition hover:-translate-y-0.5 hover:border-ink"
              >
                <span className="text-3xl">{c.icon}</span>
                <span className="text-sm font-semibold">{c.name}</span>
              </Link>
            ) : (
              <div key={i} className="card h-[108px] min-w-[112px] animate-pulse bg-line/40" />
            ),
          )}
        </div>
      </section>

      {/* ---------- FEATURED ---------- */}
      {featured.length > 0 && (
        <section className="container-x mt-14">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="h-display text-2xl font-bold md:text-3xl">Les mieux notés</h2>
              <p className="text-sm text-muted">Recommandés par leurs clients du quartier</p>
            </div>
            <Link href="/recherche?sort=rating" className="text-sm font-semibold text-primary">Voir plus →</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((p) => <ProviderCard key={p.id} p={p} />)}
          </div>
        </section>
      )}

      {/* ---------- HOW IT WORKS ---------- */}
      <section className="container-x mt-16 grid gap-4 md:grid-cols-2">
        <div className="card p-6 md:p-8">
          <p className="badge mb-4 bg-primary-soft text-primary">Pour les clients</p>
          <h2 className="h-display text-2xl font-bold">Trouver, comparer, réserver.</h2>
          <ol className="mt-6 space-y-4">
            {[
              ['Choisissez un service', 'Tresses, ménage, réparation… et votre quartier, ou activez la localisation.'],
              ['Comparez les profils', 'Photos, tarifs, horaires, avis et zone de déplacement.'],
              ['Demandez un rendez-vous', 'Le pro confirme rapidement. Vous pouvez aussi l’appeler ou lui écrire.'],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-4">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-sm font-bold text-white">{i + 1}</span>
                <div>
                  <p className="font-semibold">{t}</p>
                  <p className="text-sm text-muted">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="card relative overflow-hidden border-0 bg-green p-6 text-white md:p-8">
          <div aria-hidden className="absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-white/10" />
          <p className="badge mb-4 bg-white/15 text-white">Pour les prestataires</p>
          <h2 className="h-display text-2xl font-bold">Faites-vous connaître dans votre quartier.</h2>
          <ul className="mt-6 space-y-3 text-sm text-white/85">
            <li>✓ Inscription gratuite, indépendant·e ou entreprise</li>
            <li>✓ Vos services, prix, photos et horaires au même endroit</li>
            <li>✓ À domicile, en salon, en boutique ou en déplacement</li>
            <li>✓ Recevez les demandes de rendez-vous sur votre tableau de bord</li>
          </ul>
          <Link href="/devenir-pro" className="btn mt-8 bg-white text-green hover:bg-paper">Créer mon profil pro →</Link>
        </div>
      </section>
    </>
  );
}
