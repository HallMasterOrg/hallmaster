import { HTTPException } from "hono/http-exception";

type HTTPExceptionOptions = Omit<
  NonNullable<ConstructorParameters<typeof HTTPException>[1]>,
  "res"
>;

export class BadRequestException extends HTTPException {
  constructor(options: HTTPExceptionOptions) {
    super(400, options);
  }
}

export class UnauthorizedException extends HTTPException {
  constructor(options: HTTPExceptionOptions) {
    super(401, options);
  }
}

type NotFoundExceptionOptions =
  | Omit<HTTPExceptionOptions, "message">
  | { message?: `${string} not found` };
export class NotFoundException extends HTTPException {
  constructor(options: NotFoundExceptionOptions) {
    super(404, options);
  }
}

export class ConflictException extends HTTPException {
  constructor(options: HTTPExceptionOptions) {
    super(409, options);
  }
}

export class FailedDependancyException extends HTTPException {
  constructor(options: HTTPExceptionOptions) {
    super(424, options);
  }
}
