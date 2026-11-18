'use client';

/**
 * Navigation.
 * - Header: logo + role-aware links (desktop), compact on mobile.
 * - BottomNav: thumb-friendly tab bar shown only on small screens — the main
 *   way to move around the app on a phone.
 */
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { homeFor, useAuth } from './AuthProvider';
import { Logo } from './ui';

export function Header() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-paper/85 backdrop-blur">
      <div className="container-x flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav className="hidden items-center gap-1 text-sm font-medium md:flex">
          <Link href="/recherche" className="rounded-full px-3 py-2 hover:bg-line/60">Trouver un pro</Link>
          {!user || user.role === 'CUSTOMER' ? (
            <Link href="/devenir-pro" className="rounded-full px-3 py-2 hover:bg-line/60">Devenir prestataire</Link>
          ) : null}
          {user && (
            <Link href={homeFor(user)} className="rounded-full px-3 py-2 hover:bg-line/60">
              {user.role === 'ADMIN' ? 'Modération' : user.role === 'PROVIDER' ? 'Mon tableau de bord' : 'Mes demandes'}
            </Link>
          )}
          {user?.role === 'PROVIDER' && (
            <Link href="/compte" className="rounded-full px-3 py-2 hover:bg-line/60">Mes réservations</Link>
          )}
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <span className="hidden text-sm text-muted sm:inline">Bonjour {user.firstName}</span>
              <button
                className="btn-ghost btn-sm"
                onClick={() => {
                  signOut();
                  router.push('/');
                }}
              >
                Déconnexion
              </button>
            </>
          ) : (
            <>
              <Link href="/connexion" className="btn-ghost btn-sm">Connexion</Link>
              <Link href="/inscription" className="btn-dark btn-sm hidden sm:inline-flex">Créer un compte</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function BottomNav() {
  const { user } = useAuth();
  const path = usePathname();

  const tabs = [
    { href: '/', label: 'Accueil', icon: HomeIcon },
    { href: '/recherche', label: 'Explorer', icon: SearchIcon },
    user?.role === 'PROVIDER'
      ? { href: '/dashboard', label: 'Mon activité', icon: GridIcon }
      : user?.role === 'ADMIN'
        ? { href: '/admin', label: 'Modération', icon: ShieldIcon }
        : { href: '/compte', label: 'Demandes', icon: CalIcon },
    { href: user ? homeFor(user) : '/connexion', label: user ? 'Compte' : 'Connexion', icon: UserIcon },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Navigation principale">
      <ul className="grid grid-cols-4">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? path === '/' : path.startsWith(href);
          return (
            <li key={label}>
              <Link href={href} className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${active ? 'text-primary' : 'text-muted'}`}>
                <Icon />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// --- inline icons (no icon library needed) ----------------------------------
const I = (d: string) =>
  function Icon() {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={d} />
      </svg>
    );
  };
const HomeIcon = I('M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z');
const SearchIcon = I('M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm10 3-5.2-5.2');
const CalIcon = I('M7 3v3m10-3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z');
const GridIcon = I('M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 0h7v7h-7z');
const ShieldIcon = I('M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z');
const UserIcon = I('M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 9a8 8 0 0 1 16 0');
