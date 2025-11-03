import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from './logger/logger.module.js';
// import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    LoggerModule,
    ConfigModule,
    // PrismaModule,
  ],
})
export class AppModule {}
