/** /robots.txt — let search engines index public pages, not private areas (audit H5). */
import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/dashboard', '/compte', '/parametres', '/reinitialiser', '/verifier-email', '/mot-de-passe-oublie'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
