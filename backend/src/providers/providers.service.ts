import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { boundingBox, distanceKm, slugify } from '../common/geo';
import { findPlace } from '../common/places';
import { AuthUser } from '../common/auth.decorators';
import { GeocodingService } from '../geo/geocoding.service';
import { Notifier } from '../mail/notifier';
import { PrismaService } from '../prisma/prisma.service';
import { OpeningHoursDto, SearchQueryDto, ServiceDto, UpsertProfileDto } from './dto/provider.dto';

/** Relations loaded for a full profile page. */
const FULL_PROFILE = {
  services: { where: { isActive: true }, include: { category: true }, orderBy: { priceCents: 'asc' } },
  photos: { orderBy: [{ isCover: 'desc' }, { order: 'asc' }] },
  openingHours: { orderBy: { weekday: 'asc' } },
  reviews: {
    orderBy: { createdAt: 'desc' },
    take: 30,
    include: { author: { select: { firstName: true, lastName: true } } },
  },
} satisfies Prisma.ProviderProfileInclude;

/** Fields whose change on an APPROVED profile sends it back to admin review. */
const SENSITIVE_FIELDS: (keyof UpsertProfileDto)[] = ['displayName', 'kind'];

const DEFAULT_RADIUS_KM = 15;

const logError = (e: Error) => console.error('[Mail]', e.message);

@Injectable()
export class ProvidersService {
  constructor(
    private prisma: PrismaService,
    private notify: Notifier,
    private geo: GeocodingService,
  ) {}

  // ===========================================================================
  // PUBLIC — search & profile page
  // ===========================================================================

