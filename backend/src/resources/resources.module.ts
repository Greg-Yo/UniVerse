import { Module } from '@nestjs/common';
import { ResourcesService } from './resources.service';
import { ResourcesController } from './resources.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [NotificationsModule, RealtimeModule],
  providers: [ResourcesService],
  controllers: [ResourcesController],
})
export class ResourcesModule {}
