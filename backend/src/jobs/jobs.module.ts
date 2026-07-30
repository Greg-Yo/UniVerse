import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { redisConnectionFromEnv } from '../common/redis/redis-connection';
import { StorageModule } from '../storage/storage.module';
import { VideoInfraModule } from '../video/video-infra.module';
import { ConversationWindowProcessor } from './conversation-window.processor';
import { CountersProcessor } from './counters.processor';
import { JobsService } from './jobs.service';
import { QUEUE_CONVERSATION_WINDOW, QUEUE_COUNTERS, QUEUE_YOUTUBE_UPLOAD } from './queues';
import { YoutubeUploadProcessor } from './youtube-upload.processor';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const password = config.get<string>('REDIS_PASSWORD') || undefined;
        if (process.env.NODE_ENV === 'production' && !password) {
          throw new Error('REDIS_PASSWORD est obligatoire en production');
        }
        const conn = redisConnectionFromEnv({
          REDIS_HOST: config.get<string>('REDIS_HOST') ?? undefined,
          REDIS_PORT: config.get<string>('REDIS_PORT') ?? undefined,
          REDIS_PASSWORD: password,
          REDIS_TLS: config.get<string>('REDIS_TLS') ?? process.env.REDIS_TLS,
        } as NodeJS.ProcessEnv);
        return {
          connection: {
            host: conn.host,
            port: conn.port,
            password: conn.password,
            ...(conn.tls ? { tls: conn.tls } : {}),
          },
        };
      },
    }),
    BullModule.registerQueue(
      { name: QUEUE_CONVERSATION_WINDOW },
      { name: QUEUE_COUNTERS },
      { name: QUEUE_YOUTUBE_UPLOAD },
    ),
    StorageModule,
    VideoInfraModule,
  ],
  providers: [
    JobsService,
    ConversationWindowProcessor,
    CountersProcessor,
    YoutubeUploadProcessor,
  ],
  exports: [JobsService, BullModule],
})
export class JobsModule {}