  /**
   * Location-based search.
   * 1. Resolve a search centre: explicit lat/lng (GPS or a picked suggestion)
   *    > typed place (built-in list, then OpenStreetMap geocoding) > none.
   * 2. SQL: approved profiles, matching category/kind/mode/text, inside a
   *    bounding box around the centre (radius + 100 km margin so travelling
   *    providers further away can still be found, then filtered precisely).
   * 3. Node: exact distance, keep those within radius OR whose travel area
   *    reaches the customer, then sort.
   */
  async search(q: SearchQueryDto) {
    const radius = q.radiusKm ?? DEFAULT_RADIUS_KM;
    let center: { lat: number; lng: number; label: string } | null = null;
    if (q.lat != null && q.lng != null) center = { lat: q.lat, lng: q.lng, label: 'Ma position' };
    else if (q.place?.trim()) {
      const p = findPlace(q.place);
      if (p) center = { lat: p.lat, lng: p.lng, label: p.name };
      else {
        const g = await this.geo.resolve(q.place);
        if (g) center = { lat: g.lat, lng: g.lng, label: g.label };
      }
    }
    if (center && q.label) center.label = q.label;

    const where: Prisma.ProviderProfileWhereInput = { status: 'APPROVED' };
    if (q.kind) where.kind = q.kind;
    if (q.mode) (where as any)[q.mode] = true;

    // Service-level filters: provider must have at least one active service that matches.
    const serviceFilter: Prisma.ServiceWhereInput = { isActive: true };
    if (q.category) serviceFilter.category = { slug: q.category };
    if (q.maxPrice != null) serviceFilter.priceCents = { lte: q.maxPrice * 100 };
    if (q.category || q.maxPrice != null) where.services = { some: serviceFilter };

    if (q.q?.trim()) {
      const text = q.q.trim();
      where.OR = [
        { displayName: { contains: text, mode: 'insensitive' } },
        { tagline: { contains: text, mode: 'insensitive' } },
        { neighbourhood: { contains: text, mode: 'insensitive' } },
        { services: { some: { isActive: true, name: { contains: text, mode: 'insensitive' } } } },
      ];
    }
    // No GPS and the place isn't in our list → treat it as a city/neighbourhood text match.
    if (!center && q.place?.trim()) {
      where.AND = [
        {
          OR: [
            { city: { contains: q.place.trim(), mode: 'insensitive' } },
            { neighbourhood: { contains: q.place.trim(), mode: 'insensitive' } },
          ],
        },
      ];
    }
    if (center) {
      const box = boundingBox(center.lat, center.lng, radius + 100);
      where.latitude = { gte: box.minLat, lte: box.maxLat };
      where.longitude = { gte: box.minLng, lte: box.maxLng };
    }

    const rows = await this.prisma.providerProfile.findMany({
      where,
      take: 300,
      include: {
        photos: { orderBy: [{ isCover: 'desc' }, { order: 'asc' }], take: 1 },
        services: {
          where: serviceFilter,
          include: { category: true },
          orderBy: { priceCents: 'asc' },
        },
      },
    });

    let results = rows.map((p) => {
      const d = center ? distanceKm(center.lat, center.lng, p.latitude, p.longitude) : null;
      return {
        id: p.id,
        slug: p.slug,
        displayName: p.displayName,
        tagline: p.tagline,
        kind: p.kind,
        city: p.city,
        neighbourhood: p.neighbourhood,
        latitude: p.latitude,
        longitude: p.longitude,
        modes: { atHome: p.atHome, inSalon: p.inSalon, inShop: p.inShop, travels: p.travels },
        travelRadiusKm: p.travelRadiusKm,
        ratingAvg: p.ratingAvg,
        ratingCount: p.ratingCount,
        coverUrl: p.photos[0]?.url ?? null,
        categories: [...new Map(p.services.map((s) => [s.category.slug, s.category])).values()],
        priceFromCents: p.services[0]?.priceCents ?? null,
        topServices: p.services.slice(0, 3).map((s) => ({ name: s.name, priceCents: s.priceCents })),
        distanceKm: d == null ? null : Math.round(d * 10) / 10,
        // true when the provider's travel area covers the customer's location
        comesToYou: d != null && p.travels && d <= p.travelRadiusKm,
      };
    });

    if (center) {
      results = results.filter((r) => r.distanceKm! <= radius || r.comesToYou);
    }

    const sort = q.sort ?? (center ? 'distance' : 'rating');
    results.sort((a, b) => {
      if (sort === 'distance' && center) return a.distanceKm! - b.distanceKm!;
      if (sort === 'price') return (a.priceFromCents ?? 1e9) - (b.priceFromCents ?? 1e9);
      return b.ratingAvg - a.ratingAvg || b.ratingCount - a.ratingCount;
    });

    return { center, radiusKm: radius, total: results.length, results: results.slice(0, 60) };
  }

  /**
   * Public profile page. Non-approved profiles are only visible to their owner
   * (preview) and to admins (moderation).
   */
  async getBySlug(slug: string, viewer: AuthUser | null) {
    const p = await this.prisma.providerProfile.findUnique({ where: { slug }, include: FULL_PROFILE });
    if (!p) throw new NotFoundException('Prestataire introuvable');
    const isOwner = viewer?.sub === p.userId;
    const isAdmin = viewer?.role === 'ADMIN';
    if (p.status !== 'APPROVED' && !isOwner && !isAdmin) {
      throw new NotFoundException('Prestataire introuvable');
    }
    const { userId, rejectionReason, address, ...rest } = p;
    // Privacy: an exact address is public only for a salon or shop. People who
    // receive clients at home share it after accepting an appointment (email).
    const publicAddress = p.inSalon || p.inShop || isOwner || isAdmin ? address : null;
    return {
      ...rest,
      address: publicAddress,
      isPreview: p.status !== 'APPROVED',
      rejectionReason: isOwner || isAdmin ? rejectionReason : null,
    };
  }

  // ===========================================================================
  // PROVIDER — "my profile" (dashboard)
  // ===========================================================================

