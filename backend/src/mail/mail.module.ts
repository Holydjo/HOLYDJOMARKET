import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { Notifier } from './notifier';

/** @Global: any feature module can inject Notifier without importing this module. */
@Global()
@Module({ providers: [MailService, Notifier], exports: [MailService, Notifier] })
export class MailModule {}
