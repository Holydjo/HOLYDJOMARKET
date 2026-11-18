import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { slugify } from '../common/geo';
import { Notifier } from '../mail/notifier';
import { PrismaService } from '../prisma/prisma.service';

/** Accent/case-insensitive comparison: "Esthétique" == "esthetique ". */
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Turns "  massage   SUÉDOIS " into "Massage suédois". */
const tidy = (s: string) => {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
};

const DEFAULT_ICON = '🏷️';

/**
 * Categories proposed by providers.
 *
 *   provider proposes "Massage"  →  PENDING (usable by providers immediately,
 *                                   hidden from public menus)
 *   admin approves               →  APPROVED (public), name/icon can be fixed
 *   admin rejects                →  services moved to an existing category,
 *                                   proposed category deleted
 */
@Injectable()
export class CategoriesService {
  constructor(
    private prisma: PrismaService,
    private notify: Notifier,
  ) {}

  /** Public list: approved only. */
  publicList() {
    return this.prisma.category.findMany({ where: { status: 'APPROVED' }, orderBy: [{ order: 'asc' }, { name: 'asc' }] });
  }

  /** What a provider can pick: every approved category + every pending one (shared, avoids duplicates). */
  forProvider() {
    return this.prisma.category.findMany({ orderBy: [{ status: 'asc' }, { order: 'asc' }, { name: 'asc' }] });
  }

  async propose(userId: string, rawName: string) {
    const name = tidy(rawName);
    if (name.length < 2 || name.length > 40) throw new BadRequestException('Le nom doit faire entre 2 et 40 caractères');

    // Same name already exists (any status, any accents/case)? Reuse it.
    const all = await this.prisma.category.findMany({ select: { id: true, name: true } });
    const existing = all.find((c) => norm(c.name) === norm(name));
    if (existing) return this.prisma.category.findUniqueOrThrow({ where: { id: existing.id } });

    // Don't let one account flood the moderation queue.
    const pendingByUser = await this.prisma.category.count({ where: { proposedById: userId, status: 'PENDING' } });
    if (pendingByUser >= 5) {
      throw new BadRequestException('Vous avez déjà 5 catégories en attente de validation. Patientez avant d’en proposer d’autres.');
    }

    const created = await this.prisma.category.create({
      data: { name, slug: await this.uniqueSlug(name), icon: DEFAULT_ICON, status: 'PENDING', proposedById: userId, order: 1000 },
    });
    void this.notify.categoryProposed(created.id).catch((e: Error) => console.error('[Mail]', e.message));
    return created;
  }

  // ---------------------------------------------------------------- admin

  pending() {
    return this.prisma.category.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      include: {
        proposedBy: { select: { firstName: true, lastName: true, email: true, providerProfile: { select: { displayName: true, slug: true } } } },
        services: { select: { name: true, profile: { select: { displayName: true } } }, take: 10 },
        _count: { select: { services: true } },
      },
    });
  }

  async approve(id: string, dto: { name?: string; icon?: string }) {
    const c = await this.requirePending(id);
    const name = dto.name ? tidy(dto.name) : c.name;
    if (name.length < 2 || name.length > 40) throw new BadRequestException('Le nom doit faire entre 2 et 40 caractères');
    const clash = (await this.prisma.category.findMany({ where: { id: { not: id } }, select: { name: true } })).some(
      (o) => norm(o.name) === norm(name),
    );
    if (clash) throw new BadRequestException('Une catégorie porte déjà ce nom : refusez celle-ci en la fusionnant avec l’existante.');
    const max = await this.prisma.category.aggregate({ where: { status: 'APPROVED' }, _max: { order: true } });
    return this.prisma.category.update({
      where: { id },
      data: {
        name,
        icon: dto.icon?.trim() || c.icon,
        slug: name === c.name ? c.slug : await this.uniqueSlug(name, id),
        status: 'APPROVED',
        order: (max._max.order ?? 0) + 1, // appended after existing public categories
      },
    });
  }

  /** Reject = merge: move the services into an existing approved category, then delete. */
  async reject(id: string, replaceWithId: string) {
    await this.requirePending(id);
    const target = await this.prisma.category.findUnique({ where: { id: replaceWithId } });
    if (!target || target.status !== 'APPROVED' || target.id === id) {
      throw new BadRequestException('Choisissez une catégorie existante pour y déplacer les services');
    }
    const [moved] = await this.prisma.$transaction([
      this.prisma.service.updateMany({ where: { categoryId: id }, data: { categoryId: target.id } }),
      this.prisma.category.delete({ where: { id } }),
    ]);
    return { ok: true, movedServices: moved.count, into: target.name };
  }

  private async requirePending(id: string) {
    const c = await this.prisma.category.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Catégorie introuvable');
    if (c.status !== 'PENDING') throw new BadRequestException('Cette catégorie est déjà validée');
    return c;
  }

  private async uniqueSlug(name: string, exceptId?: string) {
    const base = slugify(name) || 'categorie';
    let slug = base;
    for (let i = 2; ; i++) {
      const hit = await this.prisma.category.findUnique({ where: { slug } });
      if (!hit || hit.id === exceptId) return slug;
      slug = `${base}-${i}`;
    }
  }
}
