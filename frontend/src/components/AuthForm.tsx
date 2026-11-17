'use client';

/**
 * Shared login / sign-up form.
 * Sign-up asks "client or provider?" first — providers then land on the
 * onboarding steps of their dashboard. `?next=` brings users back to where
 * they were (e.g. a provider profile they wanted to book).
 */
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import type { User } from '@/lib/types';
import { homeFor, useAuth } from './AuthProvider';
import { Alert } from './ui';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const params = useSearchParams();
  const router = useRouter();
  const { signIn } = useAuth();
  const [role, setRole] = useState<'CUSTOMER' | 'PROVIDER'>(params.get('role') === 'pro' ? 'PROVIDER' : 'CUSTOMER');
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', phone: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const body = mode === 'login' ? { email: form.email, password: form.password } : { ...form, phone: form.phone || undefined, role };
      const res = await api.post<{ token: string; user: User }>(`/auth/${mode === 'login' ? 'login' : 'register'}`, body);
      signIn(res.token, res.user);
      const next = params.get('next');
      // Only follow internal paths to avoid open redirects.
      router.push(next?.startsWith('/') && !next.startsWith('//') ? next : homeFor(res.user));
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const nextQs = params.get('next') ? `?next=${encodeURIComponent(params.get('next')!)}` : '';

  return (
    <div className="container-x flex justify-center py-10 md:py-16">
      <div className="w-full max-w-md">
        <h1 className="h-display text-3xl font-extrabold">{mode === 'login' ? 'Bon retour 👋' : 'Créer un compte'}</h1>
        <p className="mt-1 text-sm text-muted">
          {mode === 'login' ? 'Connectez-vous pour gérer vos demandes ou votre activité.' : 'Gratuit, en moins d’une minute.'}
        </p>

        <form onSubmit={submit} className="card mt-6 space-y-4 p-5 md:p-6">
          {mode === 'register' && (
            <fieldset>
              <legend className="label">Je suis…</legend>
              <div className="grid grid-cols-2 gap-2">
                {([
                  ['CUSTOMER', '🙋🏽', 'Client·e', 'Je cherche un service'],
                  ['PROVIDER', '🧑🏾‍🔧', 'Prestataire', 'Je propose mes services'],
                ] as const).map(([r, icon, t, d]) => (
                  <label key={r} className={`cursor-pointer rounded-2xl border p-3 transition ${role === r ? 'border-ink bg-paper ring-1 ring-ink' : 'border-line'}`}>
                    <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="sr-only" />
                    <span className="text-2xl">{icon}</span>
                    <span className="mt-1 block text-sm font-semibold">{t}</span>
                    <span className="block text-xs text-muted">{d}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {mode === 'register' && (
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label" htmlFor="fn">Prénom</label><input id="fn" required className="input" value={form.firstName} onChange={set('firstName')} autoComplete="given-name" /></div>
              <div><label className="label" htmlFor="ln">Nom</label><input id="ln" required className="input" value={form.lastName} onChange={set('lastName')} autoComplete="family-name" /></div>
            </div>
          )}
          <div><label className="label" htmlFor="em">Email</label><input id="em" type="email" required className="input" value={form.email} onChange={set('email')} autoComplete="email" /></div>
          {mode === 'register' && (
            <div><label className="label" htmlFor="ph">Téléphone <span className="text-muted">(facultatif)</span></label><input id="ph" type="tel" className="input" value={form.phone} onChange={set('phone')} autoComplete="tel" /></div>
          )}
          <div>
            <label className="label" htmlFor="pw">Mot de passe</label>
            <input id="pw" type="password" required minLength={mode === 'register' ? 8 : undefined} className="input" value={form.password} onChange={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
            {mode === 'register' && <p className="hint">8 caractères minimum.</p>}
          </div>
          {error && <Alert>{error}</Alert>}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? '…' : mode === 'login' ? 'Se connecter' : role === 'PROVIDER' ? 'Créer mon compte pro' : 'Créer mon compte'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-muted">
          {mode === 'login' ? (
            <>Pas encore de compte ? <Link href={`/inscription${nextQs}`} className="font-semibold text-primary">Inscrivez-vous</Link></>
          ) : (
            <>Déjà inscrit·e ? <Link href={`/connexion${nextQs}`} className="font-semibold text-primary">Connectez-vous</Link></>
          )}
        </p>
      </div>
    </div>
  );
}
