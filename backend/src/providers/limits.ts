import { ProviderKind } from '@prisma/client';

/**
 * How much a provider can list. Kept in one place so it's easy to tune.
 *
 * - categories: distinct categories across all of a profile's services.
 *   Keeps profiles focused on a trade ("touche-à-tout" profiles hurt trust
 *   and search quality). An independent with another activity can open a
 *   separate profile.
 * - services: price lines (e.g. "Knotless 180 $", "Box braids 150 $").
 *
 * Paused services count too (they can be reactivated at any time).
 * Profiles created before these limits keep what they have; they just
 * can't add beyond the limit.
 */
export const LIMITS: Record<ProviderKind, { categories: number; services: number }> = {
  INDEPENDENT: { categories: 2, services: 15 },
  BUSINESS: { categories: 3, services: 25 },
};

export const KIND_PLURAL: Record<ProviderKind, string> = {
  INDEPENDENT: 'Les indépendant·e·s',
  BUSINESS: 'Les entreprises',
};
