import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import type { AuthErrorCode } from "@nelna/shared";

/**
 * Every auth failure returns a stable `code` (see `AuthErrorCode`) alongside
 * a safe, generic `message`. The frontend must branch on `code`, never on
 * message text — messages may be reworded without being a breaking change.
 *
 * Enumeration policy (documented once, here):
 *  - Unknown username and wrong password both return INVALID_CREDENTIALS with
 *    the exact same message, so a caller cannot tell which one occurred.
 *  - ACCOUNT_INACTIVE / ACCOUNT_LOCKED are only ever returned once the
 *    supplied password has already matched the stored hash — never for a
 *    wrong password — so a failed guess can't be used to enumerate account
 *    state either.
 */

export class InvalidCredentialsException extends UnauthorizedException {
  constructor() {
    super({
      code: "INVALID_CREDENTIALS" satisfies AuthErrorCode,
      message: "Invalid username or password.",
    });
  }
}

export class InvalidCurrentPasswordException extends UnauthorizedException {
  constructor() {
    super({
      code: "INVALID_CURRENT_PASSWORD" satisfies AuthErrorCode,
      message: "Current password is incorrect.",
    });
  }
}

export class PasswordReuseException extends BadRequestException {
  constructor() {
    super({
      code: "PASSWORD_REUSE" satisfies AuthErrorCode,
      message: "New password must be different from your current password.",
    });
  }
}

export class AccountInactiveException extends ForbiddenException {
  constructor() {
    super({
      code: "ACCOUNT_INACTIVE" satisfies AuthErrorCode,
      message: "Your account is inactive. Contact your administrator.",
    });
  }
}

export class AccountLockedException extends HttpException {
  constructor(retryAfterMinutes: number) {
    super(
      {
        code: "ACCOUNT_LOCKED" satisfies AuthErrorCode,
        message: `Too many failed sign-in attempts. Try again in ${retryAfterMinutes} minute${retryAfterMinutes === 1 ? "" : "s"}.`,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

export class SessionExpiredException extends UnauthorizedException {
  constructor() {
    super({
      code: "SESSION_EXPIRED" satisfies AuthErrorCode,
      message: "Your session has expired. Please sign in again.",
    });
  }
}

export class TokenReuseDetectedException extends UnauthorizedException {
  constructor() {
    super({
      code: "TOKEN_REUSE_DETECTED" satisfies AuthErrorCode,
      message:
        "This session was ended for security reasons. Please sign in again on this device.",
    });
  }
}

export class NotAuthenticatedException extends UnauthorizedException {
  constructor() {
    super({
      code: "NOT_AUTHENTICATED" satisfies AuthErrorCode,
      message: "Sign in to continue.",
    });
  }
}

export class AuthForbiddenException extends ForbiddenException {
  constructor() {
    super({
      code: "FORBIDDEN" satisfies AuthErrorCode,
      message: "You do not have permission to perform this action.",
    });
  }
}
