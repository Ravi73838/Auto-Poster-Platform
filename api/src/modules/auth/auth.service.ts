import crypto from 'node:crypto';
import {
  ROLES,
  OTP_PURPOSES,
  ACCOUNT_STATUS,
  type Role,
  type AccountStatus,
  type Language,
} from '@ap/shared-constants';
import {
  type DriverOtpVerifyInput,
  type CompanyRegisterInput,
  type CompanyLoginInput,
  type AdminLoginInput,
  type ResetPasswordInput,
  type ChangePasswordInput,
  type UpdatePreferencesInput,
  type CreateAdminInput,
} from '@ap/shared-validation';
import {
  type AuthUser,
  type LoginResponse,
  type AdminLoginChallengeResponse,
  type AuthMeResponse,
  type AdminUserDto,
  type CreateAdminResponse,
} from '@ap/shared-types';
import { prisma } from '../../shared/db/index.js';
import { redisClient } from '../../shared/redis/index.js';
import { OtpService } from './otp.service.js';
import { LegalService } from '../admin/content/legal.service.js';
import { TokenService } from './token.service.js';
import { SessionService } from './session.service.js';
import { PasswordService } from './password.service.js';
import { AuditService } from '../audit/audit.service.js';
import {
  InvalidCredentialsError,
  EmailAlreadyRegisteredError,
  MobileAlreadyRegisteredError,
  MobileNotVerifiedError,
  AccountBlockedError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
  OtpInvalidError,
} from '../../shared/errors/index.js';
import { logger } from '../../shared/logger/index.js';

export interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

export class AuthService {
  /**
   * Helper to format user record into AuthUser DTO.
   */
  static formatAuthUser(user: {
    id: string;
    role: Role;
    status: AccountStatus;
    mobile: string;
    email: string | null;
    preferredLanguage: string;
    preferredTheme: string;
    twoFactorEnabled: boolean;
    mustChangePassword: boolean;
    mobileVerifiedAt: Date | null;
    emailVerifiedAt: Date | null;
  }): AuthUser {
    return {
      id: user.id,
      role: user.role,
      status: user.status,
      mobile: user.mobile,
      email: user.email,
      preferredLanguage: user.preferredLanguage,
      preferredTheme: user.preferredTheme,
      twoFactorEnabled: user.twoFactorEnabled,
      mustChangePassword: user.mustChangePassword,
      mobileVerifiedAt: user.mobileVerifiedAt ? user.mobileVerifiedAt.toISOString() : null,
      emailVerifiedAt: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null,
    };
  }

  // ---------------------------------------------------------
  // DRIVER AUTH FLOW
  // ---------------------------------------------------------

  static async requestDriverOtp(
    mobile: string,
    context?: RequestContext,
    language?: Language,
  ): Promise<{ expiresAt: Date }> {
    const result = await OtpService.requestOtp({
      target: mobile,
      purpose: OTP_PURPOSES.LOGIN,
      ipAddress: context?.ipAddress,
      language,
    });

    logger.info({ mobile }, 'Driver login OTP requested');
    return result;
  }

