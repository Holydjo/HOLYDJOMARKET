import { Module } from '@nestjs/common';
import { MyProfileController, ProvidersController } from './providers.controller';
import { ProvidersService } from './providers.service';

@Module({
  controllers: [ProvidersController, MyProfileController],
  providers: [ProvidersService],
  exports: [ProvidersService],
})
export class ProvidersModule {}
