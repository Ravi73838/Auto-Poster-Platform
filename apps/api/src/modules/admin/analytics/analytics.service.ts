import {
  ROLES,
  type Role,
  CAMPAIGN_STATUS,
  ASSIGNMENT_STATUS,
  KYC_SUBMISSION_STATUS,
  SETTING_KEYS,
} from '@ap/shared-constants';
import { prisma } from '../../../shared/db/index.js';
import { SettingsService } from '../../settings/settings.service.js';
import { AdminFinanceService } from '../finance/admin-finance.service.js';
import { WorkQueuesService } from '../work-queues/work-queues.service.js';

export interface DailyMetricData {
  activeDrivers: number;
  liveCampaigns: number;
  runningAssignments: number;
  photosUploaded: number;
  photosVerified: number;
  rentEarnedPaise: string;
  revenuePaise: string;
  disputesOpened: number;
  strikesIssued: number;
}

export interface AnalyticsOverviewResponse {
  dateRange: {
    from: string;
    to: string;
  };
  kpis: {
    totalDrivers: number;
    activeDrivers: number;
    liveCampaigns: number;
    runningAssignments: number;
    photosVerifiedToday: number;
    revenueTodayPaise: string;
    disputesOpen: number;
  };
  trends: Array<{
    date: string;
    metrics: DailyMetricData;
  }>;
  cityBreakdown: Array<{
    cityId: string;
    cityName: string;
    state: string;
    activeDrivers: number;
    runningAssignments: number;
  }>;
  roleSpecific?: {
    superAdmin?: {
      openQueuesCount: number;
      systemStatus: string;
    };
    moderator?: {
      kycPending: number;
      installationsPending: number;
      dailyPhotosPending: number;
      disputesPending: number;
    };
    finance?: unknown;
  };
}

export class AnalyticsService {
  /**
   * Computes and saves daily metric rollups for a given calendar date.
   */
  static async computeRollupForDate(targetDate: Date | string): Promise<void> {
    const tz = await SettingsService.get(SETTING_KEYS.METRICS_TIMEZONE).catch(() => 'Asia/Kolkata');
    // Start and end of the day in UTC corresponding to target date
    const dayStart = new Date(targetDate);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

    const cities = await prisma.city.findMany({ where: { isActive: true } });
    const targetCityIds: (string | null)[] = [null, ...cities.map((c) => c.id)];

    for (const cityId of targetCityIds) {
      const cityDriverFilter = cityId ? { driverProfile: { cityId } } : {};
      const cityCampaignFilter = cityId ? { cityId } : {};

      const [
        activeDrivers,
        liveCampaigns,
        runningAssignments,
        photosUploaded,
        photosVerified,
        disputesOpened,
        strikesIssued,
      ] = await Promise.all([
        prisma.user.count({
          where: {
            role: ROLES.DRIVER,
            status: 'APPROVED',
            deletedAt: null,
            ...cityDriverFilter,
          },
        }),
        prisma.campaign.count({
          where: {
            status: { in: [CAMPAIGN_STATUS.LIVE, CAMPAIGN_STATUS.RUNNING] },
            ...cityCampaignFilter,
          },
        }),
        prisma.assignment.count({
          where: {
            status: ASSIGNMENT_STATUS.RUNNING,
            ...(cityId ? { campaign: { cityId } } : {}),
          },
        }),
        prisma.photo.count({
          where: {
            uploadedAt: { gte: dayStart, lte: dayEnd },
            ...(cityId ? { assignment: { campaign: { cityId } } } : {}),
          },
        }),
        prisma.photo.count({
          where: {
            status: 'VERIFIED',
            uploadedAt: { gte: dayStart, lte: dayEnd },
            ...(cityId ? { assignment: { campaign: { cityId } } } : {}),
          },
        }),
        prisma.dispute.count({
          where: {
            createdAt: { gte: dayStart, lte: dayEnd },
            ...(cityId ? { campaign: { cityId } } : {}),
          },
        }),
        prisma.strike.count({
          where: {
            issuedAt: { gte: dayStart, lte: dayEnd },
          },
        }),
      ]);

      const metricData: DailyMetricData = {
        activeDrivers,
        liveCampaigns,
        runningAssignments,
        photosUploaded,
        photosVerified,
        rentEarnedPaise: '0',
        revenuePaise: '0',
        disputesOpened,
        strikesIssued,
      };

      const existing = await prisma.dailyMetric.findFirst({
        where: {
          date: dayStart,
          cityId: cityId || null,
        },
      });

      if (existing) {
        await prisma.dailyMetric.update({
          where: { id: existing.id },
          data: {
            metrics: metricData as any,
            computedAt: new Date(),
          },
        });
      } else {
        await prisma.dailyMetric.create({
          data: {
            date: dayStart,
            cityId: cityId || null,
            metrics: metricData as any,
          },
        });
      }
    }
  }

