import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { AUTH_COOKIE_NAMES } from "@nelna/shared";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { CurrentUserDto } from "./dto/current-user.dto";
import { Public } from "./decorators/public.decorator";
import { CurrentUser } from "./decorators/current-user.decorator";
import type { RequestUser } from "./auth.types";
import { getAuthConfig } from "./auth.config";
import { clearAuthCookies, setAuthCookies } from "./lib/cookies";

function requestMeta(req: Request): {
  ip?: string;
  userAgent?: string;
  requestId?: string;
} {
  return {
    ip: req.ip,
    userAgent: req.get("user-agent") ?? undefined,
    requestId: req.nelnaRequestId,
  };
}

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ auth: { limit: 10, ttl: 60_000 }, global: { limit: 10, ttl: 60_000 } })
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Authenticate with username + password, receiving httpOnly session cookies",
  })
  @ApiOkResponse({ description: "Signed in", type: CurrentUserDto })
  @ApiUnauthorizedResponse({ description: "Invalid username or password" })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CurrentUserDto> {
    const config = getAuthConfig();
    const { user, tokens } = await this.authService.login(dto, requestMeta(req));
    setAuthCookies(res, config, tokens);
    return user;
  }

  @Public()
  @Throttle({ auth: { limit: 30, ttl: 60_000 }, global: { limit: 30, ttl: 60_000 } })
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Rotate the refresh token and issue a new access token" })
  @ApiOkResponse({ description: "Session refreshed", type: CurrentUserDto })
  @ApiUnauthorizedResponse({ description: "Refresh token missing, invalid or expired" })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CurrentUserDto> {
    const config = getAuthConfig();
    const refreshTokenRaw = req.cookies?.[AUTH_COOKIE_NAMES.refreshToken] as
      | string
      | undefined;

    try {
      const { user, tokens } = await this.authService.refresh(
        refreshTokenRaw,
        requestMeta(req),
      );
      setAuthCookies(res, config, tokens);
      return user;
    } catch (error) {
      clearAuthCookies(res, config);
      throw error;
    }
  }

  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "End the current session and clear session cookies" })
  @ApiOkResponse({ description: "Signed out" })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ success: true }> {
    const config = getAuthConfig();
    const refreshTokenRaw = req.cookies?.[AUTH_COOKIE_NAMES.refreshToken] as
      string | undefined;
    await this.authService.logout(refreshTokenRaw, requestMeta(req));
    clearAuthCookies(res, config);
    return { success: true };
  }

  @Post("change-password")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Change password (required on first login when flagged)" })
  @ApiOkResponse({ description: "Password changed", type: CurrentUserDto })
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() currentUser: RequestUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CurrentUserDto> {
    const config = getAuthConfig();
    const { user, tokens } = await this.authService.changePassword(
      currentUser.id,
      dto,
      requestMeta(req),
    );
    setAuthCookies(res, config, tokens);
    return user;
  }

  @Get("me")
  @ApiCookieAuth()
  @ApiOperation({
    summary: "Return the currently authenticated user's profile, roles and permissions",
  })
  @ApiOkResponse({ description: "Current user", type: CurrentUserDto })
  @ApiUnauthorizedResponse({ description: "Not authenticated or session expired" })
  async me(@CurrentUser() currentUser: RequestUser): Promise<CurrentUserDto> {
    return this.authService.getCurrentUser(currentUser.id);
  }

  @Get("sessions")
  @ApiCookieAuth()
  @ApiOperation({
    summary: "List active and recent sign-in sessions for the current user",
  })
  async sessions(@Req() req: Request, @CurrentUser() currentUser: RequestUser) {
    const refreshTokenRaw = req.cookies?.[AUTH_COOKIE_NAMES.refreshToken] as
      string | undefined;
    return this.authService.listSessions(currentUser.id, refreshTokenRaw);
  }

  @Post("sessions/:familyId/revoke")
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({ summary: "Revoke a single sign-in session (token family)" })
  async revokeSession(
    @Param("familyId") familyId: string,
    @CurrentUser() currentUser: RequestUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ success: true }> {
    const config = getAuthConfig();
    const refreshTokenRaw = req.cookies?.[AUTH_COOKIE_NAMES.refreshToken] as
      string | undefined;
    const { clearedCurrent } = await this.authService.revokeSession(
      currentUser.id,
      familyId,
      refreshTokenRaw,
    );
    if (clearedCurrent) {
      clearAuthCookies(res, config);
    }
    return { success: true };
  }
}
