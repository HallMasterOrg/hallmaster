import { DockerSocket } from '@hallmaster/docker.js';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { PrismaModule } from '../prisma/prisma.module.js';
import { PrismaService } from '../prisma/prisma.service.js';

import { DockerService } from './docker.service.js';

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [
    {
      provide: DockerService,
      inject: [ConfigService, PrismaService],
      async useFactory(configService: ConfigService, prismaService: PrismaService) {
        const dockerSocket = new DockerSocket();
        await dockerSocket.init();

        return new DockerService(configService, prismaService, dockerSocket);
      },
    },
  ],
  exports: [DockerService],
})
export class DockerModule {}
