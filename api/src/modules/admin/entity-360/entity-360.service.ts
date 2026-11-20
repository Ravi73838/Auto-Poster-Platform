import { prisma } from '../../../shared/db/index.js';
import { NotFoundError } from '../../../shared/errors/index.js';
import { maskPhone, maskEmail, maskGstin, maskPan, maskBankAccount } from '../../../shared/pii.js';
import { computeShallowDiff } from '../../audit/audit.service.js';

export class Entity360Service {
  /**
   * List drivers with search and filtering for admin table.
   */
  static async listDrivers(params: {
    page?: number;
    limit?: number;
    q?: string;
    kycStatus?: string;
    status?: string;
  }): Promise<{ drivers: any[]; total: number }> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 25));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.kycStatus) {
      if (params.kycStatus === 'SUBMITTED') {
        where.user = {
          ...where.user,
          OR: [
            { status: 'PENDING' },
            { kycSubmissions: { some: { status: 'SUBMITTED' } } },
          ],
        };
      } else if (params.kycStatus === 'APPROVED') {
        where.user = {
          ...where.user,
          status: 'APPROVED',
        };
      } else if (params.kycStatus === 'REJECTED') {
        where.user = {
          ...where.user,
          kycSubmissions: { some: { status: 'REJECTED' } },
        };
      } else {
        where.user = {
          ...where.user,
          kycSubmissions: { some: { status: params.kycStatus as any } },
        };
      }
    }
    if (params.status) {
      where.user = { ...where.user, status: params.status };
    }
    if (params.q) {
      const q = params.q.trim();
      where.OR = [
        { fullName: { contains: q, mode: 'insensitive' } },
        { user: { mobile: { contains: q } } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [drivers, total] = await Promise.all([
      prisma.driverProfile.findMany({
        where,
        include: {
          user: {
            include: {
              kycSubmissions: {
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          },
          city: true,
          currentVehicle: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.driverProfile.count({ where }),
    ]);

    return {
      drivers: drivers.map((d) => ({
        id: d.id,
        userId: d.userId,
        fullName: d.fullName,
        mobile: maskPhone(d.user.mobile),
        email: maskEmail(d.user.email),
        status: d.user.status,
        kycStatus: d.user.kycSubmissions?.[0]?.status || (d.user.status === 'APPROVED' ? 'APPROVED' : 'PENDING'),
        cityName: d.city?.name || 'Unassigned',
        vehicleNumber: d.currentVehicle?.registrationNumber || 'Unassigned',
        createdAt: d.createdAt.toISOString(),
      })),
      total,
    };
  }

  /**
   * List companies with search and filtering for admin table.
   */
  static async listCompanies(params: {
    page?: number;
    limit?: number;
    q?: string;
    isVerified?: boolean;
    status?: string;
  }): Promise<{ companies: any[]; total: number }> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 25));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.isVerified !== undefined) {
      where.isVerified = params.isVerified;
    }
    if (params.status) {
      where.user = { ...where.user, status: params.status };
    }
    if (params.q) {
      const q = params.q.trim();
      where.OR = [
        { companyName: { contains: q, mode: 'insensitive' } },
        { brandName: { contains: q, mode: 'insensitive' } },
        { legalName: { contains: q, mode: 'insensitive' } },
        { gstin: { contains: q, mode: 'insensitive' } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [companies, total] = await Promise.all([
      prisma.companyProfile.findMany({
        where,
        include: {
          user: true,
          city: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.companyProfile.count({ where }),
    ]);

    return {
      companies: companies.map((c) => ({
        id: c.id,
        userId: c.userId,
        companyName: c.companyName,
        brandName: c.brandName,
        legalName: c.legalName,
        gstin: maskGstin(c.gstin),
        contactPersonPhone: maskPhone(c.contactPersonPhone),
        email: maskEmail(c.user.email),
        isVerified: c.isVerified,
        status: c.user.status,
        cityName: c.city?.name || 'Unassigned',
        createdAt: c.createdAt.toISOString(),
      })),
      total,
    };
  }

  /**
   * Comprehensive 360-degree overview of a driver.
   */
  static async getDriverOverview(driverProfileId: string): Promise<any> {
    const driver = await prisma.driverProfile.findUnique({
      where: { id: driverProfileId },
      include: {
        user: true,
        city: true,
        currentVehicle: true,
      },
    });

    if (!driver) {
      throw new NotFoundError('Driver not found');
    }

    const [kycSubmissions, assignments, strikes, disputes, auditLogs, payouts, documents] =
      await Promise.all([
        prisma.kycSubmission.findMany({
          where: { userId: driver.userId },
          orderBy: { submittedAt: 'desc' },
          take: 5,
        }),
        prisma.assignment.findMany({
          where: { driverId: driver.userId },
          include: { campaign: { select: { id: true, title: true, status: true } } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
        prisma.strike.findMany({
          where: { driverId: driver.userId },
          orderBy: { issuedAt: 'desc' },
        }),
        prisma.dispute.findMany({
          where: { raisedByUserId: driver.userId },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
        prisma.auditLog.findMany({
          where: {
            OR: [
              { entityId: driver.id },
              { entityId: driver.userId },
            ],
          },
          include: { actor: { select: { email: true, role: true } } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
        prisma.payout.findMany({
          where: { driverId: driver.userId },
          orderBy: { requestedAt: 'desc' },
          take: 10,
        }),
        prisma.document.findMany({
          where: { userId: driver.userId },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

    const pendingPayouts = payouts.filter(
      (p) => p.status === 'PENDING' || p.status === 'APPROVED' || p.status === 'PROCESSING',
    );
    const paidPaise = payouts
      .filter((p) => p.status === 'PAID')
      .reduce((acc, p) => acc + BigInt(p.amountPaise), 0n);
    const availablePaise =
      driver.lifetimeEarningsPaise > paidPaise
        ? driver.lifetimeEarningsPaise - paidPaise
        : 0n;

    return {
      financialSummary: {
        totalEarnedPaise: driver.lifetimeEarningsPaise.toString(),
        availableBalancePaise: availablePaise.toString(),
        pendingPayoutsCount: pendingPayouts.length,
      },
      profile: {
        id: driver.id,
        userId: driver.userId,
        fullName: driver.fullName || 'Driver',
        mobile: maskPhone(driver.user.mobile),
        email: maskEmail(driver.user.email),
        status: driver.user.status,
        kycStatus: kycSubmissions[0]?.status || (driver.user.status === 'APPROVED' ? 'APPROVED' : 'PENDING'),
        rating: driver.rating,
        strikesCount: driver.strikesCount,
        bannedUntil: driver.bannedUntil ? driver.bannedUntil.toISOString() : null,
        lifetimeEarningsPaise: driver.lifetimeEarningsPaise.toString(),
        completedCampaignsCount: driver.completedCampaignsCount,
        totalKmDriven: driver.totalKmDriven,
        payoutMethod: driver.payoutMethod,
        bankIfsc: driver.bankIfsc || null,
        bankAccountName: driver.bankAccountName || null,
        bankAccountNumberMasked: driver.bankAccountNumberEncrypted ? maskBankAccount('1234567890') : null,
        upiIdMasked: driver.upiIdMasked || null,
        cityName: driver.city?.name || null,
        isAvailable: driver.isAvailable,
        createdAt: driver.user.createdAt.toISOString(),
      },
      currentVehicle: driver.currentVehicle
        ? {
            id: driver.currentVehicle.id,
            registrationNumber: driver.currentVehicle.registrationNumber,
            vehicleType: driver.currentVehicle.vehicleType,
            ownerName: driver.currentVehicle.ownerName,
            isVerified: driver.currentVehicle.isVerified,
          }
        : null,
      kyc: kycSubmissions.map((k) => ({
        id: k.id,
        attemptNo: k.attemptNo,
        status: k.status,
        submittedAt: k.submittedAt.toISOString(),
        reviewedAt: k.reviewedAt ? k.reviewedAt.toISOString() : null,
        decisionNote: k.decisionNote,
      })),
      assignments: assignments.map((a) => ({
        id: a.id,
        campaignId: a.campaign.id,
        campaignTitle: a.campaign.title,
        status: a.status,
        verifiedDays: a.verifiedDays,
        missedDays: a.missedDays,
        rentPaidPaise: a.rentPaidPaise.toString(),
        createdAt: a.createdAt.toISOString(),
      })),
      documents: documents.map((d) => ({
        id: d.id,
        type: d.documentType,
        status: d.status,
        fileUrl: d.fileUrl,
        createdAt: d.createdAt.toISOString(),
      })),
      strikes: strikes.map((s) => ({
        id: s.id,
        reason: s.reason,
        notes: s.notes,
        status: s.status,
        issuedAt: s.issuedAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
      })),
      disputes: disputes.map((disp) => ({
        id: disp.id,
        disputeNumber: disp.id.slice(0, 8),
        reason: disp.reason,
        status: disp.status,
        createdAt: disp.createdAt.toISOString(),
      })),
      payouts: payouts.map((p) => ({
        id: p.id,
        amountPaise: p.amountPaise.toString(),
        status: p.status,
        method: p.method,
        utr: p.utr,
        requestedAt: p.requestedAt.toISOString(),
      })),
      auditLogs: auditLogs.map((log) => ({
        id: log.id,
        action: log.action,
        actor: log.actor?.email || 'System',
        createdAt: log.createdAt.toISOString(),
        diff: computeShallowDiff(
          log.oldValues as Record<string, unknown> | null,
          log.newValues as Record<string, unknown> | null,
        ),
      })),
    };
  }

  /**
   * Comprehensive 360-degree overview of a company advertiser.
   */
  static async getCompanyOverview(companyProfileId: string): Promise<any> {
    const company = await prisma.companyProfile.findUnique({
      where: { id: companyProfileId },
      include: {
        user: true,
        city: true,
      },
    });

    if (!company) {
      throw new NotFoundError('Company not found');
    }

    const [campaigns, payments, refunds, disputes, auditLogs] = await Promise.all([
      prisma.campaign.findMany({
        where: { companyId: company.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.campaignPayment.findMany({
        where: { companyId: company.userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.refund.findMany({
        where: { companyId: company.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.dispute.findMany({
        where: { raisedByUserId: company.userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.auditLog.findMany({
        where: {
          OR: [
            { entityId: company.id },
            { entityId: company.userId },
          ],
        },
        include: { actor: { select: { email: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    const totalSpentPaise = payments
      .filter((p) => p.status === 'PAID')
      .reduce((acc, p) => acc + p.amountPaise, 0n);

    return {
      profile: {
        id: company.id,
        userId: company.userId,
        companyName: company.companyName,
        brandName: company.brandName,
        legalName: company.legalName,
        gstin: maskGstin(company.gstin),
        pan: maskPan(company.pan),
        contactPersonName: company.contactPersonName,
        contactPersonPhone: maskPhone(company.contactPersonPhone),
        email: maskEmail(company.user.email),
        isVerified: company.isVerified,
        status: company.user.status,
        cityName: company.city?.name || null,
        createdAt: company.createdAt.toISOString(),
      },
      financialSummary: {
        totalSpentPaise: totalSpentPaise.toString(),
        paymentsCount: payments.length,
        refundsCount: refunds.length,
      },
      campaigns: campaigns.map((cmp) => ({
        id: cmp.id,
        title: cmp.title,
        status: cmp.status,
        targetSlots: cmp.targetAutoCount,
        durationDays: Math.max(1, Math.round((cmp.endDate.getTime() - cmp.startDate.getTime()) / (1000 * 60 * 60 * 24))),
        totalBudgetPaise: cmp.totalBudgetPaise.toString(),
        createdAt: cmp.createdAt.toISOString(),
      })),
      payments: payments.map((p) => ({
        id: p.id,
        amountPaise: p.amountPaise.toString(),
        status: p.status,
        method: p.method,
        gatewayOrderId: p.gatewayOrderId,
        createdAt: p.createdAt.toISOString(),
      })),
      refunds: refunds.map((r) => ({
        id: r.id,
        amountPaise: r.amountPaise.toString(),
        status: r.status,
        reason: r.reason,
        createdAt: r.createdAt.toISOString(),
      })),
      disputes: disputes.map((d) => ({
        id: d.id,
        disputeNumber: d.id.slice(0, 8),
        reason: d.reason,
        status: d.status,
        createdAt: d.createdAt.toISOString(),
      })),
      auditLogs: auditLogs.map((log) => ({
        id: log.id,
        action: log.action,
        actor: log.actor?.email || 'System',
        createdAt: log.createdAt.toISOString(),
        diff: computeShallowDiff(
          log.oldValues as Record<string, unknown> | null,
          log.newValues as Record<string, unknown> | null,
        ),
      })),
    };
  }

  /**
   * Paginated audit logs query for system entities or global audit inspection.
   */
  static async listAuditLogs(params: {
    entityType?: string;
    entityId?: string;
    actorId?: string;
    action?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: any[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.entityType) where.entityType = params.entityType;
    if (params.entityId) where.entityId = params.entityId;
    if (params.actorId) where.actorId = params.actorId;
    if (params.action) where.action = { contains: params.action, mode: 'insensitive' };
    if (params.from || params.to) {
      where.createdAt = {};
      if (params.from) where.createdAt.gte = new Date(params.from);
      if (params.to) where.createdAt.lte = new Date(params.to);
    }

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        include: { actor: { select: { email: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const items = logs.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      actorType: log.actorType,
      actor: log.actor?.email || 'System',
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      createdAt: log.createdAt.toISOString(),
      diff: computeShallowDiff(
        log.oldValues as Record<string, unknown> | null,
        log.newValues as Record<string, unknown> | null,
      ),
      oldValues: log.oldValues,
      newValues: log.newValues,
    }));

    return { items, total, page, limit };
  }

  /**
   * Updates company verification and/or account status (Approve, Suspend, Block, etc.).
   */
  static async updateCompanyStatus(params: {
    companyId: string;
    status?: string;
    isVerified?: boolean;
    actorUserId?: string;
  }): Promise<any> {
    const profile = await prisma.companyProfile.findFirst({
      where: {
        OR: [{ id: params.companyId }, { userId: params.companyId }],
      },
      include: { user: true, city: true },
    });

    if (!profile) {
      throw new NotFoundError('Company not found');
    }

    const updatedUser = params.status
      ? await prisma.user.update({
          where: { id: profile.userId },
          data: { status: params.status as any },
        })
      : profile.user;

    const updatedProfile = await prisma.companyProfile.update({
      where: { id: profile.id },
      data: {
        ...(params.isVerified !== undefined ? { isVerified: params.isVerified } : {}),
      },
      include: { user: true, city: true },
    });

    await prisma.auditLog.create({
      data: {
        actorId: params.actorUserId || null,
        actorType: 'USER',
        action: 'COMPANY_STATUS_UPDATE',
        entityType: 'CompanyProfile',
        entityId: profile.id,
        oldValues: { status: profile.user.status, isVerified: profile.isVerified },
        newValues: { status: updatedUser.status, isVerified: updatedProfile.isVerified },
      },
    });

    return {
      id: updatedProfile.id,
      userId: updatedProfile.userId,
      companyName: updatedProfile.companyName,
      brandName: updatedProfile.brandName,
      legalName: updatedProfile.legalName,
      gstin: maskGstin(updatedProfile.gstin),
      contactPersonPhone: maskPhone(updatedProfile.contactPersonPhone),
      email: maskEmail(updatedProfile.user.email),
      isVerified: updatedProfile.isVerified,
      status: updatedUser.status,
      cityName: updatedProfile.city?.name || 'Unassigned',
      createdAt: updatedProfile.createdAt.toISOString(),
    };
  }

  /**
   * Updates driver account status.
   */
  static async updateDriverStatus(params: {
    driverId: string;
    status?: string;
    actorUserId?: string;
  }): Promise<any> {
    const profile = await prisma.driverProfile.findFirst({
      where: {
        OR: [{ id: params.driverId }, { userId: params.driverId }],
      },
      include: { user: true },
    });

    if (!profile) {
      throw new NotFoundError('Driver not found');
    }

    const updatedUser = params.status
      ? await prisma.user.update({
          where: { id: profile.userId },
          data: { status: params.status as any },
        })
      : profile.user;

    await prisma.auditLog.create({
      data: {
        actorId: params.actorUserId || null,
        actorType: 'USER',
        action: 'DRIVER_STATUS_UPDATE',
        entityType: 'DriverProfile',
        entityId: profile.id,
        oldValues: { status: profile.user.status },
        newValues: { status: updatedUser.status },
      },
    });

    return {
      id: profile.id,
      userId: profile.userId,
      status: updatedUser.status,
    };
  }

  /**
   * Approves and verifies driver KYC and account.
   */
  static async verifyDriver(params: {
    driverId: string;
    actorUserId?: string;
  }): Promise<any> {
    const profile = await prisma.driverProfile.findFirst({
      where: {
        OR: [{ id: params.driverId }, { userId: params.driverId }],
      },
      include: { user: true, currentVehicle: true },
    });

    if (!profile) {
      throw new NotFoundError('Driver not found');
    }

    // Update user status to APPROVED
    const updatedUser = await prisma.user.update({
      where: { id: profile.userId },
      data: { status: 'APPROVED' },
    });

    // Update or create approved KYC submission
    const latestKyc = await prisma.kycSubmission.findFirst({
      where: { userId: profile.userId },
      orderBy: { createdAt: 'desc' },
    });

    if (latestKyc) {
      await prisma.kycSubmission.update({
        where: { id: latestKyc.id },
        data: {
          status: 'APPROVED',
          reviewedById: params.actorUserId || null,
          reviewedAt: new Date(),
          decisionNote: 'Verified & approved by Admin',
        },
      });
    } else {
      await prisma.kycSubmission.create({
        data: {
          userId: profile.userId,
          status: 'APPROVED',
          reviewedById: params.actorUserId || null,
          reviewedAt: new Date(),
          decisionNote: 'Verified & approved by Admin',
          profileSnapshot: {
            fullName: profile.fullName || 'Driver',
            mobile: profile.user.mobile,
          },
        },
      });
    }

    // If vehicle attached, verify vehicle as well
    if (profile.currentVehicleId) {
      await prisma.vehicle.update({
        where: { id: profile.currentVehicleId },
        data: { isVerified: true },
      });
    }

    // Approve all current documents uploaded by the driver
    await prisma.document.updateMany({
      where: { userId: profile.userId },
      data: {
        status: 'APPROVED',
        verifiedAt: new Date(),
        verifiedByUserId: params.actorUserId || null,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: params.actorUserId || null,
        actorType: 'USER',
        action: 'DRIVER_VERIFIED',
        entityType: 'DriverProfile',
        entityId: profile.id,
        oldValues: { status: profile.user.status, kycStatus: latestKyc?.status || 'DRAFT' },
        newValues: { status: 'APPROVED', kycStatus: 'APPROVED' },
      },
    });

    return {
      id: profile.id,
      userId: profile.userId,
      status: 'APPROVED',
      kycStatus: 'APPROVED',
    };
  }
}
