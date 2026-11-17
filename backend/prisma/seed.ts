/**
 * Demo data for local development: categories, one admin, a few customers and
 * ~18 providers spread across Montréal neighbourhoods in every moderation state.
 *
 *   npm run db:seed      (idempotent: wipes and recreates everything)
 *
 * All demo accounts share the password below. NEVER run this in production.
 */
import { PrismaClient, ProfileStatus, ProviderKind } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const DEMO_PASSWORD = 'Demo1234!';

const CATEGORIES = [
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

type Svc = [category: string, name: string, priceDollars: number, durationMin: number, from?: boolean];

interface DemoProvider {
  name: string;
  first: string;
  last: string;
  kind: ProviderKind;
  tagline: string;
  description: string;
  neighbourhood: string;
  city: string;
  lat: number;
  lng: number;
  modes: Partial<Record<'atHome' | 'inSalon' | 'inShop' | 'travels', boolean>>;
  travelRadiusKm?: number;
  status?: ProfileStatus;
  rejectionReason?: string;
  services: Svc[];
  photos: string[]; // files in frontend/public/demo
  hours?: 'salon' | 'weekdays' | 'evenings';
}

const PROVIDERS: DemoProvider[] = [
  {
    name: 'Tresses by Awa', first: 'Awa', last: 'Diallo', kind: 'INDEPENDENT',
    tagline: 'Knotless, box braids et twists — chez moi ou chez vous',
    description: "Tresseuse depuis 12 ans, je travaille avec des mèches pré-étirées de qualité et je prends le temps de préserver vos bords. Ambiance calme, thé offert, enfants bienvenus.",
    neighbourhood: 'Montréal-Nord', city: 'Montréal', lat: 45.5951, lng: -73.6311,
    modes: { atHome: true, travels: true }, travelRadiusKm: 12,
    services: [['braids', 'Knotless braids mi-dos', 180, 360, true], ['braids', 'Box braids classiques', 150, 300, true], ['braids', 'Twists sénégalais', 140, 240], ['hair', 'Shampoing + soin hydratant', 35, 45]],
    photos: ['braids-1', 'braids-2', 'braids-3'], hours: 'evenings',
  },
  {
    name: 'Salon Kalinda', first: 'Nadège', last: 'Pierre', kind: 'BUSINESS',
    tagline: 'Salon afro & métissé au cœur de Saint-Michel',
    description: "Salon de quartier spécialisé dans les cheveux texturés : coupes, soins, lissage soyeux, perruques et poses de tissages. Équipe de 4 coiffeuses, sans rendez-vous le samedi matin.",
    neighbourhood: 'Villeray–Saint-Michel–Parc-Extension', city: 'Montréal', lat: 45.5612, lng: -73.6061,
    modes: { inSalon: true },
    services: [['hair', 'Coupe + brushing', 55, 60], ['hair', 'Pose de perruque lace', 90, 90], ['hair', 'Tissage cousu', 120, 180, true], ['braids', 'Cornrows femme', 60, 90]],
    photos: ['hair-1', 'hair-2', 'salon-1'], hours: 'salon',
  },
  {
    name: 'Le Coin du Barbier', first: 'Moussa', last: 'Koné', kind: 'BUSINESS',
    tagline: 'Dégradés précis, barbe à la serviette chaude',
    description: "Barbershop familial depuis 2016. Dégradés, contours, taille de barbe et soins visage pour hommes. Coupe enfant à prix réduit le mercredi.",
    neighbourhood: 'Saint-Léonard', city: 'Montréal', lat: 45.5856, lng: -73.5952,
    modes: { inShop: true },
    services: [['barber', 'Dégradé + contour', 30, 40], ['barber', 'Taille de barbe serviette chaude', 20, 25], ['barber', 'Coupe enfant (-12 ans)', 20, 30]],
    photos: ['barber-1', 'barber-2'], hours: 'salon',
  },
  {
    name: 'Fresh Fade Mobile', first: 'Jordan', last: 'Baptiste', kind: 'INDEPENDENT',
    tagline: 'Le barbier qui vient à vous',
    description: "Je me déplace à domicile ou au bureau avec tout mon matériel désinfecté. Idéal pour les familles, les personnes à mobilité réduite et les mariages.",
    neighbourhood: 'Ahuntsic-Cartierville', city: 'Montréal', lat: 45.5547, lng: -73.6681,
    modes: { travels: true }, travelRadiusKm: 25,
    services: [['barber', 'Coupe à domicile', 45, 45], ['barber', 'Forfait mariage (5 personnes)', 220, 240, true]],
    photos: ['barber-2', 'barber-1'], hours: 'weekdays',
  },
  {
    name: 'Studio Ongles Lumi', first: 'Linh', last: 'Tran', kind: 'BUSINESS',
    tagline: 'Gel, capsules et nail art minimaliste',
    description: "Petit studio lumineux sur Masson. Produits sans HEMA, outils stérilisés à l'autoclave, et des designs sur mesure inspirés de vos idées.",
    neighbourhood: 'Rosemont–La Petite-Patrie', city: 'Montréal', lat: 45.5468, lng: -73.5743,
    modes: { inSalon: true },
    services: [['nails', 'Manucure gel', 45, 60], ['nails', 'Pose capsules + gel', 70, 90], ['nails', 'Nail art (par ongle)', 5, 10, true]],
    photos: ['nails-1', 'nails-2'], hours: 'salon',
  },
  {
    name: 'Glow by Fatou', first: 'Fatou', last: 'Ndiaye', kind: 'INDEPENDENT',
    tagline: 'Soins du visage pour peaux mates et foncées',
    description: "Esthéticienne diplômée, spécialisée dans l'hyperpigmentation et l'acné sur peaux riches en mélanine. Consultation gratuite de 15 minutes avant le premier soin.",
    neighbourhood: 'Côte-des-Neiges', city: 'Montréal', lat: 45.4951, lng: -73.6262,
    modes: { atHome: true },
    services: [['beauty', 'Soin visage éclat', 75, 60], ['beauty', 'Épilation sourcils au fil', 15, 15], ['makeup', 'Maquillage événement', 85, 60]],
    photos: ['beauty-1', 'beauty-2'], hours: 'weekdays',
  },
  {
    name: 'Mariée Radieuse', first: 'Sabrina', last: 'Haddad', kind: 'INDEPENDENT',
    tagline: 'Maquillage mariage & shooting, déplacement inclus',
    description: "Maquilleuse professionnelle pour mariages, baptêmes et séances photo. Je me déplace avec un kit adapté à toutes les carnations.",
    neighbourhood: 'Laval', city: 'Laval', lat: 45.5765, lng: -73.7392,
    modes: { travels: true }, travelRadiusKm: 40,
    services: [['makeup', 'Maquillage mariée + essai', 280, 150, true], ['makeup', 'Maquillage invitée', 80, 45]],
    photos: ['makeup-1', 'beauty-1'], hours: 'weekdays',
  },
  {
    name: 'Propre & Net Services', first: 'Carlos', last: 'Mendes', kind: 'BUSINESS',
    tagline: 'Ménage résidentiel et après-déménagement',
    description: "Équipe assurée de 6 personnes. Produits écologiques fournis. Ménage régulier, grand ménage de printemps, nettoyage après travaux ou déménagement.",
    neighbourhood: 'Verdun', city: 'Montréal', lat: 45.4589, lng: -73.5707,
    modes: { travels: true }, travelRadiusKm: 20,
    services: [['cleaning', 'Ménage régulier (3 h)', 105, 180], ['cleaning', 'Grand ménage 4½', 260, 360, true], ['cleaning', 'Nettoyage fin de bail', 300, 420, true]],
    photos: ['cleaning-1', 'cleaning-2'], hours: 'weekdays',
  },
  {
    name: 'Mme Bien-Aimé — Ménage', first: 'Marie-Lourdes', last: 'Bien-Aimé', kind: 'INDEPENDENT',
    tagline: 'Ménage soigné, fiable, références disponibles',
    description: "Je fais le ménage chez des familles du quartier depuis 9 ans. Repassage possible. Disponible en semaine, de jour.",
    neighbourhood: 'Hochelaga-Maisonneuve', city: 'Montréal', lat: 45.5481, lng: -73.5411,
    modes: { travels: true }, travelRadiusKm: 8,
    services: [['cleaning', 'Ménage à l\'heure', 28, 60], ['cleaning', 'Repassage (panier)', 25, 60]],
    photos: ['cleaning-2'], hours: 'weekdays',
  },
  {
    name: 'Atelier Répar\'Tout', first: 'Yves', last: 'Gagnon', kind: 'BUSINESS',
    tagline: 'Petits travaux, plomberie légère, montage de meubles',
    description: "Homme à tout faire avec 20 ans d'expérience : robinets qui fuient, prises, étagères, montage IKEA, calfeutrage. Devis gratuit par photo.",
    neighbourhood: 'Plateau-Mont-Royal', city: 'Montréal', lat: 45.5239, lng: -73.5826,
    modes: { inShop: true, travels: true }, travelRadiusKm: 15,
    services: [['repairs', 'Montage de meuble', 60, 60, true], ['repairs', 'Réparation robinet / fuite', 90, 60, true], ['repairs', 'Installation luminaire', 75, 45]],
    photos: ['repairs-1', 'repairs-2'], hours: 'weekdays',
  },
  {
    name: 'TechFix Saint-Laurent', first: 'Ali', last: 'Rahimi', kind: 'BUSINESS',
    tagline: 'Écrans de téléphone et laptops réparés en 1 h',
    description: "Boutique de réparation électronique : écrans, batteries, ports de charge, récupération de données. Garantie 6 mois sur les pièces.",
    neighbourhood: 'Saint-Laurent', city: 'Montréal', lat: 45.5103, lng: -73.6889,
    modes: { inShop: true },
    services: [['repairs', 'Remplacement écran iPhone', 129, 60, true], ['repairs', 'Changement batterie laptop', 99, 90, true]],
    photos: ['repairs-2'], hours: 'salon',
  },
  {
    name: 'Couture Mama Grace', first: 'Grace', last: 'Mbuyi', kind: 'INDEPENDENT',
    tagline: 'Retouches et tenues en wax sur mesure',
    description: "Couturière à domicile : ourlets, ajustements, et création de tenues africaines sur mesure pour vos cérémonies. Tissus disponibles sur place.",
    neighbourhood: 'LaSalle', city: 'Montréal', lat: 45.4306, lng: -73.6331,
    modes: { atHome: true },
    services: [['tailoring', 'Ourlet pantalon', 15, 30], ['tailoring', 'Robe wax sur mesure', 140, 600, true]],
    photos: ['tailoring-1'], hours: 'evenings',
  },
  {
    name: 'Déménagement Deux Frères', first: 'Karim', last: 'Benali', kind: 'BUSINESS',
    tagline: 'Camion + 2 déménageurs, prix à l\'heure transparent',
    description: "Petits et moyens déménagements partout sur l'île et la Rive-Sud. Couvertures et diable inclus, aucun frais caché.",
    neighbourhood: 'Longueuil', city: 'Longueuil', lat: 45.5369, lng: -73.5107,
    modes: { travels: true }, travelRadiusKm: 35,
    services: [['moving', 'Camion + 2 déménageurs (heure)', 120, 60], ['moving', 'Livraison d\'un meuble', 80, 60, true]],
    photos: ['moving-1'], hours: 'weekdays',
  },
  {
    name: 'Locs & Love', first: 'Kemi', last: 'Adeyemi', kind: 'INDEPENDENT',
    tagline: 'Départ de locs, retwist et entretien',
    description: "Loctician passionnée : départs de locs (comb coils, two-strand), retwist, réparations et coiffures sur locs. Produits naturels uniquement.",
    neighbourhood: 'Notre-Dame-de-Grâce', city: 'Montréal', lat: 45.4718, lng: -73.6122,
    modes: { atHome: true, travels: true }, travelRadiusKm: 10,
    services: [['braids', 'Départ de locs', 200, 300, true], ['hair', 'Retwist + style', 85, 120]],
    photos: ['braids-3', 'hair-2'], hours: 'evenings',
  },
  {
    name: 'Beauté Brossard', first: 'Mélanie', last: 'Tremblay', kind: 'BUSINESS',
    tagline: 'Spa de quartier — soins, cils et ongles',
    description: "Institut de beauté familial : rehaussement de cils, soins du corps, pédicure spa. Cartes-cadeaux disponibles.",
    neighbourhood: 'Brossard', city: 'Brossard', lat: 45.4621, lng: -73.4609,
    modes: { inSalon: true },
    services: [['beauty', 'Rehaussement de cils', 85, 60], ['nails', 'Pédicure spa', 60, 60]],
    photos: ['beauty-2', 'nails-2'], hours: 'salon',
  },
  // --- not yet public: show up in the admin queue -----------------------------
  {
    name: 'Nappy Queen Studio', first: 'Ruth', last: 'Joseph', kind: 'INDEPENDENT',
    tagline: 'Coiffures protectrices pour enfants',
    description: "Spécialiste des coiffures d'enfants : nattes collées, perles, chignons. Séances courtes et adaptées aux tout-petits, dessins animés à disposition.",
    neighbourhood: 'Montréal-Nord', city: 'Montréal', lat: 45.5902, lng: -73.6402,
    modes: { atHome: true }, status: 'PENDING',
    services: [['braids', 'Nattes collées enfant', 50, 90]], photos: ['braids-2'], hours: 'evenings',
  },
  {
    name: 'Clean Team Laval', first: 'Patrick', last: 'Ouellet', kind: 'BUSINESS',
    tagline: 'Ménage commercial et résidentiel',
    description: "Entreprise de nettoyage pour bureaux, commerces et condos. Contrats hebdomadaires ou ponctuels, équipe bilingue.",
    neighbourhood: 'Laval', city: 'Laval', lat: 45.5590, lng: -73.7110,
    modes: { travels: true }, travelRadiusKm: 30, status: 'PENDING',
    services: [['cleaning', 'Nettoyage de bureau', 150, 180, true]], photos: ['cleaning-1'], hours: 'weekdays',
  },
  {
    name: 'Bricolo Express', first: 'Dan', last: 'Lavoie', kind: 'INDEPENDENT',
    tagline: 'Tout réparer',
    description: "Je répare tout.",
    neighbourhood: 'Verdun', city: 'Montréal', lat: 45.4540, lng: -73.5680,
    modes: { travels: true }, travelRadiusKm: 10, status: 'REJECTED',
    rejectionReason: 'La description est trop courte et les photos ne montrent pas vos travaux. Ajoutez des exemples de réalisations.',
    services: [['repairs', 'Réparations diverses', 50, 60, true]], photos: ['repairs-1'], hours: 'weekdays',
  },
];

const HOURS = {
  salon: { open: [2, 3, 4, 5, 6], from: '09:00', to: '18:00' },
  weekdays: { open: [1, 2, 3, 4, 5], from: '08:00', to: '17:00' },
  evenings: { open: [1, 2, 3, 4, 5, 6], from: '16:00', to: '21:00' },
};

const REVIEW_TEXTS = [
  [5, 'Travail impeccable, très professionnelle et à l\'heure. Je recommande les yeux fermés !'],
  [5, 'Accueil chaleureux et résultat au-delà de mes attentes.'],
  [4, 'Très bon service, juste un peu d\'attente au début.'],
  [5, 'Enfin quelqu\'un de fiable dans le quartier. Merci !'],
  [4, 'Bon rapport qualité-prix, je reviendrai.'],
] as const;

function slugify(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function main() {
  // Safety net: this script deletes everything. Refuse on production unless explicitly allowed
  // (e.g. ALLOW_DEMO_SEED=true on a staging server you want to fill with demo data).
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== 'true') {
    throw new Error('Refusing to wipe a production database. Set ALLOW_DEMO_SEED=true to seed a staging server.');
  }

  // Clean slate (children first because of foreign keys).
  await prisma.moderationLog.deleteMany();
  await prisma.review.deleteMany();
  await prisma.appointmentRequest.deleteMany();
  await prisma.photo.deleteMany();
  await prisma.openingHours.deleteMany();
  await prisma.service.deleteMany();
  await prisma.providerProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.category.deleteMany();

  const password = await bcrypt.hash(DEMO_PASSWORD, 10);

  const cats = new Map<string, string>();
  for (const [i, c] of CATEGORIES.entries()) {
    const created = await prisma.category.create({ data: { ...c, order: i } });
    cats.set(c.slug, created.id);
  }

  const admin = await prisma.user.create({
    data: { email: 'admin@holydo.test', password, firstName: 'Admin', lastName: 'Holydo', role: 'ADMIN' },
  });

  const customers = await Promise.all(
    [['client', 'Inès', 'Moreau'], ['amina', 'Amina', 'Sow'], ['marc', 'Marc', 'Lefebvre'], ['jade', 'Jade', 'Nguyen']].map(
      ([handle, firstName, lastName]) =>
        prisma.user.create({ data: { email: `${handle}@holydo.test`, password, firstName, lastName, role: 'CUSTOMER' } }),
    ),
  );

  for (const [i, p] of PROVIDERS.entries()) {
    const status = p.status ?? 'APPROVED';
    const user = await prisma.user.create({
      data: {
        email: `${slugify(p.first)}@holydo.test`,
        password,
        firstName: p.first,
        lastName: p.last,
        role: 'PROVIDER',
        phone: `514-555-${String(1000 + i * 37).slice(-4)}`,
      },
    });
    const hours = HOURS[p.hours ?? 'weekdays'];
    const daysAgo = (n: number) => new Date(Date.now() - n * 86400_000);

    const profile = await prisma.providerProfile.create({
      data: {
        userId: user.id,
        slug: slugify(p.name),
        kind: p.kind,
        displayName: p.name,
        tagline: p.tagline,
        description: p.description,
        phone: user.phone,
        whatsapp: p.kind === 'INDEPENDENT' ? user.phone : null,
        neighbourhood: p.neighbourhood,
        city: p.city,
        latitude: p.lat,
        longitude: p.lng,
        ...p.modes,
        travelRadiusKm: p.travelRadiusKm ?? 0,
        status,
        submittedAt: status === 'DRAFT' ? null : daysAgo(3 + i),
        approvedAt: status === 'APPROVED' ? daysAgo(1 + i) : null,
        rejectionReason: p.rejectionReason,
        services: {
          create: p.services.map(([cat, name, price, durationMin, from]) => ({
            categoryId: cats.get(cat)!,
            name,
            priceCents: price * 100,
            durationMin,
            priceFrom: !!from,
          })),
        },
        photos: { create: p.photos.map((f, order) => ({ url: `/demo/${f}.svg`, order, isCover: order === 0 })) },
        openingHours: {
          create: [0, 1, 2, 3, 4, 5, 6].map((weekday) => {
            const open = hours.open.includes(weekday);
            return { weekday, closed: !open, opensAt: open ? hours.from : null, closesAt: open ? hours.to : null };
          }),
        },
      },
    });

    if (status === 'APPROVED' || status === 'REJECTED') {
      await prisma.moderationLog.create({
        data: { profileId: profile.id, adminId: admin.id, action: status, reason: p.rejectionReason },
      });
    }

    // Approved providers get a couple of accepted appointments + reviews so ratings look real.
    if (status === 'APPROVED') {
      const n = (i % 3) + 2;
      for (let k = 0; k < n; k++) {
        const customer = customers[(i + k) % customers.length];
        const [rating, comment] = REVIEW_TEXTS[(i + k) % REVIEW_TEXTS.length];
        await prisma.appointmentRequest.create({
          data: { profileId: profile.id, customerId: customer.id, requestedAt: daysAgo(10 + k), status: 'ACCEPTED' },
        });
        await prisma.review.create({ data: { profileId: profile.id, authorId: customer.id, rating, comment, createdAt: daysAgo(8 + k) } });
      }
      const agg = await prisma.review.aggregate({ where: { profileId: profile.id }, _avg: { rating: true }, _count: true });
      await prisma.providerProfile.update({
        where: { id: profile.id },
        data: { ratingAvg: Math.round((agg._avg.rating ?? 0) * 10) / 10, ratingCount: agg._count },
      });
    }
  }

  // One pending request so the first provider's dashboard isn't empty.
  const awa = await prisma.providerProfile.findUniqueOrThrow({ where: { slug: 'tresses-by-awa' }, include: { services: true } });
  await prisma.appointmentRequest.create({
    data: {
      profileId: awa.id,
      customerId: customers[0].id,
      serviceId: awa.services[0].id,
      requestedAt: new Date(Date.now() + 4 * 86400_000),
      message: 'Bonjour ! Je voudrais des knotless mi-dos, couleur 1B. Est-ce possible samedi après-midi ?',
    },
  });

  console.log(`Seeded ${CATEGORIES.length} categories, ${PROVIDERS.length} providers. Demo password: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
