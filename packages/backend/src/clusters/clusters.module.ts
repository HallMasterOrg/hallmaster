import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { DockerModule } from '../docker/docker.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';

import { ClustersController } from './clusters.controller.js';
import { ClustersService } from './clusters.service.js';

@Module({
  imports: [AuthModule, PrismaModule, DockerModule],
  controllers: [ClustersController],
  providers: [ClustersService],
  exports: [ClustersService],
})
export class ClustersModule {}
