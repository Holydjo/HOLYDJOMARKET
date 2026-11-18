'use client';

/**
 * "Tester l'envoi d'email": asks the API to send a test email to the
 * logged-in admin and shows exactly what went wrong if it fails.
 */
import { useState } from 'react';
import { api } from '@/lib/api';

interface Result { ok: boolean; mode: 'smtp' | 'console'; from: string; to?: string; problem: string | null; fix: string }

export function EmailTest() {
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState<Result | null>(null);
  const [error, setError] = useState('');

  async function run() {
    setBusy(true);
    setError('');
    setR(null);
    try {
      setR(await api.post<Result>('/admin/test-email'));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card mt-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">
          <span className="font-semibold">Emails</span>
          <span className="text-muted"> — vérifiez que les notifications partent bien.</span>
        </p>
        <button onClick={run} disabled={busy} className="btn-ghost btn-sm">{busy ? 'Envoi…' : '✉️ Tester l’envoi d’email'}</button>
      </div>
      {error && <p className="mt-3 rounded-2xl bg-danger-soft p-3 text-sm text-danger">{error}</p>}
      {r && (
        <div className={`mt-3 space-y-1 rounded-2xl p-3 text-sm ${r.ok ? 'bg-green-soft text-green' : 'bg-danger-soft text-danger'}`}>
          <p className="font-semibold">{r.ok ? `✓ Email de test envoyé à ${r.to}` : '✗ L’email n’a pas pu partir'}</p>
          {r.problem && <p><span className="font-medium">Raison :</span> {r.problem}</p>}
          <p className="text-ink/80">{r.fix}</p>
          <p className="text-xs text-ink/60">Mode : {r.mode === 'smtp' ? 'envoi SMTP' : 'console (aucun envoi)'} · Expéditeur : {r.from}</p>
        </div>
      )}
    </div>
  );
}
