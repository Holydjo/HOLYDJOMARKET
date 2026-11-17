/** Small presentational building blocks shared across pages. */
import Link from 'next/link';
import { mediaUrl } from '@/lib/api';

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="HOLYDO MARKET — accueil">
      {/* Mark: a map pin made of two overlapping rounded shapes = "local" + "market stall" */}
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
        <path d="M16 2c6.6 0 12 5.2 12 11.7C28 22 16 30 16 30S4 22 4 13.7C4 7.2 9.4 2 16 2Z" fill="var(--primary)" />
        <path d="M10 12h12l-1.4 4.6a2 2 0 0 1-1.9 1.4h-5.4a2 2 0 0 1-1.9-1.4L10 12Zm2.5-2.5a3.5 3.5 0 0 1 7 0" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className={`h-display text-[17px] font-extrabold leading-none ${light ? 'text-white' : ''}`}>
        HOLYDO<span className="text-primary"> MARKET</span>
      </span>
    </Link>
  );
}

export function Stars({ value, count, size = 'sm' }: { value: number; count?: number; size?: 'sm' | 'lg' }) {
  if (!count) return <span className="text-xs text-muted">Nouveau</span>;
  return (
    <span className={`inline-flex items-center gap-1 font-semibold ${size === 'lg' ? 'text-base' : 'text-xs'}`}>
      <span className="text-saffron" aria-hidden>★</span>
      {value.toFixed(1)}
      <span className="font-normal text-muted">({count})</span>
    </span>
  );
}

export function Cover({ url, alt, className = '' }: { url?: string | null; alt: string; className?: string }) {
  const src = mediaUrl(url);
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- images come from user uploads on another origin
    <img src={src} alt={alt} className={`object-cover ${className}`} loading="lazy" />
  ) : (
    <div className={`grid place-items-center bg-primary-soft text-3xl ${className}`} aria-label={alt}>🏪</div>
  );
}

export function Spinner({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-muted" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-primary" />
      {label}
    </div>
  );
}

export function Alert({ tone = 'error', children }: { tone?: 'error' | 'info' | 'success'; children: React.ReactNode }) {
  const cls = { error: 'bg-danger-soft text-danger', info: 'bg-primary-soft text-ink', success: 'bg-green-soft text-green' }[tone];
  return <div className={`rounded-2xl px-4 py-3 text-sm ${cls}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>;
}

export function Empty({ icon, title, children }: { icon: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 text-4xl">{icon}</div>
      <h3 className="h-display text-lg font-bold">{title}</h3>
      {children && <div className="mt-2 max-w-sm text-sm text-muted">{children}</div>}
    </div>
  );
}
