import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { YoutubeService } from './youtube.service';

/**
 * Module d'infrastructure video (YoutubeService) isole pour eviter un cycle
 * de dependances : JobsModule (upload processor) et VideoModule en dependent
 * tous les deux.
 */
@Module({
  imports: [ConfigModule],
  providers: [YoutubeService],
  exports: [YoutubeService],
})
export class VideoInfraModule {}
