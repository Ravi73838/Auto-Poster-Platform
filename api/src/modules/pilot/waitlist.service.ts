import { prisma } from '../../shared/db/index.js';
import { WAITLIST_STATUSES, ROLES, type Role } from '@ap/shared-constants';
import { InviteCodeService } from './invite-code.service.js';
import { NotFoundError, ValidationError } from '../../shared/errors/index.js';

export class WaitlistService {
  static async submit(params: {
    role: Role;
    contact: string;
    cityName: string;
    name?: string;
    vehicleType?: string;
    companyName?: string;
    language?: string;
    source?: string;
    notes?: string;
  }): Promise<any> {
    const contact = (params.contact || '').trim();
    if (!contact) {
      throw new ValidationError('Contact (phone or email) is required');
    }

    const isEmail = contact.includes('@');
    const phone = isEmail ? null : contact;
    const email = isEmail ? contact.toLowerCase() : null;

    // Check for existing pending entry
    const existing = await prisma.waitlistEntry.findFirst({
      where: {
        role: params.role,
        OR: [
          phone ? { phone } : undefined,
          email ? { email } : undefined,
        ].filter(Boolean) as any[],
        status: WAITLIST_STATUSES.NEW,
      },
    });

    if (existing) {
      return {
        id: existing.id,
        status: existing.status,
        message: 'You are already on the priority pilot waitlist. We will notify you once capacity opens up.',
      };
    }

    const entry = await prisma.waitlistEntry.create({
      data: {
        role: params.role,
        phone,
        email,
        name: params.name || null,
        cityName: params.cityName,
        vehicleType: params.vehicleType || null,
        companyName: params.companyName || null,
        status: WAITLIST_STATUSES.NEW,
        notes: params.notes || null,
      },
    });

    return {
      id: entry.id,
      status: entry.status,
      message: 'Successfully joined the pilot waitlist! You will receive an invite code when a slot becomes available.',
    };
  }

  static async list(params: {
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
      prisma.waitlistEntry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.waitlistEntry.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  static async updateStatus(id: string, status: string, notes?: string): Promise<any> {
    const entry = await prisma.waitlistEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundError('Waitlist entry not found');

    return prisma.waitlistEntry.update({
      where: { id },
      data: {
        status,
        notes: notes !== undefined ? notes : entry.notes,
      },
    });
  }

  static async invite(id: string, creatorUserId?: string): Promise<{ waitlistEntry: any; inviteCode: any }> {
    const entry = await prisma.waitlistEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundError('Waitlist entry not found');

    const inviteCode = await InviteCodeService.createCode({
      role: entry.role,
      maxUses: 1,
      metadata: { waitlistEntryId: entry.id, contact: entry.phone || entry.email },
      creatorUserId,
    });

    const updatedEntry = await prisma.waitlistEntry.update({
      where: { id },
      data: {
        status: WAITLIST_STATUSES.INVITED,
        notes: `Invited with code ${inviteCode.code}`,
      },
    });

    return { waitlistEntry: updatedEntry, inviteCode };
  }
}
