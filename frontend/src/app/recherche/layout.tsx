import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Trouver un pro près de chez vous',
  description: 'Coiffure, tresses, esthétique, ménage, réparations… Comparez les pros de votre quartier, leurs prix et leurs avis.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
