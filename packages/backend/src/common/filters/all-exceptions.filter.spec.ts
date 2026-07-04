import type { ArgumentsHost } from '@nestjs/common';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { AllExceptionsFilter } from './all-exceptions.filter.js';

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  const capture = (exception: unknown): { status: number; body: unknown } => {
    let status = 0;
    let body: unknown;
    const reply = {
      status: (code: number) => {
        status = code;
        return { send: (payload: unknown) => (body = payload) };
      },
    };
    const host = {
      switchToHttp: () => ({ getResponse: () => reply }),
    } as unknown as ArgumentsHost;

    filter.catch(exception, host);
    return { status, body };
  };

  it('normalizes a standard HttpException to { statusCode, error, message }', () => {
    const { status, body } = capture(new NotFoundException());

    expect(status).toBe(404);
    expect(body).toEqual({ statusCode: 404, error: 'Not Found', message: 'Not Found' });
  });

  it('keeps the custom message of an HttpException thrown with a string', () => {
    const { body } = capture(new BadRequestException('The cluster has no container ID.'));

    expect(body).toEqual({
      statusCode: 400,
      error: 'Bad Request',
      message: 'The cluster has no container ID.',
    });
  });

  it('exposes Zod validation issues under `issues`', () => {
    // nestjs-zod throws a BadRequestException whose payload has `errors` and no `error`.
    const exception = new BadRequestException({
      statusCode: 400,
      message: 'Validation failed',
      errors: [{ path: ['interval'], message: 'Expected number', code: 'invalid_type' }],
    });

    const { status, body } = capture(exception);

    expect(status).toBe(400);
    expect(body).toEqual({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      issues: [{ path: ['interval'], message: 'Expected number', code: 'invalid_type' }],
    });
  });

  it('omits `issues` entirely for non-validation errors', () => {
    const { body } = capture(new NotFoundException());

    expect(body).not.toHaveProperty('issues');
  });

  it('maps an unknown (non-HTTP) error to a generic 500 without leaking internals', () => {
    const { status, body } = capture(new Error('bimbamboom database exploded'));

    expect(status).toBe(500);
    expect(body).toEqual({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Internal server error',
    });
  });
});
