export const loginErrors = {
  forbidden: "This Discord account cannot access this instance",
  failed: "Discord authentication failed, please try again",
};

export type LoginError = keyof typeof loginErrors;

export function isLoginError(value: string | null): value is LoginError {
  return value !== null && Object.hasOwn(loginErrors, value);
}
