import { Module } from '@nestjs/common';
import { BotService } from './bot.service.js';
import { BotController } from './bot.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ClustersModule } from '../clusters/clusters.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule, PrismaModule, ClustersModule],
  controllers: [BotController],
  providers: [BotService],
})
export class BotModule {}
