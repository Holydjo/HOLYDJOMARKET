'use client';

/**
 * "Signaler" link + small form, for a provider profile or a review.
 * Logged-out visitors are sent to the login page first (reports need an account,
 * which limits abuse); the API also rate-limits and de-duplicates reports.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useId, useState } from 'react';
import { api } from '@/lib/api';
import { REPORT_REASONS } from '@/lib/labels';
import { useAuth } from './AuthProvider';
import { Alert } from './ui';

export function ReportButton({ targetType, targetId, label = 'Signaler' }: { targetType: 'PROFILE' | 'REVIEW'; targetId: string; label?: string }) {
  const { user } = useAuth();
  const path = usePathname();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState('');

  if (state === 'done') return <p className="text-xs text-green" role="status">Merci, notre équipe va vérifier.</p>;

  if (!user) {
    return (
      <Link href={`/connexion?next=${encodeURIComponent(path)}`} className="text-xs text-muted underline hover:text-danger">
        ⚑ {label}
      </Link>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-muted underline hover:text-danger" aria-expanded={false}>
        ⚑ {label}
      </button>
    );
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setState('busy');
    try {
      await api.post('/reports', { targetType, targetId, reason, message: message.trim() || undefined });
      setState('done');
    } catch (err) {
      setError((err as Error).message);
      setState('idle');
    }
  }

  return (
    <form onSubmit={send} className="mt-2 space-y-2 rounded-2xl border border-line bg-paper p-3 text-sm">
      <fieldset>
        <legend className="mb-1 font-semibold">Pourquoi signalez-vous {targetType === 'PROFILE' ? 'ce profil' : 'cet avis'} ?</legend>
        {Object.entries(REPORT_REASONS).map(([code, text]) => (
          <label key={code} className="flex items-center gap-2 py-0.5">
            <input type="radio" name={`reason-${id}`} value={code} checked={reason === code} onChange={() => setReason(code)} className="accent-[var(--primary)]" />
            {text}
          </label>
        ))}
      </fieldset>
      <label className="sr-only" htmlFor={`msg-${id}`}>Détails</label>
      <textarea id={`msg-${id}`} rows={2} maxLength={1000} className="input" placeholder="Détails (facultatif)" value={message} onChange={(e) => setMessage(e.target.value)} />
      {error && <Alert>{error}</Alert>}
      <div className="flex gap-2">
        <button className="btn-dark btn-sm" disabled={!reason || state === 'busy'}>{state === 'busy' ? '…' : 'Envoyer le signalement'}</button>
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost btn-sm">Annuler</button>
      </div>
    </form>
  );
}
