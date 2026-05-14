import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from './auth/auth.module.js';
import { BotModule } from './bot/bot.module.js';
import { ClustersModule } from './clusters/clusters.module.js';
import { DockerModule } from './docker/docker.module.js';
import { LoggerModule } from './logger/logger.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [LoggerModule, ConfigModule, PrismaModule, BotModule, ClustersModule, DockerModule, AuthModule],
})
export class AppModule {}
