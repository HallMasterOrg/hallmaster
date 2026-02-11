import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DockerSocket } from '@hallmaster/docker.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { DockerService } from './docker.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [
    {
      provide: DockerService,
      inject: [ConfigService, PrismaService],
      async useFactory(
        configService: ConfigService,
        prismaService: PrismaService,
      ) {
        const dockerSocket = new DockerSocket();
        await dockerSocket.init();

        const host = configService.get<string>('DOCKER_REGISTRY_HOST');
        const username = configService.get<string>('DOCKER_REGISTRY_USERNAME');
        const password = configService.get<string>('DOCKER_REGISTRY_PASSWORD');
        let dockerToken: string | undefined = undefined;
        if (
          host !== undefined &&
          username !== undefined &&
          password !== undefined
        ) {
          dockerToken = await dockerSocket.authenticate({
            serveraddress: host,
            username: username,
            password: password,
          });
        }

        return new DockerService(
          configService,
          prismaService,
          dockerSocket,
          dockerToken,
        );
      },
    },
  ],
  exports: [DockerService],
})
export class DockerModule {}
