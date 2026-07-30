import { Module } from '@nestjs/common';
import { HierarchyService } from './hierarchy.service';
import { HierarchyController } from './hierarchy.controller';

@Module({
  providers: [HierarchyService],
  controllers: [HierarchyController],
})
export class HierarchyModule {}
