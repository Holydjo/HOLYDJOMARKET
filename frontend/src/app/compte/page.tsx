'use client';

/**
 * Customer area — "Mes demandes".
 * Lists appointment requests with their status, lets the customer cancel a
 * pending one, and leave a review once the provider accepted.
 */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { RequireRole } from '@/components/RequireRole';
import { Alert, Empty, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { APPT_STATUS, dateTime, money } from '@/lib/labels';
import type { Appointment } from '@/lib/types';

export default function AccountPage() {
  return (
    // Providers can also book other pros, so they keep access to their own requests.
    <RequireRole role={['CUSTOMER', 'PROVIDER']}>
      <MyRequests />
    </RequireRole>
  );
}

function MyRequests() {
  const { user } = useAuth();
  const [items, setItems] = useState<Appointment[] | null>(null);
  const [error, setError] = useState('');
  const load = () => api.get<Appointment[]>('/appointments/mine').then(setItems).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function cancel(id: string) {
    if (!confirm('Annuler cette demande ?')) return;
    await api.patch(`/appointments/${id}`, { status: 'CANCELLED' }).catch((e) => setError(e.message));
    load();
  }

  return (
    <div className="container-x max-w-3xl py-8">
      <h1 className="h-display text-3xl font-extrabold">{user?.role === 'PROVIDER' ? 'Mes réservations' : 'Mes demandes'}</h1>
      <p className="mt-1 text-sm text-muted">
        {user?.role === 'PROVIDER'
          ? 'Les rendez-vous que vous avez demandés à d’autres pros, en tant que client·e. Les demandes reçues de vos clients sont dans votre tableau de bord.'
          : `Bonjour ${user?.firstName}, retrouvez ici vos demandes de rendez-vous.`}
      </p>
      {error && <div className="mt-4"><Alert>{error}</Alert></div>}
      <div className="mt-6 space-y-3">
        {!items && <Spinner />}
        {items?.length === 0 && (
          <Empty icon="📅" title="Aucune demande pour l’instant">
            <Link href="/recherche" className="btn-primary mt-3">Trouver un pro</Link>
          </Empty>
        )}
        {items?.map((a) => (
          <div key={a.id} className="card p-4 md:p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <Link href={`/p/${a.profile.slug}`} className="h-display text-lg font-bold hover:text-primary">{a.profile.displayName}</Link>
                <p className="text-sm text-muted">{a.service ? `${a.service.name} · ${money(a.service.priceCents)}` : 'Service à préciser'}</p>
              </div>
              <span className={`badge ${APPT_STATUS[a.status].tone}`}>{APPT_STATUS[a.status].label}</span>
            </div>
            <p className="mt-3 text-sm font-medium">🗓️ {dateTime(a.requestedAt, a.profile.timeZone)}</p>
            {a.providerNote && <p className="mt-2 rounded-2xl bg-paper p-3 text-sm"><span className="font-semibold">Réponse du pro :</span> {a.providerNote}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {a.status === 'PENDING' && <button onClick={() => cancel(a.id)} className="btn-ghost btn-sm">Annuler</button>}
              {a.status === 'ACCEPTED' && a.profile.phone && <a href={`tel:${a.profile.phone}`} className="btn-ghost btn-sm">📞 Appeler</a>}
            </div>
            {a.status === 'ACCEPTED' && <ReviewBox profileId={a.profileId} />}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Inline 1–5 star review form (one review per provider, can be updated). */
function ReviewBox({ profileId }: { profileId: string }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState('');

  if (state === 'done') return <p className="mt-3 text-sm text-green">Merci pour votre avis ✓</p>;
  if (!open) return <button onClick={() => setOpen(true)} className="mt-3 text-sm font-semibold text-primary">★ Laisser un avis</button>;

  return (
    <form
      className="mt-3 space-y-2 border-t border-line pt-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setState('busy');
        try {
          await api.post('/reviews', { profileId, rating, comment: comment || undefined });
          setState('done');
        } catch (err) {
          setError((err as Error).message);
          setState('idle');
        }
      }}
    >
      <div className="flex gap-1 text-2xl" role="radiogroup" aria-label="Note">
        {[1, 2, 3, 4, 5].map((n) => (
          <button type="button" key={n} onClick={() => setRating(n)} className={n <= rating ? 'text-saffron' : 'text-line'} aria-label={`${n} étoile${n > 1 ? 's' : ''}`}>★</button>
        ))}
      </div>
      <textarea className="input" rows={2} placeholder="Votre expérience (facultatif)" value={comment} onChange={(e) => setComment(e.target.value)} />
      {error && <Alert>{error}</Alert>}
      <button className="btn-dark btn-sm" disabled={state === 'busy'}>Publier l’avis</button>
    </form>
  );
}
