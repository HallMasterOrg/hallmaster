import { Module } from '@nestjs/common';
import { ClustersService } from './clusters.service.js';
import { ClustersController } from './clusters.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { DockerModule } from '../docker/docker.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule, PrismaModule, DockerModule],
  controllers: [ClustersController],
  providers: [ClustersService],
  exports: [ClustersService],
})
export class ClustersModule {}
