'use client';

/**
 * Call-to-action on /devenir-pro, adapted to who is looking:
 * - visitor          → create a provider account, or log in (and come back here)
 * - customer         → switch this account to a provider account (same login)
 * - provider         → go to the dashboard
 * - admin            → nothing to do
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import type { User } from '@/lib/types';
import { useAuth } from './AuthProvider';
import { Alert } from './ui';

export function BecomeProviderCta() {
  const { user, loading, signIn } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function switchAccount() {
    setError('');
    setBusy(true);
    try {
      const r = await api.post<{ token: string; user: User }>('/auth/become-provider');
      signIn(r.token, r.user);
      router.push('/dashboard');
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  if (loading) return <div className="mt-8 h-12" />;

  if (user?.role === 'PROVIDER') {
    return (
      <div className="mt-8">
        <Link href="/dashboard" className="btn-primary">Aller à mon tableau de bord →</Link>
      </div>
    );
  }

  if (user?.role === 'CUSTOMER') {
    return (
      <div className="card mt-8 max-w-xl space-y-3 p-5">
        <p className="font-semibold">Vous êtes connecté·e en tant que {user.firstName} ({user.email}).</p>
        <p className="text-sm text-muted">
          Transformez ce compte en compte prestataire : vous gardez le même email, le même mot de passe et vos demandes de
          rendez-vous déjà envoyées. Vous pourrez toujours réserver chez d’autres pros.
        </p>
        {error && <Alert>{error}</Alert>}
        <button onClick={switchAccount} disabled={busy} className="btn-primary w-full sm:w-auto">
          {busy ? '…' : 'Passer mon compte en prestataire'}
        </button>
      </div>
    );
  }

  if (user?.role === 'ADMIN') return null;

  return (
    <div className="mt-8 flex flex-wrap gap-3">
      <Link href="/inscription?role=pro" className="btn-primary">Créer mon profil gratuitement</Link>
      {/* After logging in, come back here so a customer account can be switched. */}
      <Link href="/connexion?next=/devenir-pro" className="btn-ghost">J’ai déjà un compte</Link>
    </div>
  );
}
