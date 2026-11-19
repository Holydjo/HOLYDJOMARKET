'use client';

/**
 * Shown under the header to logged-in users who haven't confirmed their
 * email yet (audit H4). Booking, publishing, reviewing and reporting are
 * refused by the API until they do.
 */
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from './AuthProvider';

export function VerifyBanner() {
  const { user } = useAuth();
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  if (!user || user.emailVerified !== false) return null;

  async function resend() {
    setBusy(true);
    try {
      const r = await api.post<{ message: string }>('/auth/resend-verification');
      setMsg(r.message);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-b border-saffron/40 bg-saffron/15" role="status">
      <div className="container-x flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm text-[#5c3d03]">
        <span>
          ✉️ <strong>Confirmez votre adresse email</strong> : cliquez sur le lien envoyé à {user.email} pour pouvoir réserver, publier ou laisser un avis.
        </span>
        {msg ? (
          <span className="font-medium">{msg}</span>
        ) : (
          <button onClick={resend} disabled={busy} className="font-semibold underline">{busy ? 'Envoi…' : 'Renvoyer le lien'}</button>
        )}
      </div>
    </div>
  );
}
