'use client';

/** Appointment requests received by the provider: accept / decline with an optional note. */
import { useEffect, useState } from 'react';
import { Alert, Empty, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { APPT_STATUS, dateTime, money } from '@/lib/labels';
import type { Appointment } from '@/lib/types';

export function Requests() {
  const [items, setItems] = useState<Appointment[] | null>(null);
  const [error, setError] = useState('');
  const load = () => api.get<Appointment[]>('/appointments/received').then(setItems).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function answer(a: Appointment, status: 'ACCEPTED' | 'DECLINED') {
    const providerNote = prompt(status === 'ACCEPTED' ? 'Un mot pour le client ? (facultatif)' : 'Raison ou autre créneau proposé ? (facultatif)') ?? undefined;
    try {
      await api.patch(`/appointments/${a.id}`, { status, providerNote: providerNote || undefined });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!items) return <Spinner />;
  const pending = items.filter((a) => a.status === 'PENDING');
  const others = items.filter((a) => a.status !== 'PENDING');

  return (
    <div className="space-y-4">
      <h2 className="h-display text-xl font-bold">Demandes de rendez-vous {pending.length > 0 && <span className="badge ml-1 bg-primary text-white">{pending.length}</span>}</h2>
      {error && <Alert>{error}</Alert>}
      {items.length === 0 && <Empty icon="📭" title="Pas encore de demande">Elles apparaîtront ici dès qu’un client vous contacte.</Empty>}
      {[...pending, ...others].map((a) => (
        <div key={a.id} className={`card p-4 md:p-5 ${a.status === 'PENDING' ? 'border-primary/40' : ''}`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold">{a.customer.firstName} {a.customer.lastName}</p>
              <p className="text-sm text-muted">{a.service ? `${a.service.name} · ${money(a.service.priceCents)}` : 'Service à préciser'}</p>
            </div>
            <span className={`badge ${APPT_STATUS[a.status].tone}`}>{APPT_STATUS[a.status].label}</span>
          </div>
          <p className="mt-3 text-sm font-medium">🗓️ {dateTime(a.requestedAt)}</p>
          {a.location && <p className="mt-1 text-sm">📍 {a.location}</p>}
          {a.message && <p className="mt-2 rounded-2xl bg-paper p-3 text-sm">“{a.message}”</p>}
          {a.status === 'ACCEPTED' && (
            <p className="mt-2 text-sm text-muted">
              Contact : <a className="font-medium text-ink" href={`mailto:${a.customer.email}`}>{a.customer.email}</a>
              {a.customer.phone && <> · <a className="font-medium text-ink" href={`tel:${a.customer.phone}`}>{a.customer.phone}</a></>}
            </p>
          )}
          {a.status === 'PENDING' && (
            <div className="mt-3 flex gap-2">
              <button onClick={() => answer(a, 'ACCEPTED')} className="btn btn-sm bg-green text-white">Accepter</button>
              <button onClick={() => answer(a, 'DECLINED')} className="btn-ghost btn-sm">Refuser</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
