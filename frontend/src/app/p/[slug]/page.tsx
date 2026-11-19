/**
 * /p/<slug> — server part of the public profile page (audit H5).
 * Fetches the published profile on the server so that:
 *   - the HTML already contains the name, services, prices… (Google can index it);
 *   - each profile has its own <title>, description and preview image
 *     (WhatsApp / Facebook / iMessage link previews);
 *   - Google gets structured data (schema.org LocalBusiness).
 * The interactive page itself is ProfileView (client component).
 */
import type { Metadata } from 'next';
import { mediaUrl } from '@/lib/api';
import { SERVER_API_URL, SITE_URL } from '@/lib/site';
import type { ProviderProfile } from '@/lib/types';
import { ProfileView } from './ProfileView';

export const revalidate = 300; // refresh the server copy at most every 5 minutes

/** Public profile, or null (not found, not published, or API asleep → the client fetches it). */
async function fetchProfile(slug: string): Promise<ProviderProfile | null> {
  try {
    const res = await fetch(`${SERVER_API_URL}/providers/${encodeURIComponent(slug)}`, {
      next: { revalidate },
      signal: AbortSignal.timeout(6000), // never hang the page on a sleeping API
    });
    return res.ok ? ((await res.json()) as ProviderProfile) : null;
  } catch {
    return null;
  }
}

const absolute = (url?: string | null) => {
  const u = mediaUrl(url);
  return u ? new URL(u, SITE_URL).toString() : undefined;
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await fetchProfile(slug);
  if (!p) return { title: 'Prestataire', robots: { index: false } };

  const where = [p.neighbourhood, p.city].filter(Boolean).join(', ');
  const cats = [...new Set(p.services.map((s) => s.category.name))].slice(0, 3).join(', ');
  const title = `${p.displayName} — ${cats || 'Services'} à ${p.neighbourhood ?? p.city}`;
  const description = (p.tagline || p.description || `${cats} à ${where}`).replace(/\s+/g, ' ').slice(0, 160);
  const cover = absolute(p.photos[0]?.url);
  return {
    title,
    description,
    alternates: { canonical: `/p/${p.slug}` },
    openGraph: { type: 'profile', title, description, url: `/p/${p.slug}`, images: cover ? [{ url: cover, alt: p.displayName }] : undefined },
    twitter: { card: cover ? 'summary_large_image' : 'summary', title, description, images: cover ? [cover] : undefined },
  };
}

export default async function ProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await fetchProfile(slug);

  // schema.org data for Google (business name, address area, rating, price range).
  const jsonLd = p && {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: p.displayName,
    description: p.description ?? p.tagline ?? undefined,
    url: `${SITE_URL}/p/${p.slug}`,
    image: p.photos.map((ph) => absolute(ph.url)).filter(Boolean),
    telephone: p.phone ?? undefined,
    address: { '@type': 'PostalAddress', addressLocality: p.city, addressRegion: p.neighbourhood ?? undefined, addressCountry: 'CA' },
    geo: { '@type': 'GeoCoordinates', latitude: p.latitude, longitude: p.longitude },
    ...(p.ratingCount > 0 && { aggregateRating: { '@type': 'AggregateRating', ratingValue: p.ratingAvg, reviewCount: p.ratingCount } }),
    ...(p.services.length > 0 && {
      makesOffer: p.services.slice(0, 15).map((s) => ({
        '@type': 'Offer',
        itemOffered: { '@type': 'Service', name: s.name },
        price: (s.priceCents / 100).toFixed(2),
        priceCurrency: 'CAD',
      })),
    }),
  };

  return (
    <>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />}
      <ProfileView slug={slug} initial={p} />
    </>
  );
}
