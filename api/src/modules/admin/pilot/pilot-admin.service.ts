import { prisma } from '../../../shared/db/index.js';
import { PilotCountersService } from '../../pilot/pilot-counters.service.js';
import { LaunchService } from '../launch/launch.service.js';
import { NotFoundError, ValidationError } from '../../../shared/errors/index.js';
import type { PilotCommandCenter } from '@ap/shared-types';

export class PilotAdminService {
  static async getCommandCenterData(): Promise<PilotCommandCenter> {
    const [counters, readiness, anomalies, pendingSecondLooks, feedbacks, supportRequests] =
      await Promise.all([
        PilotCountersService.getCounters(),
        LaunchService.getLaunchReadiness(),
        prisma.anomalyFinding.groupBy({
          by: ['severity'],
          _count: true,
          where: { status: 'OPEN' },
        }),
        prisma.reviewSecondLook.count({
          where: { status: 'PENDING' },
        }),
        prisma.feedback.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { id: true, email: true, mobile: true, role: true } } },
        }),
        prisma.supportRequest.groupBy({
          by: ['type', 'status'],
          _count: true,
        }),
      ]);

    const anomalySummary = {
      totalOpen: anomalies.reduce((acc, curr) => acc + curr._count, 0),
      critical: anomalies.find((a) => a.severity === 'CRITICAL')?._count || 0,
      high: anomalies.find((a) => a.severity === 'HIGH')?._count || 0,
      medium: anomalies.find((a) => a.severity === 'MEDIUM')?._count || 0,
      low: anomalies.find((a) => a.severity === 'LOW')?._count || 0,
    };

    let totalRating = 0;
    let ratingCount = 0;
    let totalNps = 0;
    let npsCount = 0;
    for (const f of feedbacks) {
      if (f.rating) {
        totalRating += f.rating;
        ratingCount++;
      }
      if (f.npsScore !== null && f.npsScore !== undefined) {
        totalNps += f.npsScore;
        npsCount++;
      }
    }

    const openTickets = supportRequests
      .filter((s) => s.type === 'TICKET' && (s.status === 'OPEN' || s.status === 'IN_PROGRESS'))
      .reduce((acc, curr) => acc + curr._count, 0);

    const openCallbacks = supportRequests
      .filter((s) => s.type === 'CALLBACK_REQUEST' && (s.status === 'OPEN' || s.status === 'IN_PROGRESS'))
      .reduce((acc, curr) => acc + curr._count, 0);

    return {
      counters,
      readiness,
      anomalies: anomalySummary,
      pendingSecondLooks,
      feedback: {
        avgRating: ratingCount > 0 ? Number((totalRating / ratingCount).toFixed(1)) : 0,
        avgNps: npsCount > 0 ? Number((totalNps / npsCount).toFixed(1)) : 0,
        recent: feedbacks as any,
      },
      support: {
        openTickets,
        openCallbacks,
      },
    };
  }

  // --- ANOMALIES ---
  static async listAnomalies(params: {
    status?: string;
    severity?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: any[]; total: number; page: number; limit: number }> {
    const page = Math.max(Number(params.page) || 1, 1);
    const limit = Math.min(Math.max(Number(params.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.status) where.status = params.status;
    if (params.severity) where.severity = params.severity;

    const [items, total] = await Promise.all([
      prisma.anomalyFinding.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
        include: { resolvedBy: { select: { id: true, email: true } } },
      }),
      prisma.anomalyFinding.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  static async resolveAnomaly(params: {
    id: string;
    status: 'RESOLVED' | 'FALSE_POSITIVE' | 'IGNORED';
    resolutionNote?: string;
    actorUserId?: string;
  }): Promise<any> {
    const finding = await prisma.anomalyFinding.findUnique({ where: { id: params.id } });
    if (!finding) throw new NotFoundError('Anomaly finding not found');

    return prisma.anomalyFinding.update({
      where: { id: params.id },
      data: {
        status: params.status,
        resolutionNote: params.resolutionNote || null,
        resolvedById: params.actorUserId || null,
        resolvedAt: new Date(),
      },
    });
  }

  // --- SECOND-LOOK QC ---
  static async listSecondLooks(params: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: any[]; total: number; page: number; limit: number }> {
    const page = Math.max(Number(params.page) || 1, 1);
    const limit = Math.min(Math.max(Number(params.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.status) where.status = params.status;

    const [items, total] = await Promise.all([
      prisma.reviewSecondLook.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          photo: {
            include: {
              driver: { select: { id: true, mobile: true, email: true } },
              assignment: { select: { id: true, campaign: { select: { id: true, title: true } } } },
            },
          },
          originalReviewer: { select: { id: true, email: true } },
          secondReviewer: { select: { id: true, email: true } },
        },
      }),
      prisma.reviewSecondLook.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  static async decideSecondLook(params: {
    id: string;
    outcome: 'CONFIRMED' | 'OVERTURNED' | 'ESCALATED';
    decisionNote?: string;
    reviewerUserId: string;
  }): Promise<any> {
    const item = await prisma.reviewSecondLook.findUnique({ where: { id: params.id } });
    if (!item) throw new NotFoundError('Second-look item not found');

    const isDiscrepancy = params.outcome === 'OVERTURNED';

    return prisma.reviewSecondLook.update({
      where: { id: params.id },
      data: {
        secondOutcome: params.outcome,
        decisionNote: params.decisionNote || null,
        secondReviewerId: params.reviewerUserId,
        reviewedAt: new Date(),
        status: isDiscrepancy ? 'DISCREPANCY' : 'COMPLETED',
      },
    });
  }

  // --- PRINT SHOPS ---
  static async listPrintShops(params: {
    cityName?: string;
    status?: string;
  }): Promise<any[]> {
    const where: any = {};
    if (params.cityName) where.cityName = params.cityName;
    if (params.status) where.status = params.status;

    return prisma.printShop.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  static async createPrintShop(input: {
    name: string;
    cityName: string;
    address: string;
    latitude: number;
    longitude: number;
    phone: string;
    operatingHours?: string;
  }): Promise<any> {
    return prisma.printShop.create({
      data: {
        name: input.name,
        cityName: input.cityName,
        address: input.address,
        latitude: input.latitude,
        longitude: input.longitude,
        phone: input.phone,
        operatingHours: input.operatingHours || null,
        status: 'ACTIVE',
      },
    });
  }

  static async updatePrintShop(id: string, input: Partial<{
    name: string;
    cityName: string;
    address: string;
    latitude: number;
    longitude: number;
    phone: string;
    operatingHours: string;
    status: string;
  }>): Promise<any> {
    return prisma.printShop.update({
      where: { id },
      data: input,
    });
  }

  static async deletePrintShop(id: string): Promise<any> {
    return prisma.printShop.delete({ where: { id } });
  }
}

