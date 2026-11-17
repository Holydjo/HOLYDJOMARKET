'use client';

/** Step 1 of password reset: ask for the email, then show a neutral confirmation. */
import Link from 'next/link';
import { useState } from 'react';
import { Alert } from '@/components/ui';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const r = await api.post<{ message: string }>('/auth/forgot-password', { email });
      setSent(r.message);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container-x flex justify-center py-10 md:py-16">
      <div className="w-full max-w-md">
        <h1 className="h-display text-3xl font-extrabold">Mot de passe oublié</h1>
        <p className="mt-1 text-sm text-muted">Entrez l’email de votre compte : nous vous enverrons un lien pour en choisir un nouveau.</p>
        {sent ? (
          <div className="card mt-6 space-y-4 p-5 md:p-6">
            <Alert tone="success">{sent}</Alert>
            <p className="text-sm text-muted">Pensez à vérifier vos courriels indésirables. Le lien est valable 1 heure.</p>
            <Link href="/connexion" className="btn-ghost w-full">Retour à la connexion</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="card mt-6 space-y-4 p-5 md:p-6">
            <div>
              <label className="label" htmlFor="em">Email</label>
              <input id="em" type="email" required autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {error && <Alert>{error}</Alert>}
            <button className="btn-primary w-full" disabled={busy}>{busy ? 'Envoi…' : 'Envoyer le lien'}</button>
            <p className="text-center text-sm"><Link href="/connexion" className="font-semibold text-primary">Retour à la connexion</Link></p>
          </form>
        )}
      </div>
    </div>
  );
}
