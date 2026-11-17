import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, DM_Sans } from 'next/font/google';
import { AuthProvider } from '@/components/AuthProvider';
import { BottomNav, Header } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import './globals.css';

// Display face for headings (characterful, local-market feel) + a clean body face.
const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', weight: ['600', '700', '800'] });
const body = DM_Sans({ subsets: ['latin'], variable: '--font-body' });

export const metadata: Metadata = {
  title: { default: 'HOLYDO MARKET — Les pros de votre quartier', template: '%s · HOLYDO MARKET' },
  description:
    'Trouvez coiffeuses, tresseuses, esthéticiennes, ménage et réparations près de chez vous. Comparez les profils, les prix et réservez.',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = { themeColor: '#c8502a', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-dvh">
        <AuthProvider>
          <Header />
          {/* pb-24 leaves room for the mobile bottom navigation */}
          <main className="pb-24 md:pb-0">{children}</main>
          <Footer />
          <BottomNav />
        </AuthProvider>
      </body>
    </html>
  );
}
