import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { ClustersModule } from '../clusters/clusters.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';

import { BotController } from './bot.controller.js';
import { BotService } from './bot.service.js';

@Module({
  imports: [AuthModule, PrismaModule, ClustersModule],
  controllers: [BotController],
  providers: [BotService],
})
export class BotModule {}