  /** Returns the provider's own profile, or null if they haven't started onboarding. */
  async getMine(userId: string) {
    return this.prisma.providerProfile.findUnique({
      where: { userId },
      include: {
        ...FULL_PROFILE,
        services: { include: { category: true }, orderBy: { createdAt: 'asc' } },
        moderation: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
  }

  /** Create on first call, partial update afterwards. */
  async upsertMine(userId: string, dto: UpsertProfileDto) {
    // No coordinates sent: derive them from the address or the neighbourhood.
    if ((dto.latitude == null || dto.longitude == null) && (dto.address || dto.neighbourhood)) {
      const g = await this.geo.resolve([dto.address, dto.neighbourhood, dto.city].filter(Boolean).join(', '));
      if (g) {
        dto.latitude = g.lat;
        dto.longitude = g.lng;
        dto.city ??= g.city ?? undefined;
      }
    }
    if ((dto.latitude == null || dto.longitude == null) && dto.neighbourhood) {
      const place = findPlace(dto.neighbourhood);
      if (place) {
        dto.latitude = place.lat;
        dto.longitude = place.lng;
        dto.city ??= place.city;
      }
    }

    const existing = await this.prisma.providerProfile.findUnique({ where: { userId } });

    if (!existing) {
      if (!dto.displayName || !dto.city || dto.latitude == null || dto.longitude == null) {
        throw new BadRequestException('Nom, ville et localisation sont requis pour créer le profil');
      }
      return this.prisma.providerProfile.create({
        data: {
          ...dto,
          displayName: dto.displayName,
          city: dto.city,
          latitude: dto.latitude,
          longitude: dto.longitude,
          userId,
          slug: await this.uniqueSlug(dto.displayName),
        },
      });
    }

    // Changing identity fields on a live profile requires a new admin check.
    const data: Prisma.ProviderProfileUpdateInput = { ...dto };
    const sensitiveChanged = SENSITIVE_FIELDS.some(
      (f) => dto[f] !== undefined && dto[f] !== (existing as any)[f],
    );
    const backToReview = existing.status === 'APPROVED' && sensitiveChanged;
    if (backToReview) {
      data.status = 'PENDING';
      data.submittedAt = new Date();
    }
    const updated = await this.prisma.providerProfile.update({ where: { id: existing.id }, data });
    if (backToReview) void this.notify.profileSubmitted(updated.id).catch(logError);
    return updated;
  }

  /** DRAFT/REJECTED → PENDING, after checking the profile is complete enough. */
  async submitMine(userId: string) {
    const p = await this.requireMine(userId);
    if (p.status === 'PENDING') return p;
    if (p.status === 'APPROVED') throw new BadRequestException('Profil déjà publié');

    const [services, photos] = await Promise.all([
      this.prisma.service.count({ where: { profileId: p.id, isActive: true } }),
      this.prisma.photo.count({ where: { profileId: p.id } }),
    ]);
    const missing: string[] = [];
    if (!p.description || p.description.length < 30) missing.push('une description (30 caractères min.)');
    if (!(p.atHome || p.inSalon || p.inShop || p.travels)) missing.push('au moins un lieu de prestation');
    if (services === 0) missing.push('au moins un service');
    if (photos === 0) missing.push('au moins une photo');
    if (missing.length) {
      throw new BadRequestException(`Avant de soumettre, ajoutez : ${missing.join(', ')}.`);
    }

    const submitted = await this.prisma.providerProfile.update({
      where: { id: p.id },
      data: { status: 'PENDING', submittedAt: new Date(), rejectionReason: null },
    });
    void this.notify.profileSubmitted(p.id).catch(logError);
    return submitted;
  }

  // --- Services --------------------------------------------------------------

  async addService(userId: string, dto: ServiceDto) {
    const p = await this.requireMine(userId);
    return this.prisma.service.create({ data: { ...dto, profileId: p.id }, include: { category: true } });
  }

  async updateService(userId: string, serviceId: string, dto: Partial<ServiceDto>) {
    await this.requireOwnedService(userId, serviceId);
    return this.prisma.service.update({ where: { id: serviceId }, data: dto, include: { category: true } });
  }

  async deleteService(userId: string, serviceId: string) {
    await this.requireOwnedService(userId, serviceId);
    await this.prisma.service.delete({ where: { id: serviceId } });
    return { ok: true };
  }

  // --- Opening hours ---------------------------------------------------------

  /** Replaces the whole week in one transaction. */
  async setHours(userId: string, dto: OpeningHoursDto) {
    const p = await this.requireMine(userId);
    await this.prisma.$transaction([
      this.prisma.openingHours.deleteMany({ where: { profileId: p.id } }),
      this.prisma.openingHours.createMany({
        data: dto.days.map((d) => ({
          profileId: p.id,
          weekday: d.weekday,
          closed: d.closed,
          opensAt: d.closed ? null : d.opensAt ?? null,
          closesAt: d.closed ? null : d.closesAt ?? null,
        })),
      }),
    ]);
    return this.prisma.openingHours.findMany({ where: { profileId: p.id }, orderBy: { weekday: 'asc' } });
  }

  // --- Photos ----------------------------------------------------------------

  async assertCanAddPhoto(userId: string) {
    const p = await this.requireMine(userId);
    if ((await this.prisma.photo.count({ where: { profileId: p.id } })) >= 12) {
      throw new BadRequestException('Maximum 12 photos');
    }
  }

  async addPhoto(userId: string, url: string) {
    const p = await this.requireMine(userId);
    const count = await this.prisma.photo.count({ where: { profileId: p.id } });
    if (count >= 12) throw new BadRequestException('Maximum 12 photos');
    return this.prisma.photo.create({
      data: { profileId: p.id, url, order: count, isCover: count === 0 },
    });
  }

  async setCover(userId: string, photoId: string) {
    const p = await this.requireMine(userId);
    await this.requireOwnedPhoto(p.id, photoId);
    await this.prisma.$transaction([
      this.prisma.photo.updateMany({ where: { profileId: p.id }, data: { isCover: false } }),
      this.prisma.photo.update({ where: { id: photoId }, data: { isCover: true } }),
    ]);
    return { ok: true };
  }

  async deletePhoto(userId: string, photoId: string) {
    const p = await this.requireMine(userId);
    const photo = await this.requireOwnedPhoto(p.id, photoId);
    await this.prisma.photo.delete({ where: { id: photoId } });
    // Keep a cover photo if any remain.
    if (photo.isCover) {
      const next = await this.prisma.photo.findFirst({ where: { profileId: p.id }, orderBy: { order: 'asc' } });
      if (next) await this.prisma.photo.update({ where: { id: next.id }, data: { isCover: true } });
    }
    return { ok: true };
  }

  // ===========================================================================
  // helpers
  // ===========================================================================

  private async requireMine(userId: string) {
    const p = await this.prisma.providerProfile.findUnique({ where: { userId } });
    if (!p) throw new NotFoundException("Créez d'abord votre profil");
    return p;
  }

  private async requireOwnedService(userId: string, serviceId: string) {
    const s = await this.prisma.service.findUnique({ where: { id: serviceId }, include: { profile: true } });
    if (!s) throw new NotFoundException('Service introuvable');
    if (s.profile.userId !== userId) throw new ForbiddenException();
    return s;
  }

  private async requireOwnedPhoto(profileId: string, photoId: string) {
    const photo = await this.prisma.photo.findUnique({ where: { id: photoId } });
    if (!photo || photo.profileId !== profileId) throw new NotFoundException('Photo introuvable');
    return photo;
  }

  private async uniqueSlug(name: string) {
    const base = slugify(name) || 'prestataire';
    let slug = base;
    for (let i = 2; await this.prisma.providerProfile.findUnique({ where: { slug } }); i++) {
      slug = `${base}-${i}`;
    }
    return slug;
  }
}

