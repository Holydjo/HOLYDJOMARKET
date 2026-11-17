'use client';

/** Appointment request form shown on a provider profile (customers only). */
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { duration, money } from '@/lib/labels';
import type { ProviderProfile } from '@/lib/types';
import { Alert } from './ui';

export function BookingForm({ profile, preselect }: { profile: ProviderProfile; preselect?: string }) {
  const [serviceId, setServiceId] = useState(preselect ?? '');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  // Earliest selectable day = tomorrow (gives the provider time to answer).
  const [min] = useState(() => new Date(Date.now() + 86400_000).toISOString().slice(0, 10));
  const onlyTravels = profile.travels && !profile.atHome && !profile.inSalon && !profile.inShop;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.post('/appointments', {
        profileId: profile.id,
        serviceId: serviceId || undefined,
        requestedAt: new Date(`${date}T${time}`).toISOString(),
        location: location || undefined,
        message: message || undefined,
      });
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done)
    return (
      <div className="mt-4 space-y-3 text-center">
        <div className="text-4xl">🎉</div>
        <p className="font-semibold">Demande envoyée !</p>
        <p className="text-sm text-muted">{profile.displayName} va vous répondre. Suivez le statut dans vos demandes.</p>
        <Link href="/compte" className="btn-dark w-full">Voir mes demandes</Link>
      </div>
    );

  return (
    <form onSubmit={submit} className="mt-4 space-y-3">
      <div>
        <label className="label" htmlFor="svc">Service</label>
        <select id="svc" className="input" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
          <option value="">Je ne sais pas encore</option>
          {profile.services.map((s) => (
            <option key={s.id} value={s.id}>{s.name} — {money(s.priceCents)}{s.durationMin ? ` · ${duration(s.durationMin)}` : ''}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label" htmlFor="d">Date</label>
          <input id="d" type="date" required min={min} className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="t">Heure</label>
          <input id="t" type="time" required step={900} className="input" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>
      {profile.travels && (
        <div>
          <label className="label" htmlFor="loc">Adresse {onlyTravels ? '' : '(si le pro se déplace)'}</label>
          <input id="loc" required={onlyTravels} className="input" placeholder="Rue, ville" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
      )}
      <div>
        <label className="label" htmlFor="msg">Message</label>
        <textarea id="msg" rows={3} className="input" placeholder="Précisez votre demande (longueur, couleur, nombre de pièces…)" value={message} onChange={(e) => setMessage(e.target.value)} />
      </div>
      {error && <Alert>{error}</Alert>}
      <button className="btn-primary w-full" disabled={busy}>{busy ? 'Envoi…' : 'Envoyer la demande'}</button>
      <p className="text-center text-xs text-muted">Gratuit et sans engagement. Le paiement se fait directement avec le pro.</p>
    </form>
  );
}