  static async verifyDriverOtp(
    input: DriverOtpVerifyInput,
    context?: RequestContext,
  ): Promise<LoginResponse> {
    const { mobile, code, device } = input;

    await OtpService.verifyOtp({
      target: mobile,
      purpose: OTP_PURPOSES.LOGIN,
      code,
    });

    let isNewUser = false;
    let user = await prisma.user.findUnique({
      where: { mobile },
    });

    if (!user) {
      isNewUser = true;
      user = await prisma.user.create({
        data: {
          role: ROLES.DRIVER,
          mobile,
          status: ACCOUNT_STATUS.PENDING,
          mobileVerifiedAt: new Date(),
        },
      });

      // Create initial driver profile
      await prisma.driverProfile.create({
        data: {
          userId: user.id,
        },
      });

      await AuditService.log({
        actorId: user.id,
        actorType: 'USER',
        action: 'auth.driver_registered',
        entityType: 'User',
        entityId: user.id,
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
      });
    } else {
      if (user.deletedAt !== null || user.status === ACCOUNT_STATUS.BLOCKED) {
        throw new AccountBlockedError('Driver account has been blocked or deactivated');
      }

      if (!user.mobileVerifiedAt) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { mobileVerifiedAt: new Date() },
        });
      }
    }

    const { session, rawRefreshToken, accessToken } = await TokenService.createSession({
      userId: user.id,
      platform: device?.platform ?? 'ANDROID',
      userAgent: context?.userAgent,
      ipAddress: context?.ipAddress,
      appVersion: device?.appVersion,
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await AuditService.log({
      actorId: user.id,
      actorType: 'USER',
      action: 'auth.login_success',
      entityType: 'Session',
      entityId: session.id,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user: this.formatAuthUser(user),
      isNewUser,
    };
  }

  // ---------------------------------------------------------
  // COMPANY AUTH FLOW
  // ---------------------------------------------------------

  static async registerCompany(
    input: CompanyRegisterInput,
    context?: RequestContext,
  ): Promise<{ message: string; mobile?: string }> {
    const { email, mobile, password, language } = input;

    // Check duplicate email
    const existingEmail = await prisma.user.findFirst({
      where: { email },
    });
    if (existingEmail) {
      throw new EmailAlreadyRegisteredError('An account with this email address already exists');
    }

    // Check duplicate mobile
    const existingMobile = await prisma.user.findFirst({
      where: { mobile },
    });
    if (existingMobile) {
      throw new MobileAlreadyRegisteredError('An account with this mobile number already exists');
    }

    const passwordHash = await PasswordService.hash(password);

    const user = await prisma.user.create({
      data: {
        role: ROLES.COMPANY,
        email,
        mobile,
        passwordHash,
        status: ACCOUNT_STATUS.PENDING,
        preferredLanguage: language,
        mobileVerifiedAt: null,
      },
    });

    // Create skeleton company profile
    await prisma.companyProfile.create({
      data: {
        userId: user.id,
        companyName: email.split('@')[0] || 'Company',
        contactPersonName: 'Contact Person',
        contactPersonPhone: mobile,
        legalName: 'Pending Registration',
        brandName: 'Pending Registration',
      },
    });

    // Send REGISTER OTP to verify mobile
    await OtpService.requestOtp({
      target: mobile,
      purpose: OTP_PURPOSES.REGISTER,
      ipAddress: context?.ipAddress,
      language: language as Language,
    });

    await AuditService.log({
      actorId: user.id,
      actorType: 'USER',
      action: 'auth.company_registered',
      entityType: 'User',
      entityId: user.id,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return {
      message: 'Registration initiated. Verification code sent to your mobile.',
      mobile,
    };
  }

  static async verifyCompanyMobile(
    mobile: string,
    code: string,
    context?: RequestContext,
  ): Promise<{ accessToken: string; rawRefreshToken: string; user: AuthUser }> {
    await OtpService.verifyOtp({
      target: mobile,
      purpose: OTP_PURPOSES.REGISTER,
      code,
    });

    const user = await prisma.user.findUnique({
      where: { mobile },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { mobileVerifiedAt: new Date() },
    });

    await AuditService.log({
      actorId: user.id,
      actorType: 'USER',
      action: 'auth.mobile_verified',
      entityType: 'User',
      entityId: user.id,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    const { rawRefreshToken, accessToken } = await TokenService.createSession({
      userId: user.id,
      platform: 'WEB',
      userAgent: context?.userAgent,
      ipAddress: context?.ipAddress,
    });

    return {
      accessToken,
      rawRefreshToken,
      user: this.formatAuthUser(updatedUser),
    };
  }

  static async loginCompany(
    input: CompanyLoginInput,
    context?: RequestContext,
  ): Promise<{ accessToken: string; rawRefreshToken: string; user: AuthUser }> {
    const { email, password } = input;

    await PasswordService.checkLockout(email);

    const user = await prisma.user.findFirst({
      where: { email, role: ROLES.COMPANY, deletedAt: null },
    });

    if (!user || !user.passwordHash) {
      await PasswordService.performDummyVerify(password);
      await PasswordService.recordFailedAttempt(email);
      throw new InvalidCredentialsError('Invalid email or password');
    }

    const isValid = await PasswordService.verify(password, user.passwordHash);
    if (!isValid) {
      await PasswordService.recordFailedAttempt(email);
      throw new InvalidCredentialsError('Invalid email or password');
    }

    await PasswordService.clearFailedAttempts(email);

    if (user.status === ACCOUNT_STATUS.BLOCKED) {
      throw new AccountBlockedError('Your account has been blocked. Please contact support.');
    }

    if (!user.mobileVerifiedAt) {
      throw new MobileNotVerifiedError(
        'Your mobile number has not been verified. Please complete mobile verification to proceed.',
      );
    }

    const { session, rawRefreshToken, accessToken } = await TokenService.createSession({
      userId: user.id,
      platform: 'WEB',
      userAgent: context?.userAgent,
      ipAddress: context?.ipAddress,
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await AuditService.log({
      actorId: user.id,
      actorType: 'USER',
      action: 'auth.login_success',
      entityType: 'Session',
      entityId: session.id,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return {
      accessToken,
      rawRefreshToken,
      user: this.formatAuthUser(user),
    };
  }

  // ---------------------------------------------------------
  // ADMIN AUTH FLOW (2-Step Verification)
  // ---------------------------------------------------------

  static async loginAdminStep1(
    input: AdminLoginInput,
    context?: RequestContext,
  ): Promise<AdminLoginChallengeResponse> {
    const { email, password } = input;

    await PasswordService.checkLockout(email);

    const user = await prisma.user.findFirst({
      where: {
        email,
        role: { in: [ROLES.SUPER_ADMIN, ROLES.MODERATOR, ROLES.FINANCE] },
        deletedAt: null,
      },
    });

    if (!user || !user.passwordHash) {
      await PasswordService.performDummyVerify(password);
      await PasswordService.recordFailedAttempt(email);
      throw new InvalidCredentialsError('Invalid email or password');
    }

    const isValid = await PasswordService.verify(password, user.passwordHash);
    if (!isValid) {
      await PasswordService.recordFailedAttempt(email);
      throw new InvalidCredentialsError('Invalid email or password');
    }

    await PasswordService.clearFailedAttempts(email);

    if (user.status === ACCOUNT_STATUS.BLOCKED) {
      throw new AccountBlockedError('Admin account has been blocked');
    }

    // Generate 2FA Challenge ID
    const challengeId = crypto.randomUUID();

    if (redisClient) {
      await redisClient.set(
        `challenge:2fa:${challengeId}`,
        user.id,
        'EX',
        300, // 5 minutes TTL
      );
    }

    // Send 2FA OTP to admin verified mobile
    await OtpService.requestOtp({
      target: user.mobile,
      purpose: OTP_PURPOSES.ADMIN_2FA,
      ipAddress: context?.ipAddress,
      language: (user.preferredLanguage as Language) ?? 'en',
    });

    const maskedMobile = `${user.mobile.slice(0, 3)}******${user.mobile.slice(-4)}`;

    await AuditService.log({
      actorId: user.id,
      actorType: 'USER',
      action: 'auth.admin_2fa_challenge_issued',
      entityType: 'User',
      entityId: user.id,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return {
      twoFactorRequired: true,
      challengeId,
      maskedMobile,
    };
  }

  static async loginAdminStep2(
    challengeId: string,
    code: string,
    context?: RequestContext,
  ): Promise<{
    accessToken: string;
    rawRefreshToken: string;
    user: AuthUser;
    mustChangePassword: boolean;
  }> {
    let userId: string | null = null;

    if (redisClient) {
      userId = await redisClient.get(`challenge:2fa:${challengeId}`);
    }

    if (!userId) {
      throw new OtpInvalidError('2FA challenge has expired or is invalid. Please sign in again.');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    await OtpService.verifyOtp({
      target: user.mobile,
      purpose: OTP_PURPOSES.ADMIN_2FA,
      code,
    });

    // Remove challenge
    if (redisClient) {
      await redisClient.del(`challenge:2fa:${challengeId}`);
    }

    const { session, rawRefreshToken, accessToken } = await TokenService.createSession({
      userId: user.id,
      platform: 'WEB',
      userAgent: context?.userAgent,
      ipAddress: context?.ipAddress,
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await AuditService.log({
      actorId: user.id,
      actorType: 'USER',
      action: 'auth.admin_login_success',
      entityType: 'Session',
      entityId: session.id,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return {
      accessToken,
      rawRefreshToken,
      user: this.formatAuthUser(user),
      mustChangePassword: user.mustChangePassword,
    };
  }

  // ---------------------------------------------------------
  // PASSWORD MANAGEMENT
  // ---------------------------------------------------------

  static async forgotPassword(
    email: string,
    context?: RequestContext,
  ): Promise<{ message: string }> {
    const user = await prisma.user.findFirst({
      where: { email, deletedAt: null },
    });

    if (
      user &&
      ([ROLES.COMPANY, ROLES.SUPER_ADMIN, ROLES.MODERATOR, ROLES.FINANCE] as Role[]).includes(user.role)
    ) {
      await OtpService.requestOtp({
        target: user.mobile,
        purpose: OTP_PURPOSES.PASSWORD_RESET,
        ipAddress: context?.ipAddress,
        language: (user.preferredLanguage as Language) ?? 'en',
      });

      await AuditService.log({
        actorId: user.id,
        actorType: 'USER',
        action: 'auth.password_reset_requested',
        entityType: 'User',
        entityId: user.id,
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
      });
    }

    // Always respond with identical message to prevent account enumeration
    return {
      message: 'If an account exists with this email, a verification code has been dispatched.',
    };
  }

  static async resetPassword(
    input: ResetPasswordInput,
    context?: RequestContext,
  ): Promise<{ message: string }> {
    const { email, code, newPassword } = input;

    const user = await prisma.user.findFirst({
      where: { email, deletedAt: null },
    });

    if (!user) {
      throw new OtpInvalidError('Invalid or expired verification code');
    }

    await OtpService.verifyOtp({
      target: user.mobile,
      purpose: OTP_PURPOSES.PASSWORD_RESET,
      code,
    });

    const newPasswordHash = await PasswordService.hash(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        passwordChangedAt: new Date(),
        mustChangePassword: false,
      },
    });

    // Revoke all active sessions upon password reset
    await SessionService.revokeAllSessions(user.id);

    await AuditService.log({
      actorId: user.id,
      actorType: 'USER',
      action: 'auth.password_reset_completed',
      entityType: 'User',
      entityId: user.id,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return { message: 'Password has been reset successfully. Please sign in.' };
  }

  static async changePassword(
    userId: string,
    currentSessionId: string,
    input: ChangePasswordInput,
    context?: RequestContext,
  ): Promise<{ message: string }> {
    const { currentPassword, newPassword } = input;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.passwordHash) {
      throw new NotFoundError('User not found');
    }

    const isValid = await PasswordService.verify(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new InvalidCredentialsError('Current password is incorrect');
    }

    const newPasswordHash = await PasswordService.hash(newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
        passwordChangedAt: new Date(),
        mustChangePassword: false,
      },
    });

    // Revoke all other sessions except current session
    await SessionService.revokeAllSessions(userId, currentSessionId);

    await AuditService.log({
      actorId: userId,
      actorType: 'USER',
      action: 'auth.password_changed',
      entityType: 'User',
      entityId: userId,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return { message: 'Password changed successfully' };
  }

  // ---------------------------------------------------------
  // USER CONTEXT & PREFERENCES
  // ---------------------------------------------------------

  static async getMe(userId: string, permissions: string[]): Promise<AuthMeResponse> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const pendingConsents = await LegalService.getUserPendingConsents(userId).catch(() => []);

    return {
      user: this.formatAuthUser(user),
      role: user.role,
      status: user.status,
      permissions,
      preferences: {
        language: user.preferredLanguage,
        theme: user.preferredTheme,
      },
      mustChangePassword: user.mustChangePassword,
      profileCompleteness: false,
      pendingConsents: pendingConsents.length > 0 ? pendingConsents : undefined,
    };
  }

  static async updatePreferences(
    userId: string,
    input: UpdatePreferencesInput,
  ): Promise<{ language: string; theme: string }> {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.language ? { preferredLanguage: input.language } : {}),
        ...(input.theme ? { preferredTheme: input.theme } : {}),
      },
    });

    return {
      language: user.preferredLanguage,
      theme: user.preferredTheme,
    };
  }

  // ---------------------------------------------------------
  // ADMIN TEAM MANAGEMENT
  // ---------------------------------------------------------

  static async createAdmin(
    actorId: string,
    input: CreateAdminInput,
    context?: RequestContext,
  ): Promise<CreateAdminResponse> {
    const { email, mobile, role } = input;

    const existingEmail = await prisma.user.findFirst({ where: { email } });
    if (existingEmail) {
      throw new ConflictError('An account with this email already exists');
    }

    const existingMobile = await prisma.user.findFirst({ where: { mobile } });
    if (existingMobile) {
      throw new ConflictError('An account with this mobile already exists');
    }

    // Generate random temporary password
    const temporaryPassword = `${crypto.randomBytes(6).toString('hex')}Aa1!`;
    const passwordHash = await PasswordService.hash(temporaryPassword);

    const admin = await prisma.user.create({
      data: {
        role,
        email,
        mobile,
        passwordHash,
        status: ACCOUNT_STATUS.APPROVED,
        mustChangePassword: true,
        mobileVerifiedAt: new Date(),
        emailVerifiedAt: new Date(),
      },
    });

    await AuditService.log({
      actorId,
      actorType: 'USER',
      action: 'admin.team_member_created',
      entityType: 'User',
      entityId: admin.id,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      newValues: { email, mobile, role },
    });

    return {
      admin: {
        id: admin.id,
        email: admin.email!,
        mobile: admin.mobile,
        role: admin.role,
        status: admin.status,
        mustChangePassword: admin.mustChangePassword,
        lastLoginAt: admin.lastLoginAt ? admin.lastLoginAt.toISOString() : null,
        createdAt: admin.createdAt.toISOString(),
      },
      temporaryPassword,
    };
  }

  static async listAdmins(): Promise<AdminUserDto[]> {
    const admins = await prisma.user.findMany({
      where: {
        role: { in: [ROLES.SUPER_ADMIN, ROLES.MODERATOR, ROLES.FINANCE] },
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    return admins.map((a) => ({
      id: a.id,
      email: a.email!,
      mobile: a.mobile,
      role: a.role,
      status: a.status,
      mustChangePassword: a.mustChangePassword,
      lastLoginAt: a.lastLoginAt ? a.lastLoginAt.toISOString() : null,
      createdAt: a.createdAt.toISOString(),
    }));
  }

  static async updateAdminRole(
    actorId: string,
    targetUserId: string,
    newRole: Role,
    context?: RequestContext,
  ): Promise<AdminUserDto> {
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      throw new NotFoundError('Admin user not found');
    }

    // Check last super admin guard
    if (targetUser.role === ROLES.SUPER_ADMIN && newRole !== ROLES.SUPER_ADMIN) {
      const activeSuperAdmins = await prisma.user.count({
        where: {
          role: ROLES.SUPER_ADMIN,
          status: ACCOUNT_STATUS.APPROVED,
          deletedAt: null,
        },
      });

      if (activeSuperAdmins <= 1) {
        throw new ForbiddenError('Cannot demote the last remaining active Super Admin');
      }
    }

    const updated = await prisma.user.update({
      where: { id: targetUserId },
      data: { role: newRole },
    });

    await AuditService.log({
      actorId,
      actorType: 'USER',
      action: 'admin.role_changed',
      entityType: 'User',
      entityId: targetUserId,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      oldValues: { role: targetUser.role },
      newValues: { role: newRole },
    });

    return {
      id: updated.id,
      email: updated.email!,
      mobile: updated.mobile,
      role: updated.role,
      status: updated.status,
      mustChangePassword: updated.mustChangePassword,
      lastLoginAt: updated.lastLoginAt ? updated.lastLoginAt.toISOString() : null,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  static async updateAdminStatus(
    actorId: string,
    targetUserId: string,
    newStatus: AccountStatus,
    context?: RequestContext,
  ): Promise<AdminUserDto> {
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      throw new NotFoundError('Admin user not found');
    }

    // A Super Admin cannot suspend or block themselves
    if (actorId === targetUserId && (newStatus === ACCOUNT_STATUS.SUSPENDED || newStatus === ACCOUNT_STATUS.BLOCKED)) {
      throw new ForbiddenError('Super Admins cannot suspend or block their own account');
    }

    // Check last super admin guard
    if (targetUser.role === ROLES.SUPER_ADMIN && newStatus !== ACCOUNT_STATUS.APPROVED) {
      const activeSuperAdmins = await prisma.user.count({
        where: {
          role: ROLES.SUPER_ADMIN,
          status: ACCOUNT_STATUS.APPROVED,
          deletedAt: null,
          id: { not: targetUserId },
        },
      });

      if (activeSuperAdmins < 1) {
        throw new ForbiddenError('Cannot deactivate or suspend the last active Super Admin');
      }
    }

    const updated = await prisma.user.update({
      where: { id: targetUserId },
      data: { status: newStatus },
    });

    // If suspended or blocked, immediately revoke all active sessions
    if (newStatus === ACCOUNT_STATUS.BLOCKED || newStatus === ACCOUNT_STATUS.SUSPENDED) {
      await SessionService.revokeAllSessions(targetUserId);
    }

    await AuditService.log({
      actorId,
      actorType: 'USER',
      action: 'admin.status_changed',
      entityType: 'User',
      entityId: targetUserId,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      oldValues: { status: targetUser.status },
      newValues: { status: newStatus },
    });

    return {
      id: updated.id,
      email: updated.email!,
      mobile: updated.mobile,
      role: updated.role,
      status: updated.status,
      mustChangePassword: updated.mustChangePassword,
      lastLoginAt: updated.lastLoginAt ? updated.lastLoginAt.toISOString() : null,
      createdAt: updated.createdAt.toISOString(),
    };
  }
}
