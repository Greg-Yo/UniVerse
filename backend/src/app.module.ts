import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './common/prisma/prisma.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { HierarchyModule } from './hierarchy/hierarchy.module';
import { ResourcesModule } from './resources/resources.module';
import { MessagingModule } from './messaging/messaging.module';
import { VideoModule } from './video/video.module';
import { LibraryModule } from './library/library.module';
import { NotificationsModule } from './notifications/notifications.module';
import { StorageModule } from './storage/storage.module';
import { RealtimeModule } from './realtime/realtime.module';
import { JobsModule } from './jobs/jobs.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Limite globale souple ; les routes auth ont un plafond plus strict.
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 120,
      },
    ]),
    PrismaModule,
    AuthModule,
    UsersModule,
    HierarchyModule,
    ResourcesModule,
    MessagingModule,
    VideoModule,
    LibraryModule,
    NotificationsModule,
    StorageModule,
    RealtimeModule,
    JobsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
