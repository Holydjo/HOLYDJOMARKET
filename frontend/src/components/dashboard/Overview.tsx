'use client';

/**
 * Status + completion checklist. The same rules are enforced by the API in
 * POST /me/profile/submit — this is only a friendly preview of them.
 */
import Link from 'next/link';
import { useState } from 'react';
import type { Tab } from '@/app/dashboard/page';
import { Alert } from '@/components/ui';
import { api } from '@/lib/api';
import type { ProviderProfile } from '@/lib/types';

export function Overview({ profile: p, onChange, goTo }: { profile: ProviderProfile; onChange: () => void; goTo: (t: Tab) => void }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const checks: { ok: boolean; label: string; tab: Tab }[] = [
    { ok: (p.description?.length ?? 0) >= 30, label: 'Une description (30 caractères min.)', tab: 'profile' },
    { ok: p.atHome || p.inSalon || p.inShop || p.travels, label: 'Où se passe la prestation', tab: 'profile' },
    { ok: p.services.some((s) => s.isActive), label: 'Au moins un service avec son prix', tab: 'services' },
    { ok: p.photos.length > 0, label: 'Au moins une photo', tab: 'photos' },
    { ok: p.openingHours.length > 0, label: 'Vos horaires (recommandé)', tab: 'hours' },
  ];
  const required = checks.slice(0, 4);
  const done = checks.filter((c) => c.ok).length;
  const ready = required.every((c) => c.ok);

  async function submit() {
    setError('');
    setBusy(true);
    try {
      await api.post('/me/profile/submit');
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* status card */}
      {p.status === 'APPROVED' && (
        <div className="card border-0 bg-green p-5 text-white md:p-6">
          <p className="h-display text-xl font-bold">🎉 Votre profil est en ligne</p>
          <p className="mt-1 text-sm text-white/80">Les clients de votre quartier peuvent vous trouver et vous envoyer des demandes.</p>
          <Link href={`/p/${p.slug}`} className="btn btn-sm mt-4 bg-white text-green">Voir ma page publique</Link>
        </div>
      )}
      {p.status === 'PENDING' && (
        <div className="card p-5 md:p-6">
          <p className="h-display text-xl font-bold">⏳ En cours de validation</p>
          <p className="mt-1 text-sm text-muted">Notre équipe vérifie votre profil, en général sous 48 h. Vous pouvez continuer à le modifier en attendant.</p>
          <Link href={`/p/${p.slug}`} className="btn-ghost btn-sm mt-4">Prévisualiser ma page</Link>
        </div>
      )}
      {p.status === 'REJECTED' && (
        <div className="card border-danger/30 p-5 md:p-6">
          <p className="h-display text-xl font-bold text-danger">Quelques corrections sont nécessaires</p>
          {p.rejectionReason && <p className="mt-2 rounded-2xl bg-danger-soft p-3 text-sm"><strong>Message de l’équipe :</strong> {p.rejectionReason}</p>}
          <p className="mt-2 text-sm text-muted">Modifiez votre profil puis soumettez-le à nouveau.</p>
        </div>
      )}

      {/* checklist */}
      {p.status !== 'APPROVED' && (
        <div className="card p-5 md:p-6">
          <div className="flex items-center justify-between">
            <h2 className="h-display text-lg font-bold">Profil complété à {Math.round((done / checks.length) * 100)} %</h2>
            <span className="text-sm text-muted">{done}/{checks.length}</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(done / checks.length) * 100}%` }} />
          </div>
          <ul className="mt-4 divide-y divide-line">
            {checks.map((c) => (
              <li key={c.label} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span className="flex items-center gap-3">
                  <span className={`grid h-6 w-6 place-items-center rounded-full text-xs ${c.ok ? 'bg-green text-white' : 'border border-line'}`}>{c.ok ? '✓' : ''}</span>
                  {c.label}
                </span>
                {!c.ok && <button onClick={() => goTo(c.tab)} className="text-xs font-semibold text-primary">Compléter →</button>}
              </li>
            ))}
          </ul>
          {(p.status === 'DRAFT' || p.status === 'REJECTED') && (
            <div className="mt-4 space-y-3">
              {error && <Alert>{error}</Alert>}
              <button onClick={submit} disabled={!ready || busy} className="btn-primary w-full sm:w-auto">
                {busy ? 'Envoi…' : 'Soumettre pour validation'}
              </button>
              {!ready && <p className="hint">Complétez les 4 premiers points pour soumettre.</p>}
            </div>
          )}
        </div>
      )}

      {/* quick stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          [p.services.filter((s) => s.isActive).length, 'services'],
          [p.photos.length, 'photos'],
          [p.ratingCount ? `★ ${p.ratingAvg.toFixed(1)}` : '—', `${p.ratingCount} avis`],
        ].map(([v, l]) => (
          <div key={String(l)} className="card p-4 text-center">
            <p className="h-display text-2xl font-extrabold">{v}</p>
            <p className="text-xs text-muted">{l}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
