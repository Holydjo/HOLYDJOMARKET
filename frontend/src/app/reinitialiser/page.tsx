'use client';

/** Step 2 of password reset: /reinitialiser?token=… → choose a new password, then log in automatically. */
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { homeFor, useAuth } from '@/components/AuthProvider';
import { Alert } from '@/components/ui';
import { api } from '@/lib/api';
import type { User } from '@/lib/types';

export default function ResetPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}

function ResetForm() {
  const token = useSearchParams().get('token') ?? '';
  const router = useRouter();
  const { signIn } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) return setError('Les deux mots de passe ne correspondent pas.');
    setBusy(true);
    try {
      const r = await api.post<{ token: string; user: User }>('/auth/reset-password', { token, password });
      signIn(r.token, r.user);
      router.push(homeFor(r.user));
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="container-x flex justify-center py-10 md:py-16">
      <div className="w-full max-w-md">
        <h1 className="h-display text-3xl font-extrabold">Nouveau mot de passe</h1>
        {!token ? (
          <div className="mt-6 space-y-4">
            <Alert>Lien incomplet. Ouvrez le lien reçu par email, ou faites une nouvelle demande.</Alert>
            <Link href="/mot-de-passe-oublie" className="btn-primary w-full">Nouvelle demande</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="card mt-6 space-y-4 p-5 md:p-6">
            <div>
              <label className="label" htmlFor="pw">Nouveau mot de passe</label>
              <input id="pw" type="password" required minLength={8} autoComplete="new-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
              <p className="hint">8 caractères minimum.</p>
            </div>
            <div>
              <label className="label" htmlFor="pw2">Confirmer</label>
              <input id="pw2" type="password" required minLength={8} autoComplete="new-password" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            {error && <Alert>{error}</Alert>}
            {error.includes('plus valide') && <Link href="/mot-de-passe-oublie" className="btn-ghost w-full">Faire une nouvelle demande</Link>}
            <button className="btn-primary w-full" disabled={busy}>{busy ? '…' : 'Enregistrer et me connecter'}</button>
          </form>
        )}
      </div>
    </div>
  );
}
