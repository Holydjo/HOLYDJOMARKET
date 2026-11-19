/** /sitemap.xml — public pages + every published provider profile (audit H5). */
import type { MetadataRoute } from 'next';
import { SERVER_API_URL, SITE_URL } from '@/lib/site';

export const revalidate = 3600; // rebuilt at most once an hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = ['', '/recherche', '/devenir-pro', '/conditions', '/confidentialite'].map((p) => ({
    url: `${SITE_URL}${p}`,
    changeFrequency: p === '' || p === '/recherche' ? 'daily' : 'monthly',
    priority: p === '' ? 1 : 0.5,
  }));
  try {
    const res = await fetch(`${SERVER_API_URL}/providers/sitemap`, { next: { revalidate }, signal: AbortSignal.timeout(10_000) });
    const profiles = res.ok ? ((await res.json()) as { slug: string; updatedAt: string }[]) : [];
    return [
      ...pages,
      ...profiles.map((p) => ({ url: `${SITE_URL}/p/${p.slug}`, lastModified: new Date(p.updatedAt), changeFrequency: 'weekly' as const, priority: 0.8 })),
    ];
  } catch {
    return pages; // API asleep: the static pages are still listed
  }
}
