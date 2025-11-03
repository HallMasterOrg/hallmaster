import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service.js';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: PrismaService,
      inject: [ConfigService],
      useFactory(configService: ConfigService) {
        const datasourceUrl =
          configService.getOrThrow<string>('DATASOURCE_URL');

        return new PrismaService(datasourceUrl);
      },
    },
  ],
  exports: [PrismaService],
})
export class PrismaModule {}
