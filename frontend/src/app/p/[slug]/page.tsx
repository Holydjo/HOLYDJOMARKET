'use client';

/**
 * Public provider profile — /p/<slug>
 * Gallery, about, services & prices, where the service happens, opening hours,
 * reviews, and a sticky "request an appointment" panel (bottom sheet on mobile).
 */
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { BookingForm } from '@/components/BookingForm';
import { Alert, Cover, Spinner, Stars } from '@/components/ui';
import { api } from '@/lib/api';
import { KIND_LABEL, MODE_LABEL, MODES, PROFILE_STATUS, WEEK_ORDER, WEEKDAYS, duration, money } from '@/lib/labels';
import type { ProviderProfile } from '@/lib/types';

export default function ProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const { user, loading: authLoading } = useAuth();
  const [p, setP] = useState<ProviderProfile | null>(null);
  const [error, setError] = useState('');
  const [photoIdx, setPhotoIdx] = useState(0);
  const [sheet, setSheet] = useState(false);
  const [preselect, setPreselect] = useState<string>('');

  // Wait for auth so owners/admins can see their non-public profile (preview).
  useEffect(() => {
    if (authLoading) return;
    api.get<ProviderProfile>(`/providers/${slug}`).then(setP).catch((e) => setError(e.message));
  }, [slug, authLoading]);

  const openNow = useMemo(() => (p ? isOpenNow(p) : false), [p]);

  if (error) return <div className="container-x py-16"><Alert>{error}</Alert></div>;
  if (!p) return <Spinner />;

  const modes = MODES.filter((m) => p[m]);
  const book = (serviceId = '') => {
    setPreselect(serviceId);
    setSheet(true);
    document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const wa = p.whatsapp?.replace(/\D/g, '');

  return (
    <div className="container-x pt-4 md:pt-8">
      {p.isPreview && (
        <div className="mb-4">
          <Alert tone="info">
            <strong>Aperçu</strong> — ce profil n’est pas encore public ({PROFILE_STATUS[p.status].label.toLowerCase()}).
          </Alert>
        </div>
      )}

      {/* ---------- gallery ---------- */}
      <div className="grid gap-2 md:grid-cols-[2fr_1fr]">
        <Cover url={p.photos[photoIdx]?.url} alt={p.displayName} className="aspect-[4/3] w-full rounded-3xl md:aspect-[16/10]" />
        <div className="hidden grid-rows-2 gap-2 md:grid">
          {p.photos.slice(1, 3).map((ph) => (
            <Cover key={ph.id} url={ph.url} alt="" className="h-full w-full rounded-3xl" />
          ))}
        </div>
      </div>
      {p.photos.length > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto">
          {p.photos.map((ph, i) => (
            <button key={ph.id} onClick={() => setPhotoIdx(i)} className={`shrink-0 overflow-hidden rounded-xl ring-2 ${i === photoIdx ? 'ring-primary' : 'ring-transparent'}`} aria-label={`Photo ${i + 1}`}>
              <Cover url={ph.url} alt="" className="h-14 w-20" />
            </button>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0">
          {/* ---------- header ---------- */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="badge bg-ink text-white">{KIND_LABEL[p.kind]}</span>
            {p.status === 'APPROVED' && <span className="badge bg-green-soft text-green">✓ Profil vérifié</span>}
            <span className={`badge ${openNow ? 'bg-green-soft text-green' : 'bg-line text-muted'}`}>{openNow ? '● Ouvert maintenant' : 'Fermé actuellement'}</span>
          </div>
          <h1 className="h-display mt-3 text-3xl font-extrabold leading-tight md:text-5xl">{p.displayName}</h1>
          {p.tagline && <p className="mt-2 text-lg text-muted">{p.tagline}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <Stars value={p.ratingAvg} count={p.ratingCount} size="lg" />
            <span>📍 {[p.neighbourhood, p.city].filter(Boolean).join(', ')}</span>
          </div>

          {/* ---------- where ---------- */}
          <section className="mt-8">
            <h2 className="h-display text-xl font-bold">Où se passe la prestation</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {modes.map((m) => (
                <div key={m} className="card flex items-center gap-3 p-4">
                  <span className="text-2xl">{MODE_LABEL[m].icon}</span>
                  <div>
                    <p className="font-semibold">{MODE_LABEL[m].label}</p>
                    <p className="text-xs text-muted">
                      {m === 'travels'
                        ? `Jusqu’à ${p.travelRadiusKm} km autour de ${p.neighbourhood ?? p.city}`
                        : m === 'atHome' && !(p.inSalon || p.inShop)
                          ? `${p.neighbourhood ?? p.city} — adresse exacte communiquée après confirmation`
                          : p.address ?? `${p.neighbourhood ?? ''} ${p.city}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ---------- about ---------- */}
          {p.description && (
            <section className="mt-8">
              <h2 className="h-display text-xl font-bold">À propos</h2>
              <p className="mt-2 whitespace-pre-line leading-relaxed text-ink/85">{p.description}</p>
            </section>
          )}

          {/* ---------- services ---------- */}
          <section className="mt-8">
            <h2 className="h-display text-xl font-bold">Services et tarifs</h2>
            <ul className="card mt-3 divide-y divide-line">
              {p.services.map((s) => (
                <li key={s.id} className="flex items-center gap-4 p-4">
                  <span className="text-xl" aria-hidden>{s.category.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{s.name}</p>
                    <p className="text-xs text-muted">{[s.category.name, duration(s.durationMin)].filter(Boolean).join(' · ')}</p>
                    {s.description && <p className="mt-1 text-sm text-muted">{s.description}</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{s.priceFrom && <span className="text-xs font-normal text-muted">dès </span>}{money(s.priceCents)}</p>
                    {!p.isPreview && <button onClick={() => book(s.id)} className="text-xs font-semibold text-primary">Réserver</button>}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* ---------- hours ---------- */}
          <section className="mt-8">
            <h2 className="h-display text-xl font-bold">Horaires</h2>
            <ul className="card mt-3 divide-y divide-line text-sm">
              {WEEK_ORDER.map((d) => {
                const h = p.openingHours.find((x) => x.weekday === d);
                const today = new Date().getDay() === d;
                return (
                  <li key={d} className={`flex justify-between px-4 py-2.5 ${today ? 'font-semibold' : ''}`}>
                    <span>{WEEKDAYS[d]}{today && ' (aujourd’hui)'}</span>
                    <span className={!h || h.closed ? 'text-muted' : ''}>{!h || h.closed ? 'Fermé' : `${h.opensAt} – ${h.closesAt}`}</span>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* ---------- reviews ---------- */}
          <section className="mt-8">
            <h2 className="h-display text-xl font-bold">Avis {p.ratingCount > 0 && <span className="text-muted">· ★ {p.ratingAvg.toFixed(1)}</span>}</h2>
            {p.reviews.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Pas encore d’avis. Les clients peuvent en laisser un après un rendez-vous accepté.</p>
            ) : (
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {p.reviews.map((r) => (
                  <li key={r.id} className="card p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{r.author.firstName} {r.author.lastName[0]}.</p>
                      <span className="text-sm text-saffron" aria-label={`${r.rating} sur 5`}>{'★'.repeat(r.rating)}<span className="text-line">{'★'.repeat(5 - r.rating)}</span></span>
                    </div>
                    {r.comment && <p className="mt-2 text-sm text-ink/80">{r.comment}</p>}
                    <p className="mt-2 text-xs text-muted">{new Date(r.createdAt).toLocaleDateString('fr-CA', { month: 'long', year: 'numeric' })}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* ---------- booking panel ---------- */}
        <aside id="booking" className={`${sheet ? 'fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] overflow-y-auto rounded-t-3xl shadow-2xl' : 'hidden'} lg:sticky lg:top-20 lg:block lg:max-h-none lg:self-start lg:rounded-3xl lg:shadow-none`}>
          <div className="card p-5 lg:p-6">
            <div className="flex items-center justify-between">
              <h2 className="h-display text-xl font-bold">Demander un rendez-vous</h2>
              <button onClick={() => setSheet(false)} className="text-2xl leading-none text-muted lg:hidden" aria-label="Fermer">×</button>
            </div>
            {p.isPreview ? (
              <p className="mt-3 text-sm text-muted">Les réservations seront ouvertes après la validation du profil.</p>
            ) : user?.role === 'CUSTOMER' ? (
              <BookingForm profile={p} preselect={preselect} key={preselect} />
            ) : user ? (
              <p className="mt-3 text-sm text-muted">Connectez-vous avec un compte client pour réserver.</p>
            ) : (
              <div className="mt-3 space-y-3 text-sm">
                <p className="text-muted">Créez un compte client gratuit (30 secondes) pour envoyer votre demande.</p>
                <Link href={`/inscription?next=/p/${p.slug}`} className="btn-primary w-full">Créer un compte</Link>
                <Link href={`/connexion?next=/p/${p.slug}`} className="btn-ghost w-full">J’ai un compte</Link>
              </div>
            )}
            {(p.phone || wa) && (
              <div className="mt-5 border-t border-line pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Ou contactez directement</p>
                <div className="flex gap-2">
                  {p.phone && <a href={`tel:${p.phone}`} className="btn-ghost btn-sm flex-1">📞 Appeler</a>}
                  {wa && <a href={`https://wa.me/1${wa.slice(-10)}`} target="_blank" rel="noreferrer" className="btn-ghost btn-sm flex-1">💬 WhatsApp</a>}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* sticky CTA bar on mobile, above the bottom navigation */}
      {!sheet && !p.isPreview && (
        <div className="fixed inset-x-0 bottom-[60px] z-30 border-t border-line bg-card/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm">
              {p.services[0] && <><span className="text-muted">Dès </span><span className="font-bold">{money(Math.min(...p.services.map((s) => s.priceCents)))}</span></>}
            </div>
            <button onClick={() => book()} className="btn-primary flex-1">Demander un rendez-vous</button>
          </div>
        </div>
      )}
      {sheet && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setSheet(false)} />}
    </div>
  );
}

function isOpenNow(p: ProviderProfile) {
  const now = new Date();
  const h = p.openingHours.find((x) => x.weekday === now.getDay());
  if (!h || h.closed || !h.opensAt || !h.closesAt) return false;
  const hhmm = now.toTimeString().slice(0, 5);
  return hhmm >= h.opensAt && hhmm < h.closesAt;
}
