import { type Request, type Response, type NextFunction } from 'express';
import {
  driverOtpRequestSchema,
  driverOtpVerifySchema,
  companyRegisterSchema,
  companyVerifyMobileSchema,
  companyLoginSchema,
  adminLoginSchema,
  adminVerifyOtpSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  updatePreferencesSchema,
} from '@ap/shared-validation';
import { AuthService } from './auth.service.js';
import { TokenService } from './token.service.js';
import { SessionService } from './session.service.js';
import { TokenInvalidError, ForbiddenError } from '../../shared/errors/index.js';
import { env } from '../../config/env.js';

function setRefreshTokenCookie(res: Response, rawRefreshToken: string): void {
  res.cookie('ap_refresh', rawRefreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    domain:
      env.COOKIE_DOMAIN && env.COOKIE_DOMAIN !== 'localhost'
        ? env.COOKIE_DOMAIN
        : undefined,
    path: '/api/v1/auth/refresh',
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 86_400_000,
  });
}

function clearRefreshTokenCookie(res: Response): void {
  res.clearCookie('ap_refresh', {
    path: '/api/v1/auth/refresh',
    domain:
      env.COOKIE_DOMAIN && env.COOKIE_DOMAIN !== 'localhost'
        ? env.COOKIE_DOMAIN
        : undefined,
  });
}

function extractRequestContext(req: Request) {
  return {
    ipAddress: req.ip ?? req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
    requestId: req.id ? String(req.id) : undefined,
  };
}

export class AuthController {
  static async requestDriverOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = driverOtpRequestSchema.parse(req.body);
      await AuthService.requestDriverOtp(input.mobile, extractRequestContext(req), req.language);
      res.status(200).json({
        success: true,
        data: { message: 'Verification code dispatched successfully' },
      });
    } catch (err) {
      next(err);
    }
  }

  static async verifyDriverOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = driverOtpVerifySchema.parse(req.body);
      const result = await AuthService.verifyDriverOtp(input, extractRequestContext(req));
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async registerCompany(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = companyRegisterSchema.parse(req.body);
      const result = await AuthService.registerCompany(input, extractRequestContext(req));
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async verifyCompanyMobile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = companyVerifyMobileSchema.parse(req.body);
      const { accessToken, rawRefreshToken, user } = await AuthService.verifyCompanyMobile(
        input.mobile,
        input.code,
        extractRequestContext(req),
      );

      setRefreshTokenCookie(res, rawRefreshToken);

      res.status(200).json({
        success: true,
        data: {
          accessToken,
          user,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async loginCompany(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = companyLoginSchema.parse(req.body);
      const { accessToken, rawRefreshToken, user } = await AuthService.loginCompany(
        input,
        extractRequestContext(req),
      );

      setRefreshTokenCookie(res, rawRefreshToken);

      res.status(200).json({
        success: true,
        data: {
          accessToken,
          user,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async loginAdminStep1(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = adminLoginSchema.parse(req.body);
      const result = await AuthService.loginAdminStep1(input, extractRequestContext(req));
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async loginAdminStep2(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = adminVerifyOtpSchema.parse(req.body);
      const { accessToken, rawRefreshToken, user, mustChangePassword } =
        await AuthService.loginAdminStep2(input.challengeId, input.code, extractRequestContext(req));

      setRefreshTokenCookie(res, rawRefreshToken);

      res.status(200).json({
        success: true,
        data: {
          accessToken,
          user,
          mustChangePassword,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async refreshTokens(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const bodyInput = refreshTokenSchema.parse(req.body);
      const cookieToken = req.cookies?.ap_refresh ?? req.cookies?.refreshToken;
      const isWebCookie = Boolean(cookieToken);

      // CSRF protection for Web browser cookie refresh requests
      if (isWebCookie) {
        const origin = req.headers.origin;
        const requestedWith = req.headers['x-requested-with'];
        if (!requestedWith && (!origin || !env.webOriginsList.includes(origin))) {
          throw new ForbiddenError('CSRF protection rejected refresh token request');
        }
      }

      const rawRefreshToken = cookieToken ?? bodyInput.refreshToken;
      if (!rawRefreshToken) {
        throw new TokenInvalidError('Refresh token required');
      }

      const { accessToken, rawRefreshToken: newRawToken, user } =
        await TokenService.rotateRefreshToken(rawRefreshToken, extractRequestContext(req));

      if (isWebCookie) {
        setRefreshTokenCookie(res, newRawToken);
        res.status(200).json({
          success: true,
          data: {
            accessToken,
            user: AuthService.formatAuthUser(user),
          },
        });
      } else {
        res.status(200).json({
          success: true,
          data: {
            accessToken,
            refreshToken: newRawToken,
            user: AuthService.formatAuthUser(user),
          },
        });
      }
    } catch (err) {
      next(err);
    }
  }

  static async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = forgotPasswordSchema.parse(req.body);
      const result = await AuthService.forgotPassword(input.email, extractRequestContext(req));
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = resetPasswordSchema.parse(req.body);
      const result = await AuthService.resetPassword(input, extractRequestContext(req));
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.auth) {
        await SessionService.revokeSession(req.auth.sessionId, req.auth.userId);
      }
      clearRefreshTokenCookie(res);
      res.status(200).json({
        success: true,
        data: { message: 'Logged out successfully' },
      });
    } catch (err) {
      next(err);
    }
  }

  static async logoutAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.auth) {
        await SessionService.revokeAllSessions(req.auth.userId);
      }
      clearRefreshTokenCookie(res);
      res.status(200).json({
        success: true,
        data: { message: 'All active sessions have been revoked' },
      });
    } catch (err) {
      next(err);
    }
  }

  static async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) {
        throw new TokenInvalidError('Authentication required');
      }
      const result = await AuthService.getMe(req.auth.userId, req.auth.permissions);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async updatePreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) {
        throw new TokenInvalidError('Authentication required');
      }
      const input = updatePreferencesSchema.parse(req.body);
      const result = await AuthService.updatePreferences(req.auth.userId, input);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) {
        throw new TokenInvalidError('Authentication required');
      }
      const input = changePasswordSchema.parse(req.body);
      const result = await AuthService.changePassword(
        req.auth.userId,
        req.auth.sessionId,
        input,
        extractRequestContext(req),
      );
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async listSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) {
        throw new TokenInvalidError('Authentication required');
      }
      const sessions = await SessionService.listSessions(req.auth.userId, req.auth.sessionId);
      res.status(200).json({
        success: true,
        data: sessions,
      });
    } catch (err) {
      next(err);
    }
  }

  static async revokeSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) {
        throw new TokenInvalidError('Authentication required');
      }
      await SessionService.revokeSession(req.params['id'] as string, req.auth.userId);
      res.status(200).json({
        success: true,
        data: { message: 'Session revoked successfully' },
      });
    } catch (err) {
      next(err);
    }
  }
}
