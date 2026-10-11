import type { ValidationTargets } from "hono";
import { validator as openAPIValidator } from "hono-openapi";

import { ValidationException } from "#exceptions/http-exceptions";

type ValidatorSchema = Parameters<typeof openAPIValidator>[1];
type ValidationResult = Parameters<NonNullable<Parameters<typeof openAPIValidator>[2]>>[0];

function validationHook(result: ValidationResult) {
  if (result.success) {
    return;
  }

  throw new ValidationException(
    result.error.map((issue) => ({
      path: (issue.path ?? [])
        .map((segment) => String(typeof segment === "object" ? segment.key : segment))
        .join("."),
      message: issue.message,
    })),
  );
}

export default function validator<
  Schema extends ValidatorSchema,
  Target extends keyof ValidationTargets,
>(target: Target, schema: Schema) {
  return openAPIValidator(target, schema, validationHook);
}
