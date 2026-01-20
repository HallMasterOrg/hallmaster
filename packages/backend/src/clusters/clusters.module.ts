import { Module } from '@nestjs/common';
import { ClustersService } from './clusters.service.js';
import { ClustersController } from './clusters.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { DockerModule } from '../docker/docker.module.js';

@Module({
  imports: [PrismaModule, DockerModule],
  controllers: [ClustersController],
  providers: [ClustersService],
  exports: [ClustersService],
})
export class ClustersModule {}
