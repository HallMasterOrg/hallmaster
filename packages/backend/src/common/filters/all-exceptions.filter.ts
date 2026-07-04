import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { FastifyReply } from 'fastify';

import { ApiErrorDto } from '../dto/api-error.dto.js';

/**
 * Normalizes every thrown exception into a single {@link ApiErrorDto} shape
 * (`{ statusCode, error, message }`), so clients get one predictable, typed
 * error body regardless of the source (Nest `HttpException`, Zod validation
 * failures, or unexpected errors).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<FastifyReply>();
    const body = AllExceptionsFilter.normalize(exception);

    if (body.statusCode >= 500) {
      this.logger.error(`${body.statusCode} ${body.message}`, exception instanceof Error ? exception.stack : undefined);
    }

    reply.status(body.statusCode).send(body);
  }

  private static normalize(exception: unknown): ApiErrorDto {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const response = exception.getResponse();
      const issues = AllExceptionsFilter.extractIssues(response);

      return {
        statusCode,
        error: AllExceptionsFilter.extractError(response, statusCode),
        message: AllExceptionsFilter.extractMessage(response, exception.message),
        ...(issues && { issues }),
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Internal server error',
    };
  }

  // Zod validation failures
  private static extractIssues(response: string | object): ApiErrorDto['issues'] {
    if (typeof response !== 'object') {
      return undefined;
    }

    const errors: unknown = (response as { errors?: unknown }).errors;
    if (!Array.isArray(errors) || errors.length === 0) {
      return undefined;
    }

    const issues = (errors as unknown[])
      .filter((issue): issue is Record<string, unknown> => typeof issue === 'object' && issue !== null)
      .map((issue) => ({
        path: Array.isArray(issue.path)
          ? (issue.path as unknown[]).filter(
              (p): p is string | number => typeof p === 'string' || typeof p === 'number',
            )
          : [],
        message: typeof issue.message === 'string' ? issue.message : 'Invalid value',
        code: typeof issue.code === 'string' ? issue.code : 'invalid',
      }));

    return issues.length > 0 ? issues : undefined;
  }

  private static extractMessage(response: string | object, fallback: string): string {
    if (typeof response === 'string') {
      return response;
    }

    const message = (response as { message?: unknown }).message;
    if (Array.isArray(message)) {
      return message.join('; ');
    }
    if (typeof message === 'string') {
      return message;
    }

    return fallback;
  }

  private static extractError(response: string | object, statusCode: number): string {
    if (typeof response === 'object') {
      const error = (response as { error?: unknown }).error;
      if (typeof error === 'string') {
        return error;
      }
    }

    return AllExceptionsFilter.reasonPhrase(statusCode);
  }

  private static reasonPhrase(statusCode: number): string {
    const name: unknown = (HttpStatus as Record<number, string>)[statusCode];
    if (typeof name !== 'string') {
      return 'Error';
    }

    return name
      .split('_')
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  }
}
