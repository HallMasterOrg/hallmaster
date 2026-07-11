import { Module } from '@nestjs/common';

import { DiscordService } from './discord.service.js';

@Module({
  providers: [DiscordService],
  exports: [DiscordService],
})
export class DiscordModule {}
