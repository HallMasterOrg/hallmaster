import { Module } from '@nestjs/common';
import { BotService } from './bot.service.js';
import { BotController } from './bot.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ConfigModule } from '@nestjs/config';
import { ClustersModule } from '../clusters/clusters.module.js';

@Module({
  imports: [PrismaModule, ConfigModule, ClustersModule],
  controllers: [BotController],
  providers: [BotService],
})
export class BotModule {}
