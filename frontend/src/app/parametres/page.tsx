'use client';

/**
 * "Mon compte" — /parametres (every role).
 * 1. Personal details (first name, last name, phone). Email is read-only.
 * 2. Change password (current password required; other sessions are signed out).
 * 3. Delete account (password + typed confirmation) — Loi 25 right to erasure.
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { homeFor, useAuth } from '@/components/AuthProvider';
import { RequireRole } from '@/components/RequireRole';
import { Alert } from '@/components/ui';
import { api } from '@/lib/api';
import type { User } from '@/lib/types';

export default function SettingsPage() {
  return (
    <RequireRole role={['CUSTOMER', 'PROVIDER', 'ADMIN']}>
      <Settings />
    </RequireRole>
  );
}

type Msg = { tone: 'error' | 'success'; text: string } | null;

function Settings() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="container-x max-w-2xl space-y-6 py-8">
      <div>
        <h1 className="h-display text-3xl font-extrabold">Mon compte</h1>
        <p className="mt-1 text-sm text-muted">
          {user.role === 'PROVIDER' ? (
            <>Vos informations personnelles. Votre profil public se modifie dans votre <Link href="/dashboard" className="font-semibold text-primary">tableau de bord</Link>.</>
          ) : (
            <>Vos informations personnelles et la sécurité de votre compte. <Link href={homeFor(user)} className="font-semibold text-primary">Retour à mon espace</Link></>
          )}
        </p>
      </div>
      <Details user={user} />
      <Password />
      <DeleteAccount user={user} />
    </div>
  );
}

function Details({ user }: { user: User }) {
  const { updateUser } = useAuth();
  const [f, setF] = useState({ firstName: user.firstName, lastName: user.lastName, phone: user.phone ?? '' });
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      const u = await api.patch<User>('/auth/me', f);
      updateUser(u);
      setF({ firstName: u.firstName, lastName: u.lastName, phone: u.phone ?? '' }); // shows the normalised phone
      setMsg({ tone: 'success', text: 'Informations enregistrées ✓' });
    } catch (err) {
      setMsg({ tone: 'error', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="card space-y-4 p-5 md:p-6">
      <h2 className="h-display text-lg font-bold">Mes informations</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label" htmlFor="fn">Prénom</label><input id="fn" required maxLength={60} className="input" value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} autoComplete="given-name" /></div>
        <div><label className="label" htmlFor="ln">Nom</label><input id="ln" required maxLength={60} className="input" value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} autoComplete="family-name" /></div>
      </div>
      <div>
        <label className="label" htmlFor="em">Email</label>
        <input id="em" className="input bg-paper text-muted" value={user.email} readOnly aria-describedby="em-hint" />
        <p id="em-hint" className="hint">Pour changer d’adresse email, contactez-nous.</p>
      </div>
      <div>
        <label className="label" htmlFor="ph">Téléphone <span className="text-muted">(facultatif)</span></label>
        <input id="ph" type="tel" inputMode="tel" className="input" placeholder="514-555-1234" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} autoComplete="tel" />
      </div>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <button className="btn-primary" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
    </form>
  );
}

function Password() {
  const { signIn } = useAuth();
  const [f, setF] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (f.newPassword !== f.confirm) return setMsg({ tone: 'error', text: 'Les deux nouveaux mots de passe ne correspondent pas.' });
    setBusy(true);
    try {
      const r = await api.post<{ token: string; user: User }>('/auth/change-password', { currentPassword: f.currentPassword, newPassword: f.newPassword });
      signIn(r.token, r.user); // keep this session; the other devices are signed out
      setF({ currentPassword: '', newPassword: '', confirm: '' });
      setMsg({ tone: 'success', text: 'Mot de passe modifié ✓ Vos autres appareils ont été déconnectés.' });
    } catch (err) {
      setMsg({ tone: 'error', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="card space-y-4 p-5 md:p-6">
      <h2 className="h-display text-lg font-bold">Mot de passe</h2>
      <div><label className="label" htmlFor="cp">Mot de passe actuel</label><input id="cp" type="password" required className="input" value={f.currentPassword} onChange={(e) => setF({ ...f, currentPassword: e.target.value })} autoComplete="current-password" /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label" htmlFor="np">Nouveau mot de passe</label><input id="np" type="password" required minLength={8} className="input" value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} autoComplete="new-password" /></div>
        <div><label className="label" htmlFor="np2">Confirmer</label><input id="np2" type="password" required minLength={8} className="input" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} autoComplete="new-password" /></div>
      </div>
      <p className="hint -mt-2">8 caractères minimum.</p>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <button className="btn-dark" disabled={busy}>{busy ? '…' : 'Changer le mot de passe'}</button>
    </form>
  );
}

const CONFIRM_WORD = 'SUPPRIMER';

function DeleteAccount({ user }: { user: User }) {
  const { signOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [word, setWord] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user.role === 'ADMIN') {
    return (
      <div className="card p-5 md:p-6">
        <h2 className="h-display text-lg font-bold">Supprimer mon compte</h2>
        <p className="mt-1 text-sm text-muted">Un compte administrateur ne peut pas se supprimer lui-même : demandez à un autre administrateur.</p>
      </div>
    );
  }

  async function remove(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.post('/auth/delete-account', { password });
      signOut();
      try {
        sessionStorage.setItem('holydjo_account_deleted', '1'); // the home page shows a confirmation
      } catch {}
      router.push('/');
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="card border-danger/30 p-5 md:p-6">
      <h2 className="h-display text-lg font-bold text-danger">Supprimer mon compte</h2>
      <p className="mt-1 text-sm text-muted">
        Suppression définitive de votre compte
        {user.role === 'PROVIDER' ? ', de votre profil public, de vos services, photos et horaires' : ''}, de vos demandes de rendez-vous et de
        vos avis. Cette action est irréversible.
      </p>
      {!open ? (
        <button onClick={() => setOpen(true)} className="btn-ghost btn-sm mt-4 text-danger">Supprimer mon compte…</button>
      ) : (
        <form onSubmit={remove} className="mt-4 space-y-3">
          <div><label className="label" htmlFor="dp">Votre mot de passe</label><input id="dp" type="password" required className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></div>
          <div>
            <label className="label" htmlFor="dw">Tapez <strong>{CONFIRM_WORD}</strong> pour confirmer</label>
            <input id="dw" className="input" value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" />
          </div>
          {error && <Alert>{error}</Alert>}
          <div className="flex gap-2">
            <button className="btn btn-sm bg-danger text-white" disabled={busy || word.trim().toUpperCase() !== CONFIRM_WORD || !password}>
              {busy ? '…' : 'Supprimer définitivement'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost btn-sm">Annuler</button>
          </div>
        </form>
      )}
    </div>
  );
}
