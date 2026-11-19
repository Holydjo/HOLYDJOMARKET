'use client';

/**
 * Admin tools beyond the profile queue (Modération page tabs):
 *   ReportsAdmin       "Signalements" — reported profiles / reviews
 *   UsersAdmin         "Utilisateurs" — search, open profile, delete account
 *   ReviewsAdmin       "Avis"         — latest reviews, remove abusive ones
 *   AppointmentsAdmin  "Rendez-vous"  — overview of booking requests
 *   EmailsAdmin        "Emails"       — outbox journal, retry failed emails
 * Every destructive action asks for confirmation.
 */
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Empty, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { APPT_STATUS, PROFILE_STATUS, REPORT_REASONS, dateTime, money } from '@/lib/labels';
import type { AppointmentStatus, ProfileStatus, Role } from '@/lib/types';

const fmt = (iso: string) => new Date(iso).toLocaleString('fr-CA', { dateStyle: 'medium', timeStyle: 'short' });

/** Small generic loader: refetches when `url` changes; exposes reload(). */
function useList<T>(url: string) {
  const [res, setRes] = useState<{ url: string; data?: T; error?: string } | null>(null);
  const reload = useCallback(() => {
    api.get<T>(url).then((data) => setRes({ url, data })).catch((e) => setRes({ url, error: e.message }));
  }, [url]);
  useEffect(() => {
    reload();
  }, [reload]);
  const current = res?.url === url ? res : null;
  return { data: current?.data ?? null, error: current?.error ?? '', loading: !current, reload };
}

function Chips<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([v, l]) => (
        <button key={v || 'all'} onClick={() => onChange(v)} className={`chip ${value === v ? 'chip-on' : ''}`}>{l}</button>
      ))}
    </div>
  );
}

function SearchBox({ onSearch, placeholder }: { onSearch: (q: string) => void; placeholder: string }) {
  const [q, setQ] = useState('');
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(q.trim());
      }}
    >
      <input className="input" placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} aria-label={placeholder} />
      <button className="btn-dark shrink-0">Rechercher</button>
    </form>
  );
}

// ============================================================ Signalements

interface AdminReport {
  id: string; targetType: 'PROFILE' | 'REVIEW'; targetId: string; reason: string; message?: string | null;
  status: 'OPEN' | 'RESOLVED'; adminNote?: string | null; createdAt: string; resolvedAt?: string | null;
  reporter: { firstName: string; lastName: string; email: string } | null;
  profile: { id: string; displayName: string; slug: string; status: ProfileStatus } | null;
  review: { id: string; rating: number; comment?: string | null; author: { firstName: string; lastName: string }; profile: { displayName: string; slug: string } } | null;
}

export function ReportsAdmin({ onChange }: { onChange: () => void }) {
  const [status, setStatus] = useState<'OPEN' | 'RESOLVED'>('OPEN');
  const { data, error, loading, reload } = useList<AdminReport[]>(`/admin/reports?status=${status}`);
  const done = () => {
    reload();
    onChange();
  };
  return (
    <div className="space-y-4">
      <Chips value={status} options={[['OPEN', 'À traiter'], ['RESOLVED', 'Traités']]} onChange={setStatus} />
      {error && <Alert>{error}</Alert>}
      {loading && <Spinner />}
      {data?.length === 0 && <Empty icon="🛡️" title="Aucun signalement">{status === 'OPEN' ? 'Rien à traiter.' : 'Aucun signalement traité pour l’instant.'}</Empty>}
      {data?.map((r) => <ReportCard key={r.id} r={r} onDone={done} />)}
    </div>
  );
}

