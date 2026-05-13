import { constants } from 'node:zlib';

import fastifyCompress from '@fastify/compress';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import type { OpenAPIObject, SwaggerCustomOptions } from '@nestjs/swagger';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc, ZodValidationPipe } from 'nestjs-zod';
import { SwaggerTheme, SwaggerThemeNameEnum } from 'swagger-themes';

import { AppModule } from './app.module.js';
import { LoggerService } from './logger/logger.service.js';
import { LoggingInterceptor } from './logger/logging.interceptor.js';

const getSwaggerDocumentConfig = (): Omit<OpenAPIObject, 'paths'> =>
  new DocumentBuilder()
    .setTitle('OpenAPI Documentation')
    .setDescription(
      'This document indexes all the available routes, along with their params, queries, payloads and responses.',
    )
    .addTag('Authentication', 'All the endpoints used to authenticate a user.')
    .addTag('Bot', "All the endpoints used to manage the bot's configuration (shards, clusters, ...)")
    .addTag('Clusters', 'All the endpoints to manage the clusters themselves (start, stop, restart, ...)')
    .addBearerAuth(
      {
        type: 'http',
        description: "A JWT returned by the 'login' auth endpoint.",
        name: 'bearer',
      },
      'jwt',
    )
    .setVersion('1.0')
    .build();

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());

  const configService = app.get<ConfigService>(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const logRequests = configService.get<boolean>('LOG_REQUESTS', false);

  const loggerService = app.get(LoggerService);
  app.useLogger(loggerService);
  Logger.overrideLogger(loggerService);

  app.useGlobalPipes(new ZodValidationPipe());
  if (logRequests) {
    app.useGlobalInterceptors(new LoggingInterceptor(loggerService));
  }

  app.enableCors({
    origin: '*',
  });

  await app.register(fastifyCompress, {
    brotliOptions: { params: { [constants.BROTLI_PARAM_QUALITY]: 1 } },
  });

  const swaggerDocumentationConfig = getSwaggerDocumentConfig();
  const document = SwaggerModule.createDocument(app, swaggerDocumentationConfig);
  cleanupOpenApiDoc(document);
  const theme = new SwaggerTheme();
  const swaggerConfig: SwaggerCustomOptions = {
    explorer: true,
    customSiteTitle: swaggerDocumentationConfig.info.title,
    customCss: theme.getBuffer(SwaggerThemeNameEnum.DARK),
  };
  SwaggerModule.setup('/openapi', app, document, swaggerConfig);

  await app.listen(port, '0.0.0.0');
}

bootstrap().catch(console.error);
