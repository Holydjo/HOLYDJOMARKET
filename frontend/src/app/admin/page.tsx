'use client';

/**
 * Admin moderation — /admin
 * Queue of provider profiles by status. Each card shows everything needed to
 * decide (identity, photos, services, location, account contact) with
 * Approve / Reject (reason required, shown to the provider).
 */
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { CategoryReview } from '@/components/admin/CategoryReview';
import { RequireRole } from '@/components/RequireRole';
import { Alert, Cover, Empty, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { KIND_LABEL, MODE_LABEL, MODES, PROFILE_STATUS, money } from '@/lib/labels';
import type { ProfileStatus, ProviderProfile } from '@/lib/types';

type AdminProfile = ProviderProfile & {
  user: { email: string; firstName: string; lastName: string; phone?: string | null; createdAt: string };
  moderation: { id: string; action: ProfileStatus; reason?: string | null; createdAt: string; admin: { firstName: string } }[];
};
interface Stats { byStatus: Partial<Record<ProfileStatus, number>>; customers: number; appointments: number; pendingCategories: number }

const QUEUES: ProfileStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'DRAFT'];

export default function AdminPage() {
  return (
    <RequireRole role="ADMIN">
      <Moderation />
    </RequireRole>
  );
}

function Moderation() {
  const [status, setStatus] = useState<ProfileStatus>('PENDING');
  // Second view on the same page: categories proposed by providers.
  const [view, setView] = useState<'profiles' | 'categories'>('profiles');
  // Each list remembers which queue it belongs to (avoids resetting state inside the effect).
  const [list, setList] = useState<{ status: ProfileStatus; items: AdminProfile[] } | null>(null);
  const items = list?.status === status ? list.items : null;
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get<AdminProfile[]>(`/admin/providers?status=${status}`).then((items) => setList({ status, items })).catch((e) => setError(e.message));
    api.get<Stats>('/admin/stats').then(setStats).catch(() => {});
  }, [status]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="container-x py-6 md:py-8">
      <h1 className="h-display text-3xl font-extrabold">Modération</h1>
      <p className="text-sm text-muted">Vérifiez les nouveaux prestataires avant leur publication.</p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['À valider', stats?.byStatus.PENDING ?? 0, 'text-primary'],
          ['Publiés', stats?.byStatus.APPROVED ?? 0, 'text-green'],
          ['Clients', stats?.customers ?? 0, ''],
          ['Demandes de RDV', stats?.appointments ?? 0, ''],
        ].map(([l, v, c]) => (
          <div key={String(l)} className="card p-4">
            <p className={`h-display text-3xl font-extrabold ${c}`}>{v}</p>
            <p className="text-xs text-muted">{l}</p>
          </div>
        ))}
      </div>

      <div className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {QUEUES.map((s) => (
          <button
            key={s}
            onClick={() => {
              setView('profiles');
              setStatus(s);
            }}
            className={`chip ${view === 'profiles' && status === s ? 'chip-on' : ''}`}
          >
            {PROFILE_STATUS[s].label} {stats?.byStatus[s] ? `(${stats.byStatus[s]})` : ''}
          </button>
        ))}
        <span className="mx-1 w-px shrink-0 bg-line" />
        <button onClick={() => setView('categories')} className={`chip ${view === 'categories' ? 'chip-on' : ''}`}>
          🏷️ Catégories proposées
          {stats?.pendingCategories ? <span className="badge ml-1 bg-primary px-1.5 py-0 text-white">{stats.pendingCategories}</span> : null}
        </button>
      </div>

      {view === 'categories' ? (
        <div className="mt-4">
          <CategoryReview onChange={load} />
        </div>
      ) : (
        <>
          {error && <div className="mt-4"><Alert>{error}</Alert></div>}
          <div className="mt-4 space-y-4">
            {!items && <Spinner />}
            {items?.length === 0 && <Empty icon="✅" title="Rien à traiter ici">La file est vide.</Empty>}
            {items?.map((p) => <ReviewCard key={p.id} p={p} onDone={load} />)}
          </div>
        </>
      )}
    </div>
  );
}

