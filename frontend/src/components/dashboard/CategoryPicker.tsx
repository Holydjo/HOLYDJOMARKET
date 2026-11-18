'use client';

/**
 * Category select for a provider's service, with "➕ Autre catégorie…" to
 * propose one that doesn't exist yet. A proposed category can be used right
 * away; it becomes public once an admin approves it.
 */
import { useCallback, useEffect, useState } from 'react';
import { Alert } from '@/components/ui';
import { api } from '@/lib/api';
import type { Category } from '@/lib/types';

const NEW = '__new__';

export function CategoryPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [cats, setCats] = useState<Category[]>([]);
  const [proposing, setProposing] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => api.get<Category[]>('/me/categories').then(setCats).catch(() => {}), []);
  useEffect(() => {
    load();
  }, [load]);

  const approved = cats.filter((c) => c.status !== 'PENDING');
  const pending = cats.filter((c) => c.status === 'PENDING');
  const selected = cats.find((c) => c.id === value);

  async function propose() {
    setError('');
    setBusy(true);
    try {
      const c = await api.post<Category>('/me/categories', { name });
      await load();
      onChange(c.id);
      setProposing(false);
      setName('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label className="label" htmlFor="cat">Catégorie</label>
      <select
        id="cat"
        required={!proposing}
        className="input"
        value={proposing ? NEW : value}
        onChange={(e) => {
          if (e.target.value === NEW) {
            setProposing(true);
            setError('');
          } else {
            setProposing(false);
            onChange(e.target.value);
          }
        }}
      >
        <option value="">Choisir…</option>
        {approved.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        {pending.length > 0 && (
          <optgroup label="Proposées (en attente de validation)">
            {pending.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </optgroup>
        )}
        <option value={NEW}>➕ Autre catégorie…</option>
      </select>

      {selected?.status === 'PENDING' && !proposing && (
        <p className="hint">Catégorie proposée : utilisable tout de suite, affichée publiquement après validation par notre équipe.</p>
      )}

      {proposing && (
        <div className="mt-2 space-y-2 rounded-2xl bg-paper p-3">
          <label className="label" htmlFor="newcat">Nom de la nouvelle catégorie</label>
          <div className="flex gap-2">
            <input
              id="newcat"
              autoFocus
              maxLength={40}
              className="input"
              placeholder="ex. Massage, Photographie, Garde d’enfants…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault(); // don't submit the service form
                  if (name.trim().length >= 2) propose();
                }
              }}
            />
            <button type="button" onClick={propose} disabled={busy || name.trim().length < 2} className="btn-dark shrink-0">
              {busy ? '…' : 'Ajouter'}
            </button>
          </div>
          <p className="hint">Vérifiez d’abord qu’elle n’existe pas déjà dans la liste. Notre équipe la valide avant de l’afficher sur le site.</p>
          {error && <Alert>{error}</Alert>}
        </div>
      )}
    </div>
  );
}
