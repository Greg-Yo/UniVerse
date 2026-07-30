import { Module } from '@nestjs/common';
import { VideoService } from './video.service';
import { VideoController } from './video.controller';
import { YoutubeController } from './youtube.controller';
import { JobsModule } from '../jobs/jobs.module';
import { VideoInfraModule } from './video-infra.module';

@Module({
  imports: [JobsModule, VideoInfraModule],
  providers: [VideoService],
  controllers: [VideoController, YoutubeController],
})
export class VideoModule {}
