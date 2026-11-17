'use client';

/**
 * Create / edit the provider profile: identity, contact, location and
 * "where the service happens". Location comes from the neighbourhood list
 * (fills coordinates automatically) or the device GPS.
 */
import { useState } from 'react';
import { Alert } from '@/components/ui';
import { api } from '@/lib/api';
import { getPosition, usePlaces } from '@/lib/hooks';
import { MODE_LABEL, MODES } from '@/lib/labels';
import type { Mode, ProviderKind, ProviderProfile } from '@/lib/types';

export function ProfileForm({ profile, onSaved }: { profile: ProviderProfile | null; onSaved: () => void }) {
  const places = usePlaces();
  const [f, setF] = useState({
    kind: (profile?.kind ?? 'INDEPENDENT') as ProviderKind,
    displayName: profile?.displayName ?? '',
    tagline: profile?.tagline ?? '',
    description: profile?.description ?? '',
    phone: profile?.phone ?? '',
    whatsapp: profile?.whatsapp ?? '',
    address: profile?.address ?? '',
    neighbourhood: profile?.neighbourhood ?? '',
    city: profile?.city ?? '',
    latitude: profile?.latitude as number | undefined,
    longitude: profile?.longitude as number | undefined,
    atHome: profile?.atHome ?? false,
    inSalon: profile?.inSalon ?? false,
    inShop: profile?.inShop ?? false,
    travels: profile?.travels ?? false,
    travelRadiusKm: profile?.travelRadiusKm || 10,
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  function pickPlace(name: string) {
    const p = places.find((x) => x.name === name);
    setF((s) => ({ ...s, neighbourhood: name, ...(p ? { city: p.city, latitude: p.lat, longitude: p.lng } : {}) }));
  }

  async function useGps() {
    try {
      const c = await getPosition();
      setF((s) => ({ ...s, latitude: c.lat, longitude: c.lng }));
      setMsg({ tone: 'success', text: 'Position enregistrée. Précisez aussi votre quartier et votre ville pour l’affichage.' });
    } catch (e) {
      setMsg({ tone: 'error', text: (e as Error).message });
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (f.latitude == null) return setMsg({ tone: 'error', text: 'Choisissez votre quartier dans la liste ou utilisez votre position.' });
    if (!MODES.some((m) => f[m])) return setMsg({ tone: 'error', text: 'Indiquez au moins un lieu de prestation.' });
    const sensitive = profile?.status === 'APPROVED' && (f.displayName !== profile.displayName || f.kind !== profile.kind);
    if (sensitive && !confirm('Changer le nom ou le type renverra votre profil en validation (il sera masqué en attendant). Continuer ?')) return;
    setBusy(true);
    try {
      await api.put('/me/profile', { ...f, travelRadiusKm: f.travels ? Number(f.travelRadiusKm) : 0 });
      setMsg({ tone: 'success', text: 'Profil enregistré ✓' });
      onSaved();
    } catch (err) {
      setMsg({ tone: 'error', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="card space-y-4 p-5 md:p-6">
        <h2 className="h-display text-lg font-bold">Qui êtes-vous ?</h2>
        <div className="grid grid-cols-2 gap-2">
          {([['INDEPENDENT', '🧑🏾', 'Indépendant·e', 'Je travaille à mon compte'], ['BUSINESS', '🏬', 'Entreprise', 'Salon, boutique, société']] as const).map(([k, icon, t, d]) => (
            <label key={k} className={`cursor-pointer rounded-2xl border p-3 ${f.kind === k ? 'border-ink ring-1 ring-ink' : 'border-line'}`}>
              <input type="radio" className="sr-only" checked={f.kind === k} onChange={() => set('kind', k)} />
              <span className="text-xl">{icon}</span>
              <span className="mt-1 block text-sm font-semibold">{t}</span>
              <span className="block text-xs text-muted">{d}</span>
            </label>
          ))}
        </div>
        <div>
          <label className="label" htmlFor="dn">Nom affiché</label>
          <input id="dn" required minLength={2} maxLength={80} className="input" placeholder="ex. Tresses by Awa, Salon Kalinda" value={f.displayName} onChange={(e) => set('displayName', e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="tl">Phrase d’accroche</label>
          <input id="tl" maxLength={120} className="input" placeholder="Ce qui vous rend unique, en une ligne" value={f.tagline} onChange={(e) => set('tagline', e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="ds">Description</label>
          <textarea id="ds" rows={5} maxLength={2000} className="input" placeholder="Votre expérience, votre façon de travailler, vos spécialités…" value={f.description} onChange={(e) => set('description', e.target.value)} />
          <p className="hint">{f.description.length}/2000 — 30 caractères minimum pour publier.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="tel">Téléphone</label><input id="tel" type="tel" className="input" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></div>
          <div><label className="label" htmlFor="wa">WhatsApp <span className="text-muted">(facultatif)</span></label><input id="wa" type="tel" className="input" value={f.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} /></div>
        </div>
      </div>

      <div className="card space-y-4 p-5 md:p-6">
        <h2 className="h-display text-lg font-bold">Où êtes-vous ?</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="nb">Quartier</label>
            <select id="nb" className="input" value={places.some((p) => p.name === f.neighbourhood) ? f.neighbourhood : ''} onChange={(e) => pickPlace(e.target.value)}>
              <option value="">Choisir…</option>
              {places.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="ct">Ville</label>
            <input id="ct" required className="input" value={f.city} onChange={(e) => set('city', e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="ad">Adresse <span className="text-muted">(affichée seulement si vous recevez des clients)</span></label>
          <input id="ad" className="input" value={f.address} onChange={(e) => set('address', e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <button type="button" onClick={useGps} className="btn-ghost btn-sm">◎ Utiliser ma position exacte</button>
          {f.latitude != null && <span className="text-xs text-green">✓ Localisation définie</span>}
        </div>
      </div>

      <div className="card space-y-4 p-5 md:p-6">
        <h2 className="h-display text-lg font-bold">Où se passe la prestation ?</h2>
        <p className="-mt-2 text-sm text-muted">Cochez tout ce qui s’applique.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {MODES.map((m: Mode) => (
            <label key={m} className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 ${f[m] ? 'border-ink bg-paper' : 'border-line'}`}>
              <input type="checkbox" checked={f[m]} onChange={(e) => set(m, e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
              <span className="text-xl">{MODE_LABEL[m].icon}</span>
              <span className="text-sm font-medium">{MODE_LABEL[m].label}</span>
            </label>
          ))}
        </div>
        {f.travels && (
          <div>
            <label className="label" htmlFor="rad">Zone de déplacement : <strong>{f.travelRadiusKm} km</strong></label>
            <input id="rad" type="range" min={1} max={60} value={f.travelRadiusKm} onChange={(e) => set('travelRadiusKm', Number(e.target.value))} className="w-full accent-[var(--primary)]" />
          </div>
        )}
      </div>

      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <button className="btn-primary w-full sm:w-auto" disabled={busy}>{busy ? 'Enregistrement…' : profile ? 'Enregistrer' : 'Continuer →'}</button>
    </form>
  );
}
