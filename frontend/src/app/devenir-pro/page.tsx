import Link from 'next/link';

export const metadata = { title: 'Devenir prestataire' };

/** Marketing page for providers — explains the 3 steps and the approval process. */
export default function BecomeProvider() {
  const steps = [
    { icon: '✍️', t: 'Créez votre compte', d: 'Gratuit. Indiquez si vous êtes indépendant·e ou une entreprise.' },
    { icon: '🧾', t: 'Complétez votre profil', d: 'Services et prix, photos de vos réalisations, horaires, quartier et zone de déplacement.' },
    { icon: '🛡️', t: 'Validation par notre équipe', d: 'Nous vérifions chaque profil (en général sous 48 h) pour garder la confiance des clients.' },
    { icon: '📅', t: 'Recevez des demandes', d: 'Acceptez ou refusez les rendez-vous depuis votre tableau de bord, sur téléphone ou ordinateur.' },
  ];
  return (
    <div className="container-x py-10 md:py-16">
      <div className="max-w-2xl">
        <p className="badge mb-4 bg-green-soft text-green">Gratuit pour démarrer</p>
        <h1 className="h-display text-4xl font-extrabold leading-tight md:text-6xl">Votre savoir-faire mérite d’être trouvé.</h1>
        <p className="mt-4 text-lg text-muted">
          HOLYDJO MARKET met en avant les indépendants et les petites entreprises auprès des habitants de leur quartier.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/inscription?role=pro" className="btn-primary">Créer mon profil gratuitement</Link>
          <Link href="/connexion" className="btn-ghost">J’ai déjà un compte</Link>
        </div>
      </div>
      <ol className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.t} className="card p-6">
            <div className="flex items-center justify-between">
              <span className="text-3xl">{s.icon}</span>
              <span className="h-display text-4xl font-extrabold text-line">{i + 1}</span>
            </div>
            <h2 className="h-display mt-6 text-lg font-bold">{s.t}</h2>
            <p className="mt-1 text-sm text-muted">{s.d}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
