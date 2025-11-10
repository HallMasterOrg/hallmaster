import { Module } from '@nestjs/common';
import { ClustersService } from './clusters.service.js';
import { ClustersController } from './clusters.controller.js';
import { HypervisorsModule } from '../hypervisors/hypervisors.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule, HypervisorsModule],
  controllers: [ClustersController],
  providers: [ClustersService],
  exports: [ClustersService],
})
export class ClustersModule {}
