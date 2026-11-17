'use client';

/**
 * Provider dashboard — /dashboard
 * Doubles as the onboarding flow: a brand-new provider only sees the
 * "Profil" step; once the profile exists, the other tabs unlock and the
 * overview shows a checklist + the "Soumettre pour validation" button.
 */
import { useCallback, useEffect, useState } from 'react';
import { RequireRole } from '@/components/RequireRole';
import { Overview } from '@/components/dashboard/Overview';
import { ProfileForm } from '@/components/dashboard/ProfileForm';
import { ServicesEditor } from '@/components/dashboard/ServicesEditor';
import { PhotosEditor } from '@/components/dashboard/PhotosEditor';
import { HoursEditor } from '@/components/dashboard/HoursEditor';
import { Requests } from '@/components/dashboard/Requests';
import { Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { PROFILE_STATUS } from '@/lib/labels';
import type { ProviderProfile } from '@/lib/types';

export type Tab = 'overview' | 'profile' | 'services' | 'photos' | 'hours' | 'requests';
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Aperçu', icon: '◎' },
  { id: 'requests', label: 'Demandes', icon: '📅' },
  { id: 'profile', label: 'Profil', icon: '👤' },
  { id: 'services', label: 'Services', icon: '🏷️' },
  { id: 'photos', label: 'Photos', icon: '📷' },
  { id: 'hours', label: 'Horaires', icon: '🕘' },
];

export default function DashboardPage() {
  return (
    <RequireRole role="PROVIDER">
      <Dashboard />
    </RequireRole>
  );
}

function Dashboard() {
  const [profile, setProfile] = useState<ProviderProfile | null | undefined>(undefined);
  const [tab, setTabState] = useState<Tab>('overview');
  // Switching section scrolls back to the top so the new content is visible on phones.
  const setTab = useCallback((t: Tab) => {
    setTabState(t);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const reload = useCallback(() => api.get<ProviderProfile | null>('/me/profile').then((p) => setProfile(p ?? null)), []);
  useEffect(() => { reload(); }, [reload]);

  if (profile === undefined) return <Spinner />;

  // ---------- first visit: onboarding step 1 ----------
  if (!profile) {
    return (
      <div className="container-x max-w-3xl py-8">
        <Steps current={1} />
        <h1 className="h-display mt-6 text-3xl font-extrabold">Créons votre profil</h1>
        <p className="mt-1 text-sm text-muted">Commencez par l’essentiel. Vous ajouterez ensuite vos services, photos et horaires.</p>
        <div className="mt-6">
          <ProfileForm profile={null} onSaved={() => reload().then(() => setTab('services'))} />
        </div>
      </div>
    );
  }

  const status = PROFILE_STATUS[profile.status];
  return (
    <div className="container-x py-6 md:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Mon activité</p>
          <h1 className="h-display text-2xl font-extrabold md:text-3xl">{profile.displayName}</h1>
        </div>
        <span className={`badge ${status.tone} text-xs`}>{status.label}</span>
      </div>

      <div className="mt-5 grid gap-6 md:grid-cols-[200px_1fr]">
        {/* tabs: horizontal scroll on mobile, vertical list on desktop */}
        <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-col md:px-0" aria-label="Sections du tableau de bord">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`chip md:justify-start md:rounded-2xl md:px-4 md:py-3 md:text-sm ${tab === t.id ? 'chip-on' : ''}`}
            >
              <span aria-hidden>{t.icon}</span> {t.label}
            </button>
          ))}
        </nav>
        <section className="min-w-0">
          {tab === 'overview' && <Overview profile={profile} onChange={reload} goTo={setTab} />}
          {tab === 'requests' && <Requests />}
          {tab === 'profile' && <ProfileForm profile={profile} onSaved={reload} />}
          {tab === 'services' && <ServicesEditor profile={profile} onChange={reload} />}
          {tab === 'photos' && <PhotosEditor profile={profile} onChange={reload} />}
          {tab === 'hours' && <HoursEditor profile={profile} onChange={reload} />}
        </section>
      </div>
    </div>
  );
}

function Steps({ current }: { current: number }) {
  const steps = ['Profil', 'Services & photos', 'Validation'];
  return (
    <ol className="flex items-center gap-2 text-xs font-medium">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span className={`grid h-6 w-6 place-items-center rounded-full ${i + 1 <= current ? 'bg-primary text-white' : 'bg-line text-muted'}`}>{i + 1}</span>
          <span className={i + 1 === current ? '' : 'text-muted'}>{s}</span>
          {i < steps.length - 1 && <span className="h-px w-6 bg-line" />}
        </li>
      ))}
    </ol>
  );
}
