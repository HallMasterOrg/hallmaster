import { CallHandler, ExecutionContext, HttpException, Injectable, NestInterceptor } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { catchError, Observable, tap, throwError } from 'rxjs';

import { LoggerService } from './logger.service.js';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const method = req.method;
    const url = req.url;
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const res = context.switchToHttp().getResponse<FastifyReply>();
        const statusCode = res.statusCode;
        const duration = Date.now() - start;

        this.logger.log(`${method} ${url} ${statusCode} - ${duration}ms`);
      }),
      catchError((error: unknown) => {
        const duration = Date.now() - start;

        if (error instanceof HttpException) {
          const statusCode = error.getStatus();
          this.logger.error(`${method} ${url} ${statusCode} - ${duration}ms - ${error.message}`, error.stack ?? '');
        } else {
          this.logger.error(`${method} ${url} 500 - ${duration}ms`, error instanceof Error ? (error.stack ?? '') : '');
        }

        return throwError(() => error);
      }),
    );
  }
}
