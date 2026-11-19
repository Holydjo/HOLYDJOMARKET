'use client';

/** /verifier-email?token=… — opened from the "confirm your email" message. */
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { homeFor, useAuth } from '@/components/AuthProvider';
import { Alert, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import type { User } from '@/lib/types';

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <Verify />
    </Suspense>
  );
}

function Verify() {
  const token = useSearchParams().get('token') ?? '';
  const { signIn } = useAuth();
  const [state, setState] = useState<{ user?: User; error?: string } | null>(null);
  const started = useRef(false); // the link is single-use: never call twice (React dev mode runs effects twice)

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!token) {
      setTimeout(() => setState({ error: 'Lien incomplet. Ouvrez le lien reçu par email.' }), 0);
      return;
    }
    api
      .post<{ token: string; user: User }>('/auth/verify-email', { token })
      .then((r) => {
        signIn(r.token, r.user);
        setState({ user: r.user });
      })
      .catch((e) => setState({ error: e.message }));
  }, [token, signIn]);

  return (
    <div className="container-x flex justify-center py-10 md:py-16">
      <div className="card w-full max-w-md space-y-4 p-6 text-center">
        {!state && <Spinner label="Confirmation de votre adresse…" />}
        {state?.user && (
          <>
            <div className="text-4xl">✅</div>
            <h1 className="h-display text-2xl font-extrabold">Adresse confirmée</h1>
            <p className="text-sm text-muted">Merci {state.user.firstName}, votre compte est actif.</p>
            <Link href={homeFor(state.user)} className="btn-primary w-full">
              {state.user.role === 'PROVIDER' ? 'Compléter mon profil' : 'Trouver un pro'}
            </Link>
          </>
        )}
        {state?.error && (
          <>
            <h1 className="h-display text-2xl font-extrabold">Lien non valide</h1>
            <Alert>{state.error}</Alert>
            <Link href="/connexion" className="btn-ghost w-full">Me connecter</Link>
          </>
        )}
      </div>
    </div>
  );
}
