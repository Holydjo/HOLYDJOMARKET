import Link from 'next/link';
import { Logo } from './ui';

export function Footer() {
  return (
    <footer className="mt-20 border-t border-line bg-card pb-20 md:pb-0">
      <div className="container-x hidden gap-8 py-12 md:grid md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-3 max-w-sm text-sm text-muted">
            La place de marché des petites entreprises et des indépendants de votre quartier. Profils vérifiés par notre équipe avant publication.
          </p>
        </div>
        <div className="text-sm">
          <p className="mb-3 font-semibold">Clients</p>
          <ul className="space-y-2 text-muted">
            <li><Link href="/recherche">Trouver un pro</Link></li>
            <li><Link href="/compte">Mes demandes</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="mb-3 font-semibold">Prestataires</p>
          <ul className="space-y-2 text-muted">
            <li><Link href="/devenir-pro">Devenir prestataire</Link></li>
            <li><Link href="/dashboard">Tableau de bord</Link></li>
          </ul>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-line py-5 text-xs text-muted">
        <span>© {new Date().getFullYear()} HOLYDJO MARKET</span>
        <Link href="/conditions" className="hover:text-ink">Conditions d’utilisation</Link>
        <Link href="/confidentialite" className="hover:text-ink">Confidentialité</Link>
      </div>
    </footer>
  );
}
