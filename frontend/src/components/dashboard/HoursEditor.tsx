'use client';

/** Weekly opening hours (one line per day, Monday first). Saved in one request. */
import { useState } from 'react';
import { Alert } from '@/components/ui';
import { api } from '@/lib/api';
import { WEEK_ORDER, WEEKDAYS } from '@/lib/labels';
import type { Hours, ProviderProfile } from '@/lib/types';

export function HoursEditor({ profile, onChange }: { profile: ProviderProfile; onChange: () => void }) {
  const [days, setDays] = useState<Hours[]>(() =>
    WEEK_ORDER.map((d) => profile.openingHours.find((h) => h.weekday === d) ?? { weekday: d, closed: d === 0, opensAt: '09:00', closesAt: '18:00' }),
  );
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const update = (i: number, patch: Partial<Hours>) => setDays((ds) => ds.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  async function save() {
    setMsg(null);
    const bad = days.find((d) => !d.closed && (!d.opensAt || !d.closesAt || d.opensAt >= d.closesAt));
    if (bad) return setMsg({ tone: 'error', text: `${WEEKDAYS[bad.weekday]} : l’heure de fermeture doit être après l’ouverture.` });
    try {
      await api.put('/me/profile/hours', {
        days: days.map((d) => ({ weekday: d.weekday, closed: d.closed, ...(d.closed ? {} : { opensAt: d.opensAt, closesAt: d.closesAt }) })),
      });
      setMsg({ tone: 'success', text: 'Horaires enregistrés ✓' });
      onChange();
    } catch (e) {
      setMsg({ tone: 'error', text: (e as Error).message });
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="h-display text-xl font-bold">Mes horaires</h2>
      <ul className="card divide-y divide-line">
        {days.map((d, i) => (
          <li key={d.weekday} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="w-24 text-sm font-medium">{WEEKDAYS[d.weekday]}</span>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={!d.closed} onChange={(e) => update(i, { closed: !e.target.checked, opensAt: d.opensAt ?? '09:00', closesAt: d.closesAt ?? '18:00' })} className="accent-[var(--primary)]" />
              {d.closed ? 'Fermé' : 'Ouvert'}
            </label>
            {!d.closed && (
              <span className="ml-auto flex items-center gap-2 text-sm">
                <input type="time" step={900} aria-label="Ouverture" value={d.opensAt ?? ''} onChange={(e) => update(i, { opensAt: e.target.value })} className="input w-auto px-3 py-2" />
                –
                <input type="time" step={900} aria-label="Fermeture" value={d.closesAt ?? ''} onChange={(e) => update(i, { closesAt: e.target.value })} className="input w-auto px-3 py-2" />
              </span>
            )}
          </li>
        ))}
      </ul>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <button onClick={save} className="btn-primary">Enregistrer les horaires</button>
    </div>
  );
}
