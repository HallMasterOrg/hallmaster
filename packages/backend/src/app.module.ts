import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from './logger/logger.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { BotModule } from './bot/bot.module.js';
import { ClustersModule } from './clusters/clusters.module.js';
import { HypervisorsModule } from './hypervisors/hypervisors.module.js';

@Module({
  imports: [
    LoggerModule,
    ConfigModule,
    PrismaModule,
    BotModule,
    ClustersModule,
    HypervisorsModule,
    // PrismaModule,
  ],
})
export class AppModule {}
