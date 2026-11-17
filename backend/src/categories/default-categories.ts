/**
 * The service categories offered on HOLYDJO MARKET.
 * Single source of truth: created/updated automatically when the API starts
 * (see CategoriesModule) and reused by the demo seed. To add a category,
 * add a line here and redeploy. Never change an existing `slug` (used in URLs).
 */
export const DEFAULT_CATEGORIES = [
  { slug: 'hair', name: 'Coiffure', icon: '💇🏾' },
  { slug: 'braids', name: 'Tresses', icon: '🪮' },
  { slug: 'barber', name: 'Barbier', icon: '💈' },
  { slug: 'beauty', name: 'Esthétique', icon: '✨' },
  { slug: 'nails', name: 'Ongles', icon: '💅🏽' },
  { slug: 'makeup', name: 'Maquillage', icon: '💄' },
  { slug: 'cleaning', name: 'Ménage', icon: '🧽' },
  { slug: 'repairs', name: 'Réparations', icon: '🛠️' },
  { slug: 'moving', name: 'Déménagement', icon: '📦' },
  { slug: 'tailoring', name: 'Couture', icon: '🧵' },
];
