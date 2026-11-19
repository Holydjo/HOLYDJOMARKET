/**
 * Public addresses used for SEO (canonical URLs, sitemap, link previews).
 * - NEXT_PUBLIC_SITE_URL: set it once you have a domain (e.g. https://holydjomarket.com).
 * - Otherwise on Vercel: the production URL Vercel provides automatically.
 * - Locally: http://localhost:4000.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:4000')
).replace(/\/$/, '');

/** API address for server-side fetches (Server Components, sitemap). */
export const SERVER_API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001').replace(/\/$/, '');