function ReviewCard({ p, onDone }: { p: AdminProfile; onDone: () => void }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function act(action: 'approve' | 'reject') {
    setError('');
    setBusy(true);
    try {
      await api.post(`/admin/providers/${p.id}/${action}`, action === 'reject' ? { reason } : undefined);
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <article className="card overflow-hidden">
      <div className="grid gap-4 p-4 md:grid-cols-[220px_1fr] md:p-5">
        <div>
          <Cover url={p.photos[0]?.url} alt={p.displayName} className="aspect-[4/3] w-full rounded-2xl" />
          <div className="mt-2 grid grid-cols-4 gap-1">
            {p.photos.slice(1, 5).map((ph) => <Cover key={ph.id} url={ph.url} alt="" className="aspect-square w-full rounded-lg" />)}
          </div>
          <p className="mt-1 text-xs text-muted">{p.photos.length} photo(s)</p>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="h-display text-xl font-bold">{p.displayName}</h2>
            <span className="badge bg-ink text-white">{KIND_LABEL[p.kind]}</span>
            <span className={`badge ${PROFILE_STATUS[p.status].tone}`}>{PROFILE_STATUS[p.status].label}</span>
          </div>
          {p.tagline && <p className="text-sm text-muted">{p.tagline}</p>}
          <p className="mt-2 line-clamp-4 text-sm">{p.description || <em className="text-danger">Pas de description</em>}</p>

          <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <div><dt className="inline text-muted">Compte : </dt><dd className="inline">{p.user.firstName} {p.user.lastName} · {p.user.email}</dd></div>
            <div><dt className="inline text-muted">Téléphone : </dt><dd className="inline">{p.phone || p.user.phone || '—'}</dd></div>
            <div><dt className="inline text-muted">Lieu : </dt><dd className="inline">{[p.neighbourhood, p.city].filter(Boolean).join(', ')}</dd></div>
            <div><dt className="inline text-muted">Prestation : </dt><dd className="inline">{MODES.filter((m) => p[m]).map((m) => MODE_LABEL[m].short + (m === 'travels' ? ` (${p.travelRadiusKm} km)` : '')).join(', ') || '—'}</dd></div>
            {p.submittedAt && <div><dt className="inline text-muted">Soumis le : </dt><dd className="inline">{new Date(p.submittedAt).toLocaleDateString('fr-CA')}</dd></div>}
          </dl>

          <ul className="mt-3 flex flex-wrap gap-1.5">
            {p.services.map((s) => (
              <li key={s.id} className="badge bg-paper text-ink">{s.category.icon} {s.name} · {money(s.priceCents)}</li>
            ))}
          </ul>

          {p.moderation.length > 0 && (
            <details className="mt-3 text-xs text-muted">
              <summary className="cursor-pointer">Historique ({p.moderation.length})</summary>
              <ul className="mt-1 space-y-1">
                {p.moderation.map((m) => (
                  <li key={m.id}>{new Date(m.createdAt).toLocaleDateString('fr-CA')} — {PROFILE_STATUS[m.action].label} par {m.admin.firstName}{m.reason ? ` : « ${m.reason} »` : ''}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line bg-paper/60 p-3 md:px-5">
        <Link href={`/p/${p.slug}`} target="_blank" className="btn-ghost btn-sm">Voir la page ↗</Link>
        <div className="ml-auto flex gap-2">
          {p.status === 'PENDING' && (
            <button onClick={() => act('approve')} disabled={busy} className="btn btn-sm bg-green text-white">✓ Approuver</button>
          )}
          {(p.status === 'PENDING' || p.status === 'APPROVED') && !rejecting && (
            <button onClick={() => setRejecting(true)} className="btn-ghost btn-sm text-danger">{p.status === 'APPROVED' ? 'Suspendre' : 'Refuser'}</button>
          )}
        </div>
      </div>
      {rejecting && (
        <div className="space-y-2 border-t border-line p-4 md:px-5">
          <label className="label" htmlFor={`r-${p.id}`}>Message au prestataire (obligatoire)</label>
          <textarea id={`r-${p.id}`} rows={2} className="input" placeholder="Ce qu’il faut corriger pour être publié…" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex gap-2">
            <button onClick={() => act('reject')} disabled={busy || reason.trim().length < 5} className="btn btn-sm bg-danger text-white">Confirmer</button>
            <button onClick={() => setRejecting(false)} className="btn-ghost btn-sm">Annuler</button>
          </div>
        </div>
      )}
      {error && <div className="p-4 pt-0"><Alert>{error}</Alert></div>}
    </article>
  );
}
