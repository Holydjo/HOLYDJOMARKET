import { LEGAL, LEGAL_REVIEWED } from '@/lib/legal';

/** Shared layout for the terms and privacy pages: readable column + section list. */
export function LegalPage({ title, intro, sections }: { title: string; intro: string; sections: { h: string; p: React.ReactNode[] }[] }) {
  return (
    <div className="container-x max-w-3xl py-10 md:py-14">
      {!LEGAL_REVIEWED && (
        <div className="mb-6 rounded-2xl bg-saffron/20 px-4 py-3 text-sm text-[#7a5205]">
          <strong>Projet de document.</strong> Ce texte doit être complété et validé par un professionnel du droit avant le lancement public.
        </div>
      )}
      <h1 className="h-display text-3xl font-extrabold md:text-4xl">{title}</h1>
      <p className="mt-2 text-sm text-muted">Dernière mise à jour : {LEGAL.updatedAt}</p>
      <p className="mt-6 leading-relaxed">{intro}</p>
      <ol className="mt-8 space-y-8">
        {sections.map((s, i) => (
          <li key={s.h}>
            <h2 className="h-display text-xl font-bold">{i + 1}. {s.h}</h2>
            <div className="mt-2 space-y-3 leading-relaxed text-ink/85">
              {s.p.map((para, j) => <p key={j}>{para}</p>)}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
