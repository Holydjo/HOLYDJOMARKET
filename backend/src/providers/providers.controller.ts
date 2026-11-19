import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { StorageService } from '../storage/storage.service';
import {
  AuthUser,
  CurrentUser,
  JwtAuthGuard,
  OptionalJwtGuard,
  Roles,
  RolesGuard,
} from '../common/auth.decorators';
import { OpeningHoursDto, SearchQueryDto, ServiceDto, UpsertProfileDto } from './dto/provider.dto';
import { ProvidersService } from './providers.service';

/** Public endpoints used by customers. */
@Controller('providers')
export class ProvidersController {
  constructor(private providers: ProvidersService) {}

  /** GET /providers/search?category=braids&place=Verdun&radiusKm=10 */
  @Get('search')
  search(@Query() q: SearchQueryDto) {
    return this.providers.search(q);
  }

  /** GET /providers/sitemap — published profiles for the website's sitemap.xml (audit H5). */
  @Get('sitemap')
  sitemap() {
    return this.providers.sitemap();
  }

  /** GET /providers/:slug — public profile page */
  @Get(':slug')
  @UseGuards(OptionalJwtGuard)
  bySlug(@Param('slug') slug: string, @CurrentUser() viewer: AuthUser | null) {
    return this.providers.getBySlug(slug, viewer);
  }
}

/** Images are kept in memory, validated, then handed to StorageService (disk or Cloudinary). */
const photoUpload = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    /^image\/(jpeg|png|webp)$/.test(file.mimetype)
      ? cb(null, true)
      : cb(new BadRequestException('Formats acceptés : JPG, PNG, WEBP'), false),
});

/** Provider dashboard endpoints — only for users with role PROVIDER. */
@Controller('me/profile')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('PROVIDER')
export class MyProfileController {
  constructor(
    private providers: ProvidersService,
    private storage: StorageService,
  ) {}

  @Get()
  get(@CurrentUser() u: AuthUser) {
    return this.providers.getMine(u.sub);
  }

  @Put()
  upsert(@CurrentUser() u: AuthUser, @Body() dto: UpsertProfileDto) {
    return this.providers.upsertMine(u.sub, dto);
  }

  @Post('submit')
  submit(@CurrentUser() u: AuthUser) {
    return this.providers.submitMine(u.sub);
  }

  @Post('services')
  addService(@CurrentUser() u: AuthUser, @Body() dto: ServiceDto) {
    return this.providers.addService(u.sub, dto);
  }

  @Put('services/:id')
  updateService(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: ServiceDto) {
    return this.providers.updateService(u.sub, id, dto);
  }

  @Delete('services/:id')
  deleteService(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.providers.deleteService(u.sub, id);
  }

  @Put('hours')
  setHours(@CurrentUser() u: AuthUser, @Body() dto: OpeningHoursDto) {
    return this.providers.setHours(u.sub, dto);
  }

  @Post('photos')
  @UseInterceptors(photoUpload)
  async addPhoto(@CurrentUser() u: AuthUser, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Aucune image reçue');
    await this.providers.assertCanAddPhoto(u.sub); // check the 12-photo limit before uploading
    return this.providers.addPhoto(u.sub, await this.storage.save(file));
  }

  @Patch('photos/:id/cover')
  setCover(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.providers.setCover(u.sub, id);
  }

  @Delete('photos/:id')
  deletePhoto(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.providers.deletePhoto(u.sub, id);
  }
}
