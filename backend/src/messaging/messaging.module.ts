import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';
import { SignalementsService } from './signalements.service';
import { SignalementsController } from './signalements.controller';
import { JobsModule } from '../jobs/jobs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [ConfigModule, JobsModule, NotificationsModule, RealtimeModule],
  providers: [ConversationsService, SignalementsService],
  controllers: [ConversationsController, SignalementsController],
})
export class MessagingModule {}
