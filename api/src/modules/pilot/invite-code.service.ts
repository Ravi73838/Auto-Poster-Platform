import crypto from 'node:crypto';
import { prisma } from '../../shared/db/index.js';
import { clock } from '../../shared/clock/index.js';
import {
  ROLES,
  INVITE_CODE_STATUSES,
  ERROR_CODES,
  type Role,
} from '@ap/shared-constants';
import { AppError, NotFoundError, ValidationError } from '../../shared/errors/index.js';

export class InviteCodeService {
  private static generateRandomCode(role: Role): string {
    const prefix = role === ROLES.DRIVER ? 'DRV' : 'CMP';
    const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `PILOT-${prefix}-${rand}`;
  }

  static async validateCode(code: string, role?: Role): Promise<{
    valid: boolean;
    inviteCode?: any;
    reason?: string;
  }> {
    if (!code || typeof code !== 'string') {
      return { valid: false, reason: 'Invite code is required' };
    }

    const cleanCode = code.trim().toUpperCase();
    const invite = await prisma.inviteCode.findUnique({
      where: { code: cleanCode },
    });

    if (!invite) {
      return { valid: false, reason: 'Invalid invite code' };
    }

    if (invite.status !== INVITE_CODE_STATUSES.ACTIVE) {
      return { valid: false, reason: `Invite code is ${invite.status.toLowerCase()}` };
    }

    if (invite.expiresAt && invite.expiresAt < clock.now()) {
      return { valid: false, reason: 'Invite code has expired' };
    }

    if (invite.usedCount >= invite.maxUses) {
      return { valid: false, reason: 'Invite code usage limit reached' };
    }

    if (role && invite.role !== role) {
      return { valid: false, reason: `Invite code is only valid for ${invite.role.toLowerCase()} accounts` };
    }

    return { valid: true, inviteCode: invite };
  }

  static async consumeCode(code: string): Promise<any> {
    const cleanCode = code.trim().toUpperCase();
    const invite = await prisma.inviteCode.findUnique({
      where: { code: cleanCode },
    });

    if (!invite) {
      throw new NotFoundError('Invite code not found');
    }

    if (invite.status !== INVITE_CODE_STATUSES.ACTIVE || invite.usedCount >= invite.maxUses) {
      throw new AppError(
        ERROR_CODES.INVITE_CODE_EXHAUSTED,
        400,
        'This invite code is exhausted or inactive',
      );
    }

    const nextUsed = invite.usedCount + 1;
    const isExhausted = nextUsed >= invite.maxUses;

    return prisma.inviteCode.update({
      where: { id: invite.id },
      data: {
        usedCount: nextUsed,
        status: isExhausted ? INVITE_CODE_STATUSES.EXHAUSTED : INVITE_CODE_STATUSES.ACTIVE,
      },
    });
  }

  static async createCode(params: {
    code?: string;
    role: Role;
    campaignId?: string;
    cityId?: string;
    maxUses?: number;
    expiresAt?: Date;
    metadata?: any;
    creatorUserId?: string;
  }): Promise<any> {
    const finalCode = (params.code ? params.code.trim().toUpperCase() : this.generateRandomCode(params.role));

    return prisma.inviteCode.create({
      data: {
        code: finalCode,
        role: params.role,
        campaignId: params.campaignId || null,
        cityId: params.cityId || null,
        maxUses: params.maxUses || 1,
        expiresAt: params.expiresAt || null,
        metadata: params.metadata || null,
        createdById: params.creatorUserId || null,
        status: INVITE_CODE_STATUSES.ACTIVE,
      },
    });
  }

  static async createBatch(params: {
    role: Role;
    count: number;
    maxUsesPerCode?: number;
    campaignId?: string;
    cityId?: string;
    expiresAt?: Date;
    creatorUserId?: string;
  }): Promise<any[]> {
    const count = Math.min(Math.max(params.count || 1, 1), 100);
    const codes: any[] = [];

    for (let i = 0; i < count; i++) {
      const code = await this.createCode({
        role: params.role,
        maxUses: params.maxUsesPerCode || 1,
        campaignId: params.campaignId,
        cityId: params.cityId,
        expiresAt: params.expiresAt,
        creatorUserId: params.creatorUserId,
      });
      codes.push(code);
    }

    return codes;
  }

  static async listCodes(params: {
    role?: Role;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: any[]; total: number; page: number; limit: number }> {
    const page = Math.max(Number(params.page) || 1, 1);
    const limit = Math.min(Math.max(Number(params.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.role) where.role = params.role;
    if (params.status) where.status = params.status;

    const [items, total] = await Promise.all([
      prisma.inviteCode.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { createdBy: { select: { id: true, email: true } } },
      }),
      prisma.inviteCode.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  static async revokeCode(codeId: string): Promise<any> {
    return prisma.inviteCode.update({
      where: { id: codeId },
      data: { status: INVITE_CODE_STATUSES.REVOKED },
    });
  }
}
