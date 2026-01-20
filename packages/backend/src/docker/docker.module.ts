import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module.js';
import { DockerService } from './docker.service.js';

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [DockerService],
  exports: [DockerService],
})
export class DockerModule {}