function ReportCard({ r, onDone }: { r: AdminReport; onDone: () => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run(fn: () => Promise<unknown>, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    setError('');
    setBusy(true);
    try {
      await fn();
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  const resolve = () => api.post(`/admin/reports/${r.id}/resolve`, { adminNote: note || undefined });

  return (
    <article className="card space-y-3 p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{r.targetType === 'PROFILE' ? 'Profil signalé' : 'Avis signalé'} · {REPORT_REASONS[r.reason] ?? r.reason}</p>
          <p className="text-xs text-muted">
            {fmt(r.createdAt)} · par {r.reporter ? `${r.reporter.firstName} ${r.reporter.lastName} (${r.reporter.email})` : 'compte supprimé'}
          </p>
        </div>
        <span className={`badge ${r.status === 'OPEN' ? 'bg-saffron/20 text-[#7a5205]' : 'bg-green-soft text-green'}`}>{r.status === 'OPEN' ? 'À traiter' : 'Traité'}</span>
      </div>
      {r.message && <p className="rounded-2xl bg-paper p-3 text-sm">“{r.message}”</p>}

      {r.targetType === 'PROFILE' &&
        (r.profile ? (
          <p className="text-sm">
            <Link href={`/p/${r.profile.slug}`} target="_blank" className="font-semibold underline">{r.profile.displayName}</Link>{' '}
            <span className={`badge ${PROFILE_STATUS[r.profile.status].tone}`}>{PROFILE_STATUS[r.profile.status].label}</span>
          </p>
        ) : (
          <p className="text-sm text-muted">Ce profil a été supprimé depuis.</p>
        ))}
      {r.targetType === 'REVIEW' &&
        (r.review ? (
          <div className="rounded-2xl border border-line p-3 text-sm">
            <p><span className="text-saffron">{'★'.repeat(r.review.rating)}</span> par {r.review.author.firstName} {r.review.author.lastName[0]}. sur{' '}
              <Link href={`/p/${r.review.profile.slug}`} target="_blank" className="underline">{r.review.profile.displayName}</Link></p>
            {r.review.comment && <p className="mt-1 text-ink/80">{r.review.comment}</p>}
          </div>
        ) : (
          <p className="text-sm text-muted">Cet avis a été supprimé depuis.</p>
        ))}

      {r.status === 'RESOLVED' ? (
        r.adminNote && <p className="text-xs text-muted">Note : {r.adminNote}</p>
      ) : (
        <div className="space-y-2 border-t border-line pt-3">
          <input className="input" placeholder="Note interne (facultatif) : action prise…" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note interne" />
          {error && <Alert>{error}</Alert>}
          <div className="flex flex-wrap gap-2">
            {r.review && (
              <button disabled={busy} className="btn btn-sm bg-danger text-white"
                onClick={() => run(async () => { await api.del(`/admin/reviews/${r.review!.id}`); await resolve(); }, 'Supprimer définitivement cet avis ?')}>
                Supprimer l’avis et clore
              </button>
            )}
            {r.profile?.status === 'APPROVED' && (
              <button disabled={busy} className="btn btn-sm bg-danger text-white"
                onClick={() => {
                  const reason = prompt('Message au prestataire (obligatoire) : pourquoi le profil est suspendu ?');
                  if (!reason || reason.trim().length < 5) return;
                  void run(async () => { await api.post(`/admin/providers/${r.profile!.id}/reject`, { reason }); await resolve(); });
                }}>
                Suspendre le profil et clore
              </button>
            )}
            <button disabled={busy} onClick={() => run(resolve)} className="btn-ghost btn-sm">Clore sans action</button>
          </div>
        </div>
      )}
    </article>
  );
}

// ============================================================ Utilisateurs

interface AdminUser {
  id: string; email: string; firstName: string; lastName: string; phone?: string | null; role: Role; createdAt: string;
  providerProfile: { id: string; displayName: string; slug: string; status: ProfileStatus } | null;
  _count: { appointments: number; reviews: number };
}
const ROLE_LABEL: Record<Role, string> = { CUSTOMER: 'Client', PROVIDER: 'Prestataire', ADMIN: 'Admin' };

export function UsersAdmin() {
  const [q, setQ] = useState('');
  const [role, setRole] = useState<'' | Role>('');
  const { data, error, loading, reload } = useList<AdminUser[]>(`/admin/users?q=${encodeURIComponent(q)}${role ? `&role=${role}` : ''}`);
  const [actionError, setActionError] = useState('');

  async function remove(u: AdminUser) {
    if (!confirm(`Supprimer définitivement le compte de ${u.firstName} ${u.lastName} (${u.email}) ?\n\nSon profil, ses services, ses demandes et ses avis seront supprimés. Action irréversible.`)) return;
    setActionError('');
    try {
      await api.del(`/admin/users/${u.id}`);
      reload();
    } catch (e) {
      setActionError((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <SearchBox onSearch={setQ} placeholder="Nom, email ou nom du profil…" />
      <Chips value={role} options={[['', 'Tous'], ['CUSTOMER', 'Clients'], ['PROVIDER', 'Prestataires'], ['ADMIN', 'Admins']]} onChange={setRole} />
      {(error || actionError) && <Alert>{error || actionError}</Alert>}
      {loading && <Spinner />}
      {data?.length === 0 && <Empty icon="🔎" title="Aucun utilisateur trouvé" />}
      {data && data.length > 0 && (
        <ul className="card divide-y divide-line">
          {data.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{u.firstName} {u.lastName} <span className="badge bg-paper text-muted">{ROLE_LABEL[u.role]}</span></p>
                <p className="truncate text-sm text-muted">{u.email}{u.phone ? ` · ${u.phone}` : ''} · inscrit le {new Date(u.createdAt).toLocaleDateString('fr-CA')}</p>
                <p className="text-xs text-muted">
                  {u._count.appointments} demande(s) · {u._count.reviews} avis
                  {u.providerProfile && (
                    <> · profil <Link href={`/p/${u.providerProfile.slug}`} target="_blank" className="underline">{u.providerProfile.displayName}</Link>{' '}
                      <span className={`badge ${PROFILE_STATUS[u.providerProfile.status].tone}`}>{PROFILE_STATUS[u.providerProfile.status].label}</span></>
                  )}
                </p>
              </div>
              {u.role !== 'ADMIN' && <button onClick={() => remove(u)} className="btn-ghost btn-sm text-danger">Supprimer le compte</button>}
            </li>
          ))}
        </ul>
      )}
      {data?.length === 50 && <p className="hint">Seuls les 50 plus récents sont affichés : affinez la recherche.</p>}
    </div>
  );
}

// ============================================================ Avis

interface AdminReview {
  id: string; rating: number; comment?: string | null; createdAt: string;
  author: { firstName: string; lastName: string; email: string };
  profile: { displayName: string; slug: string };
}

export function ReviewsAdmin() {
  const [q, setQ] = useState('');
  const { data, error, loading, reload } = useList<AdminReview[]>(`/admin/reviews?q=${encodeURIComponent(q)}`);
  const [actionError, setActionError] = useState('');
  async function remove(r: AdminReview) {
    if (!confirm('Supprimer définitivement cet avis ? La note du prestataire sera recalculée.')) return;
    setActionError('');
    try {
      await api.del(`/admin/reviews/${r.id}`);
      reload();
    } catch (e) {
      setActionError((e as Error).message);
    }
  }
  return (
    <div className="space-y-4">
      <SearchBox onSearch={setQ} placeholder="Texte de l’avis, prestataire ou email de l’auteur…" />
      {(error || actionError) && <Alert>{error || actionError}</Alert>}
      {loading && <Spinner />}
      {data?.length === 0 && <Empty icon="⭐" title="Aucun avis" />}
      <ul className="space-y-2">
        {data?.map((r) => (
          <li key={r.id} className="card flex flex-wrap items-start gap-3 p-4">
            <div className="min-w-0 flex-1 text-sm">
              <p><span className="text-saffron">{'★'.repeat(r.rating)}</span><span className="text-line">{'★'.repeat(5 - r.rating)}</span>{' '}
                sur <Link href={`/p/${r.profile.slug}`} target="_blank" className="font-semibold underline">{r.profile.displayName}</Link></p>
              {r.comment && <p className="mt-1 text-ink/80">{r.comment}</p>}
              <p className="mt-1 text-xs text-muted">{r.author.firstName} {r.author.lastName} ({r.author.email}) · {fmt(r.createdAt)}</p>
            </div>
            <button onClick={() => remove(r)} className="btn-ghost btn-sm text-danger">Supprimer</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================ Rendez-vous

interface AdminAppointment {
  id: string; requestedAt: string; status: AppointmentStatus; message?: string | null; createdAt: string;
  customer: { firstName: string; lastName: string; email: string };
  profile: { displayName: string; slug: string; timeZone?: string | null };
  service?: { name: string; priceCents: number } | null;
}

export function AppointmentsAdmin() {
  const [status, setStatus] = useState<'' | AppointmentStatus>('');
  const { data, error, loading } = useList<AdminAppointment[]>(`/admin/appointments${status ? `?status=${status}` : ''}`);
  return (
    <div className="space-y-4">
      <Chips value={status} options={[['', 'Toutes'], ['PENDING', 'En attente'], ['ACCEPTED', 'Acceptées'], ['DECLINED', 'Refusées'], ['CANCELLED', 'Annulées']]} onChange={setStatus} />
      {error && <Alert>{error}</Alert>}
      {loading && <Spinner />}
      {data?.length === 0 && <Empty icon="📅" title="Aucune demande" />}
      {data && data.length > 0 && (
        <ul className="card divide-y divide-line">
          {data.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {a.customer.firstName} {a.customer.lastName} → <Link href={`/p/${a.profile.slug}`} target="_blank" className="underline">{a.profile.displayName}</Link>
                </p>
                <p className="text-muted">
                  🗓️ {dateTime(a.requestedAt, a.profile.timeZone)} · {a.service ? `${a.service.name} (${money(a.service.priceCents)})` : 'service à préciser'}
                </p>
                <p className="text-xs text-muted">Envoyée le {fmt(a.createdAt)} · {a.customer.email}</p>
              </div>
              <span className={`badge ${APPT_STATUS[a.status].tone}`}>{APPT_STATUS[a.status].label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ============================================================ Emails

type EmailStatus = 'PENDING' | 'SENDING' | 'SENT' | 'FAILED';
interface OutboxItem { id: string; to: string[]; subject: string; status: EmailStatus; attempts: number; lastError?: string | null; nextAttemptAt: string; sentAt?: string | null; createdAt: string }
interface OutboxResponse { counts: Partial<Record<EmailStatus, number>>; items: OutboxItem[]; mode: 'smtp' | 'console'; from: string }

const EMAIL_STATUS: Record<EmailStatus, { label: string; tone: string }> = {
  PENDING: { label: 'En attente', tone: 'bg-saffron/20 text-[#7a5205]' },
  SENDING: { label: 'Envoi…', tone: 'bg-saffron/20 text-[#7a5205]' },
  SENT: { label: 'Envoyé', tone: 'bg-green-soft text-green' },
  FAILED: { label: 'Échec', tone: 'bg-danger-soft text-danger' },
};

export function EmailsAdmin({ onChange }: { onChange: () => void }) {
  const [status, setStatus] = useState<'' | EmailStatus>('');
  const { data, error, loading, reload } = useList<OutboxResponse>(`/admin/emails${status ? `?status=${status}` : ''}`);
  async function retry(id: string) {
    await api.post(`/admin/emails/${id}/retry`);
    setTimeout(() => {
      reload();
      onChange();
    }, 1500);
  }
  return (
    <div className="space-y-4">
      {data && (
        <p className="text-sm text-muted">
          Mode : {data.mode === 'smtp' ? 'envoi SMTP' : 'console (aucun envoi réel)'} · Expéditeur : {data.from} ·{' '}
          {data.counts.SENT ?? 0} envoyé(s), {data.counts.PENDING ?? 0} en attente, {data.counts.FAILED ?? 0} en échec
        </p>
      )}
      <Chips value={status} options={[['', 'Tous'], ['FAILED', 'Échecs'], ['PENDING', 'En attente'], ['SENT', 'Envoyés']]} onChange={setStatus} />
      {error && <Alert>{error}</Alert>}
      {loading && <Spinner />}
      {data?.items.length === 0 && <Empty icon="✉️" title="Aucun email" />}
      {data && data.items.length > 0 && (
        <ul className="card divide-y divide-line">
          {data.items.map((e) => (
            <li key={e.id} className="flex flex-wrap items-start gap-3 p-4 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{e.subject}</p>
                <p className="truncate text-muted">À : {e.to.join(', ')}</p>
                <p className="text-xs text-muted">
                  Créé le {fmt(e.createdAt)}{e.sentAt ? ` · envoyé le ${fmt(e.sentAt)}` : ''} · {e.attempts} tentative(s)
                  {e.status === 'PENDING' && e.attempts > 0 ? ` · prochain essai ${fmt(e.nextAttemptAt)}` : ''}
                </p>
                {e.lastError && <p className="mt-1 rounded-xl bg-danger-soft px-2 py-1 text-xs text-danger">{e.lastError}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className={`badge ${EMAIL_STATUS[e.status].tone}`}>{EMAIL_STATUS[e.status].label}</span>
                {(e.status === 'FAILED' || (e.status === 'PENDING' && e.attempts > 0)) && (
                  <button onClick={() => retry(e.id)} className="btn-ghost btn-sm">Renvoyer</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
