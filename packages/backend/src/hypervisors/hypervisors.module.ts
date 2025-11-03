import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module.js';
import { RawHypervisorService } from './raw-hypervisor.service.js';
import { DockerHypervisorService } from './docker-hypervisor.service.js';

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [DockerHypervisorService, RawHypervisorService],
  exports: [DockerHypervisorService, RawHypervisorService],
})
export class HypervisorsModule {}
