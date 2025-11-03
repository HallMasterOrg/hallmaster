import { Module } from '@nestjs/common';
import { LoggerService } from './logger.service.js';

@Module({
  providers: [LoggerService],
  exports: [LoggerService],
})
export class LoggerModule {}
