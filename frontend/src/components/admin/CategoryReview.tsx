'use client';

/**
 * Admin review of categories proposed by providers.
 * Approve (optionally fixing name + emoji icon) → becomes public.
 * Reject → choose an existing category; the services are moved into it.
 */
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Empty, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { useCategories } from '@/lib/hooks';
import type { Category } from '@/lib/types';

interface PendingCategory extends Category {
  createdAt: string;
  proposedBy: { firstName: string; lastName: string; email: string; providerProfile: { displayName: string; slug: string } | null } | null;
  services: { name: string; profile: { displayName: string } }[];
  _count: { services: number };
}

const ICON_IDEAS = ['💆🏽', '📸', '🧒🏾', '🐾', '🍳', '🎂', '🚗', '💻', '🌿', '🎵', '🧘🏾', '🪡'];

export function CategoryReview({ onChange }: { onChange: () => void }) {
  const [items, setItems] = useState<PendingCategory[] | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(() => api.get<PendingCategory[]>('/admin/categories/pending').then(setItems).catch((e) => setError(e.message)), []);
  useEffect(() => {
    load();
  }, [load]);

  const done = () => {
    load();
    onChange();
  };

  if (error) return <Alert>{error}</Alert>;
  if (!items) return <Spinner />;
  if (!items.length) return <Empty icon="🏷️" title="Aucune catégorie proposée">Les prestataires peuvent proposer une catégorie qui n’existe pas encore depuis leurs services.</Empty>;
  return (
    <div className="space-y-4">
      {items.map((c) => <CategoryCard key={c.id} c={c} onDone={done} />)}
    </div>
  );
}

function CategoryCard({ c, onDone }: { c: PendingCategory; onDone: () => void }) {
  const approved = useCategories();
  const [name, setName] = useState(c.name);
  const [icon, setIcon] = useState(c.icon);
  const [mode, setMode] = useState<'idle' | 'reject'>('idle');
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function act(path: string, body: unknown) {
    setError('');
    setBusy(true);
    try {
      await api.post(`/admin/categories/${c.id}/${path}`, body);
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const who = c.proposedBy?.providerProfile?.displayName ?? (c.proposedBy ? `${c.proposedBy.firstName} ${c.proposedBy.lastName}` : 'Compte supprimé');

  return (
    <article className="card p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="h-display text-xl font-bold">{c.icon} {c.name}</h2>
          <p className="text-sm text-muted">
            Proposée par{' '}
            {c.proposedBy?.providerProfile ? (
              <Link href={`/p/${c.proposedBy.providerProfile.slug}`} target="_blank" className="font-medium text-ink underline">{who}</Link>
            ) : (
              who
            )}{' '}
            · {new Date(c.createdAt).toLocaleDateString('fr-CA')} · {c._count.services} service(s)
          </p>
        </div>
        <span className="badge bg-saffron/20 text-[#7a5205]">En attente</span>
      </div>
      {c.services.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {c.services.map((s, i) => <li key={i} className="badge bg-paper text-ink">{s.name} — {s.profile.displayName}</li>)}
        </ul>
      )}

      {mode === 'idle' ? (
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
            <div>
              <label className="label" htmlFor={`n-${c.id}`}>Nom public</label>
              <input id={`n-${c.id}`} className="input" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor={`i-${c.id}`}>Icône (emoji)</label>
              <input id={`i-${c.id}`} className="input text-center text-xl" maxLength={8} value={icon} onChange={(e) => setIcon(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {ICON_IDEAS.map((ic) => (
              <button key={ic} type="button" onClick={() => setIcon(ic)} className={`rounded-xl px-2 py-1 text-xl hover:bg-paper ${icon === ic ? 'bg-paper ring-1 ring-ink' : ''}`} aria-label={`Icône ${ic}`}>{ic}</button>
            ))}
          </div>
          {error && <Alert>{error}</Alert>}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => act('approve', { name, icon })} disabled={busy || name.trim().length < 2} className="btn btn-sm bg-green text-white">✓ Approuver et publier</button>
            <button onClick={() => setMode('reject')} className="btn-ghost btn-sm text-danger">Refuser / fusionner</button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          <label className="label" htmlFor={`t-${c.id}`}>Déplacer ses services vers la catégorie existante :</label>
          <select id={`t-${c.id}`} className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">Choisir…</option>
            {approved.map((a) => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
          </select>
          <p className="hint">La catégorie « {c.name} » sera supprimée et ses {c._count.services} service(s) déplacés.</p>
          {error && <Alert>{error}</Alert>}
          <div className="flex gap-2">
            <button onClick={() => act('reject', { replaceWithId: target })} disabled={busy || !target} className="btn btn-sm bg-danger text-white">Confirmer</button>
            <button onClick={() => setMode('idle')} className="btn-ghost btn-sm">Annuler</button>
          </div>
        </div>
      )}
    </article>
  );
}
