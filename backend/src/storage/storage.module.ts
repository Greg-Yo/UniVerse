import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { StorageAccessService } from './storage-access.service';
import { StorageController } from './storage.controller';

@Module({
  providers: [StorageService, StorageAccessService],
  controllers: [StorageController],
  exports: [StorageService, StorageAccessService],
})
export class StorageModule {}
