import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module';
import { MyProfileController, ProvidersController } from './providers.controller';
import { ProvidersService } from './providers.service';
import { StorageService } from '../storage/storage.service';

@Module({
  imports: [CategoriesModule], // for GeocodingService
  controllers: [ProvidersController, MyProfileController],
  providers: [ProvidersService, StorageService],
  exports: [ProvidersService],
})
export class ProvidersModule {}