  /**
   * Retrieves dashboard analytics, KPIs, trends, and role-specific slices.
   */
  static async getOverview(params: {
    from?: string;
    to?: string;
    cityId?: string;
    userRole?: Role;
  } = {}): Promise<AnalyticsOverviewResponse> {
    const now = new Date();
    const to = params.to ? new Date(params.to) : now;
    const from = params.from
      ? new Date(params.from)
      : new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const [
      totalDrivers,
      activeDrivers,
      liveCampaigns,
      runningAssignments,
      photosVerifiedToday,
      disputesOpen,
      dailyMetricsRows,
      activeCities,
    ] = await Promise.all([
      prisma.user.count({ where: { role: ROLES.DRIVER, deletedAt: null } }),
      prisma.user.count({ where: { role: ROLES.DRIVER, status: 'APPROVED', deletedAt: null } }),
      prisma.campaign.count({ where: { status: { in: [CAMPAIGN_STATUS.RUNNING, CAMPAIGN_STATUS.LIVE] } } }),
      prisma.assignment.count({ where: { status: ASSIGNMENT_STATUS.RUNNING } }),
      prisma.photo.count({
        where: {
          status: 'VERIFIED',
          uploadedAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
        },
      }),
      prisma.dispute.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
      prisma.dailyMetric.findMany({
        where: {
          cityId: params.cityId || null,
          date: { gte: from, lte: to },
        },
        orderBy: { date: 'asc' },
      }),
      prisma.city.findMany({
        where: { isActive: true },
        include: {
          _count: {
            select: {
              campaigns: { where: { status: { in: [CAMPAIGN_STATUS.RUNNING, CAMPAIGN_STATUS.LIVE] } } },
            },
          },
        },
      }),
    ]);

    const cityBreakdown = await Promise.all(
      activeCities.map(async (c) => {
        const [cityDrivers, cityAssignments] = await Promise.all([
          prisma.driverProfile.count({ where: { cityId: c.id } }),
          prisma.assignment.count({
            where: { campaign: { cityId: c.id }, status: ASSIGNMENT_STATUS.RUNNING },
          }),
        ]);
        return {
          cityId: c.id,
          cityName: c.name,
          state: c.state,
          activeDrivers: cityDrivers,
          runningAssignments: cityAssignments,
        };
      }),
    );

    const trends = dailyMetricsRows.map((r) => ({
      date: r.date.toISOString().split('T')[0] as string,
      metrics: r.metrics as unknown as DailyMetricData,
    }));

    let roleSpecific: AnalyticsOverviewResponse['roleSpecific'] = undefined;

    if (params.userRole === ROLES.SUPER_ADMIN) {
      const summary = await WorkQueuesService.getSummary();
      roleSpecific = {
        superAdmin: {
          openQueuesCount: summary.totalPending,
          systemStatus: 'HEALTHY',
        },
      };
    } else if (params.userRole === ROLES.MODERATOR) {
      const [kycPending, installationsPending, dailyPhotosPending, disputesPending] =
        await Promise.all([
          prisma.kycSubmission.count({ where: { status: KYC_SUBMISSION_STATUS.SUBMITTED } }),
          prisma.assignment.count({ where: { status: ASSIGNMENT_STATUS.INSTALL_SUBMITTED } }),
          prisma.photo.count({ where: { kind: 'DAILY', status: 'MANUAL_REVIEW' } }),
          prisma.dispute.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
        ]);

      roleSpecific = {
        moderator: {
          kycPending,
          installationsPending,
          dailyPhotosPending,
          disputesPending,
        },
      };
    } else if (params.userRole === ROLES.FINANCE) {
      const financeDashboard = await AdminFinanceService.getDashboard();
      roleSpecific = {
        finance: financeDashboard,
      };
    }

    return {
      dateRange: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
      kpis: {
        totalDrivers,
        activeDrivers,
        liveCampaigns,
        runningAssignments,
        photosVerifiedToday,
        revenueTodayPaise: '0',
        disputesOpen,
      },
      trends,
      cityBreakdown,
      roleSpecific,
    };
  }
}
