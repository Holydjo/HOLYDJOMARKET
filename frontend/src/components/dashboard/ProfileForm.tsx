'use client';

/**
 * Create / edit the provider profile: identity, contact, location and
 * "where the service happens". Location comes from the address autocomplete
 * (fills neighbourhood, city and coordinates), the device GPS, or — if the
 * provider types without picking — the API geocodes the text on save.
 */
import { useState } from 'react';
import { Alert } from '@/components/ui';
import { api } from '@/lib/api';
import { PlaceInput } from '@/components/PlaceInput';
import { getPosition } from '@/lib/hooks';
import { MODE_LABEL, MODES } from '@/lib/labels';
import type { Mode, ProviderKind, ProviderProfile } from '@/lib/types';

export function ProfileForm({ profile, onSaved }: { profile: ProviderProfile | null; onSaved: () => void }) {
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

  /** Typing in a location field invalidates the saved coordinates (the API will geocode the text). */
  const editLocation = (k: 'address' | 'neighbourhood' | 'city', v: string) =>
    setF((s) => ({ ...s, [k]: v, latitude: undefined, longitude: undefined }));

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
    if (f.latitude == null && !f.address.trim() && !f.neighbourhood.trim()) {
      return setMsg({ tone: 'error', text: 'Indiquez votre adresse ou votre quartier, ou utilisez votre position.' });
    }
    if (!MODES.some((m) => f[m])) return setMsg({ tone: 'error', text: 'Indiquez au moins un lieu de prestation.' });
    const sensitive = profile?.status === 'APPROVED' && (f.displayName !== profile.displayName || f.kind !== profile.kind);
    if (sensitive && !confirm('Changer le nom ou le type renverra votre profil en validation (il sera masqué en attendant). Continuer ?')) return;
    setBusy(true);
    try {
      const saved = await api.put<ProviderProfile>('/me/profile', { ...f, travelRadiusKm: f.travels ? Number(f.travelRadiusKm) : 0 });
      // Keep the coordinates the API resolved, so the next save doesn't geocode again.
      // Also show the phone numbers as the API normalised them (514-555-1234).
      setF((s) => ({ ...s, latitude: saved.latitude, longitude: saved.longitude, city: saved.city, phone: saved.phone ?? '', whatsapp: saved.whatsapp ?? '' }));
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
          <div><label className="label" htmlFor="tel">Téléphone</label><input id="tel" type="tel" inputMode="tel" className="input" placeholder="514-555-1234" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></div>
          <div><label className="label" htmlFor="wa">WhatsApp <span className="text-muted">(facultatif)</span></label><input id="wa" type="tel" inputMode="tel" className="input" placeholder="514-555-1234" value={f.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} /></div>
        </div>
      </div>

      <div className="card space-y-4 p-5 md:p-6">
        <h2 className="h-display text-lg font-bold">Où êtes-vous ?</h2>
        <div>
          <label className="label" htmlFor="ad">Adresse</label>
          <PlaceInput
            id="ad"
            className="input"
            placeholder="Commencez à taper votre adresse…"
            value={f.address}
            onChange={(v) => editLocation('address', v)}
            near={profile ? { lat: profile.latitude, lng: profile.longitude } : null}
            onPick={(r) =>
              setF((s) => ({
                ...s,
                address: r.kind === 'address' || r.kind === 'street' ? r.name : s.address,
                neighbourhood: r.neighbourhood ?? s.neighbourhood,
                city: r.city ?? s.city,
                latitude: r.lat,
                longitude: r.lng,
              }))
            }
          />
          <p className="hint">Choisissez une suggestion. L’adresse exacte n’est publique que pour un salon ou une boutique. Si vous recevez chez vous, seuls les clients dont vous acceptez le rendez-vous la reçoivent.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="nb">Quartier</label>
            <input id="nb" className="input" value={f.neighbourhood} onChange={(e) => editLocation('neighbourhood', e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="ct">Ville</label>
            <input id="ct" required className="input" value={f.city} onChange={(e) => editLocation('city', e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <button type="button" onClick={useGps} className="btn-ghost btn-sm">◎ Utiliser ma position exacte</button>
          {f.latitude != null ? (
            <span className="text-xs text-green">✓ Position sur la carte définie</span>
          ) : (
            <span className="text-xs text-muted">La position sera calculée à partir de l’adresse à l’enregistrement.</span>
          )}
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
