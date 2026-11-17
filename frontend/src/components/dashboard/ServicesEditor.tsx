'use client';

/** Add / edit / pause / delete services. Prices are typed in dollars, stored in cents. */
import { useState } from 'react';
import { Alert, Empty } from '@/components/ui';
import { api } from '@/lib/api';
import { useCategories } from '@/lib/hooks';
import { duration, money } from '@/lib/labels';
import type { ProviderProfile, Service } from '@/lib/types';

const blank = { categoryId: '', name: '', description: '', price: '', priceFrom: false, durationMin: '' };

export function ServicesEditor({ profile, onChange }: { profile: ProviderProfile; onChange: () => void }) {
  const cats = useCategories();
  const [editing, setEditing] = useState<string | 'new' | null>(profile.services.length ? null : 'new');
  const [f, setF] = useState(blank);
  const [error, setError] = useState('');

  function edit(s?: Service) {
    setError('');
    setEditing(s?.id ?? 'new');
    setF(s ? { categoryId: s.categoryId, name: s.name, description: s.description ?? '', price: String(s.priceCents / 100), priceFrom: s.priceFrom, durationMin: s.durationMin ? String(s.durationMin) : '' } : blank);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const body = {
      categoryId: f.categoryId,
      name: f.name,
      description: f.description || undefined,
      priceCents: Math.round(parseFloat(f.price.replace(',', '.')) * 100),
      priceFrom: f.priceFrom,
      durationMin: f.durationMin ? Number(f.durationMin) : undefined,
    };
    if (Number.isNaN(body.priceCents)) return setError('Prix invalide');
    try {
      if (editing === 'new') await api.post('/me/profile/services', body);
      else await api.put(`/me/profile/services/${editing}`, body);
      setEditing(null);
      onChange();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function toggle(s: Service) {
    await api.put(`/me/profile/services/${s.id}`, { categoryId: s.categoryId, name: s.name, priceCents: s.priceCents, isActive: !s.isActive });
    onChange();
  }
  async function remove(s: Service) {
    if (!confirm(`Supprimer « ${s.name} » ?`)) return;
    await api.del(`/me/profile/services/${s.id}`);
    onChange();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="h-display text-xl font-bold">Mes services</h2>
        {editing === null && <button onClick={() => edit()} className="btn-primary btn-sm">+ Ajouter</button>}
      </div>

      {editing && (
        <form onSubmit={save} className="card space-y-3 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="cat">Catégorie</label>
              <select id="cat" required className="input" value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}>
                <option value="">Choisir…</option>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="sn">Nom du service</label>
              <input id="sn" required minLength={2} className="input" placeholder="ex. Knotless braids mi-dos" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="pr">Prix ($)</label>
              <input id="pr" required inputMode="decimal" className="input" placeholder="80" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
              <label className="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={f.priceFrom} onChange={(e) => setF({ ...f, priceFrom: e.target.checked })} className="accent-[var(--primary)]" /> Prix « à partir de »</label>
            </div>
            <div>
              <label className="label" htmlFor="du">Durée (min)</label>
              <input id="du" type="number" min={5} step={5} className="input" placeholder="60" value={f.durationMin} onChange={(e) => setF({ ...f, durationMin: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="sd">Détails <span className="text-muted">(facultatif)</span></label>
            <textarea id="sd" rows={2} className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          </div>
          {error && <Alert>{error}</Alert>}
          <div className="flex gap-2">
            <button className="btn-primary btn-sm">Enregistrer</button>
            {profile.services.length > 0 && <button type="button" onClick={() => setEditing(null)} className="btn-ghost btn-sm">Annuler</button>}
          </div>
        </form>
      )}

      {profile.services.length === 0 && !editing && <Empty icon="🏷️" title="Aucun service">Ajoutez ce que vous proposez avec vos prix.</Empty>}
      <ul className="space-y-2">
        {profile.services.map((s) => (
          <li key={s.id} className={`card flex items-center gap-3 p-4 ${s.isActive ? '' : 'opacity-60'}`}>
            <span className="text-xl">{s.category.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{s.name} {!s.isActive && <span className="badge bg-line text-muted">En pause</span>}</p>
              <p className="text-xs text-muted">{s.priceFrom && 'dès '}{money(s.priceCents)}{s.durationMin ? ` · ${duration(s.durationMin)}` : ''} · {s.category.name}</p>
            </div>
            <div className="flex shrink-0 gap-1 text-xs font-semibold">
              <button onClick={() => edit(s)} className="rounded-full px-2 py-1 hover:bg-paper">Modifier</button>
              <button onClick={() => toggle(s)} className="rounded-full px-2 py-1 hover:bg-paper">{s.isActive ? 'Pause' : 'Activer'}</button>
              <button onClick={() => remove(s)} className="rounded-full px-2 py-1 text-danger hover:bg-danger-soft" aria-label={`Supprimer ${s.name}`}>✕</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
