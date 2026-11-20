import { prisma } from '../../shared/db/index.js';
import { clock } from '../../shared/clock/index.js';
import {
  ROLES,
  ACCOUNT_STATUS,
  SETTING_KEYS,
  ERROR_CODES,
} from '@ap/shared-constants';
import { AppError } from '../../shared/errors/index.js';
import type { PilotCounters } from '@ap/shared-types';

export class PilotCountersService {
  private static async getSettingNumber(key: string, defaultVal: number): Promise<number> {
    const s = await prisma.setting.findUnique({ where: { key } });
    if (!s || s.value === undefined || s.value === null) return defaultVal;
    const n = Number(s.value);
    return isNaN(n) ? defaultVal : n;
  }

  private static async getSettingBigInt(key: string, defaultVal: bigint): Promise<bigint> {
    const s = await prisma.setting.findUnique({ where: { key } });
    if (!s || s.value === undefined || s.value === null) return defaultVal;
    try {
      return BigInt(String(s.value));
    } catch {
      return defaultVal;
    }
  }

  private static async isPilotModeActive(): Promise<boolean> {
    const s = await prisma.setting.findUnique({ where: { key: SETTING_KEYS.PILOT_MODE_ENABLED } });
    if (!s) return true; // Enabled by default in Phase 15
    return Boolean(s.value);
  }

  static async getCounters(): Promise<PilotCounters> {
    // 1. Drivers count
    const [activeDrivers, activeCompanies, activeCampaigns] = await Promise.all([
      prisma.user.count({
        where: {
          role: ROLES.DRIVER,
          status: ACCOUNT_STATUS.APPROVED,
        },
      }),
      prisma.user.count({
        where: {
          role: ROLES.COMPANY,
          status: ACCOUNT_STATUS.APPROVED,
        },
      }),
      prisma.campaign.count({
        where: {
          status: { in: ['LIVE', 'RUNNING'] },
        },
      }),
    ]);

    // 2. Escrow in active/funded campaigns
    const escrowAggregate = await prisma.campaign.aggregate({
      _sum: {
        totalBudgetPaise: true,
      },
      where: {
        status: { in: ['LIVE', 'RUNNING', 'APPROVED'] },
      },
    });
    const totalEscrowPaise = escrowAggregate._sum?.totalBudgetPaise ?? BigInt(0);

    // 3. Payouts today in IST
    const todayStr = clock.todayIst(); // YYYY-MM-DD
    const todayStartUtc = new Date(`${todayStr}T00:00:00.000+05:30`);
    const todayEndUtc = new Date(`${todayStr}T23:59:59.999+05:30`);

    const payoutAggregate = await prisma.payout.aggregate({
      _sum: {
        amountPaise: true,
      },
      where: {
        status: { in: ['PAID', 'PROCESSING'] },
        createdAt: {
          gte: todayStartUtc,
          lte: todayEndUtc,
        },
      },
    });
    const todayPayoutsPaise = payoutAggregate._sum?.amountPaise ?? BigInt(0);

    // 4. Read configured caps from Settings table in a single query
    const settings = await prisma.setting.findMany({
      where: {
        key: {
          in: [
            SETTING_KEYS.PILOT_MAX_DRIVERS,
            SETTING_KEYS.PILOT_MAX_COMPANIES,
            SETTING_KEYS.PILOT_MAX_ACTIVE_CAMPAIGNS,
            SETTING_KEYS.PILOT_MAX_SLOTS_PER_CAMPAIGN,
            SETTING_KEYS.PILOT_MAX_TOTAL_ESCROW_PAISE,
            SETTING_KEYS.PILOT_MAX_PAYOUT_PER_DAY_PAISE,
            SETTING_KEYS.PILOT_MAX_WITHDRAWAL_PER_DRIVER_PER_DAY_PAISE,
            SETTING_KEYS.PILOT_INVITE_ONLY,
            SETTING_KEYS.PILOT_MODE_ENABLED,
          ],
        },
      },
    });

    const settingMap = new Map<string, any>(settings.map((s) => [s.key, s.value]));

    const getNum = (key: string, def: number): number => {
      const v = settingMap.get(key);
      if (v === undefined || v === null) return def;
      const n = Number(v);
      return isNaN(n) ? def : n;
    };

    const getBig = (key: string, def: bigint): bigint => {
      const v = settingMap.get(key);
      if (v === undefined || v === null) return def;
      try {
        return BigInt(String(v));
      } catch {
        return def;
      }
    };

    const maxDrivers = getNum(SETTING_KEYS.PILOT_MAX_DRIVERS, 50);
    const maxCompanies = getNum(SETTING_KEYS.PILOT_MAX_COMPANIES, 10);
    const maxActiveCampaigns = getNum(SETTING_KEYS.PILOT_MAX_ACTIVE_CAMPAIGNS, 5);
    const maxSlotsPerCampaign = getNum(SETTING_KEYS.PILOT_MAX_SLOTS_PER_CAMPAIGN, 20);
    const maxTotalEscrowPaise = getBig(SETTING_KEYS.PILOT_MAX_TOTAL_ESCROW_PAISE, BigInt(50000000)); // ₹5,00,000
    const maxDailyPayoutsPaise = getBig(SETTING_KEYS.PILOT_MAX_PAYOUT_PER_DAY_PAISE, BigInt(10000000)); // ₹1,00,000
    const maxDriverDailyPayoutPaise = getBig(SETTING_KEYS.PILOT_MAX_WITHDRAWAL_PER_DRIVER_PER_DAY_PAISE, BigInt(500000)); // ₹5,000
    const isInviteOnlyDrivers = settingMap.has(SETTING_KEYS.PILOT_INVITE_ONLY)
      ? Boolean(settingMap.get(SETTING_KEYS.PILOT_INVITE_ONLY))
      : true;
    const isInviteOnlyCompanies = isInviteOnlyDrivers;
    const isPilotActive = settingMap.has(SETTING_KEYS.PILOT_MODE_ENABLED)
      ? Boolean(settingMap.get(SETTING_KEYS.PILOT_MODE_ENABLED))
      : true;

    return {
      activeDrivers,
      maxDrivers,
      activeCompanies,
      maxCompanies,
      activeCampaigns,
      maxActiveCampaigns,
      maxSlotsPerCampaign,
      totalEscrowPaise: totalEscrowPaise.toString(),
      maxTotalEscrowPaise: maxTotalEscrowPaise.toString(),
      todayPayoutsPaise: todayPayoutsPaise.toString(),
      maxDailyPayoutsPaise: maxDailyPayoutsPaise.toString(),
      maxDriverDailyPayoutPaise: maxDriverDailyPayoutPaise.toString(),
      isInviteOnlyDrivers,
      isInviteOnlyCompanies,
      isPilotActive,
    };
  }

  static async assertCanRegisterDriver(): Promise<void> {
    if (!(await this.isPilotModeActive())) return;
    const counters = await this.getCounters();
    if (counters.activeDrivers >= counters.maxDrivers) {
      throw new AppError(
        ERROR_CODES.PILOT_DRIVER_CAP_REACHED,
        403,
        `Pilot driver capacity reached (${counters.activeDrivers}/${counters.maxDrivers}). New registrations are waitlisted.`,
      );
    }
  }

  static async assertCanRegisterCompany(): Promise<void> {
    if (!(await this.isPilotModeActive())) return;
    const counters = await this.getCounters();
    if (counters.activeCompanies >= counters.maxCompanies) {
      throw new AppError(
        ERROR_CODES.PILOT_COMPANY_CAP_REACHED,
        403,
        `Pilot company capacity reached (${counters.activeCompanies}/${counters.maxCompanies}). Please join the advertiser waitlist.`,
      );
    }
  }

  static async assertCanCreateCampaign(requestedSlots: number): Promise<void> {
    if (!(await this.isPilotModeActive())) return;
    const counters = await this.getCounters();

    if (counters.activeCampaigns >= counters.maxActiveCampaigns) {
      throw new AppError(
        ERROR_CODES.PILOT_CAMPAIGN_CAP_REACHED,
        403,
        `Pilot active campaign limit reached (${counters.activeCampaigns}/${counters.maxActiveCampaigns}).`,
      );
    }

    if (requestedSlots > counters.maxSlotsPerCampaign) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        `Requested slots (${requestedSlots}) exceeds the pilot limit of ${counters.maxSlotsPerCampaign} slots per campaign.`,
      );
    }
  }

  static async assertCanFundEscrow(amountPaise: bigint): Promise<void> {
    if (!(await this.isPilotModeActive())) return;
    const counters = await this.getCounters();
    const current = BigInt(counters.totalEscrowPaise);
    const max = BigInt(counters.maxTotalEscrowPaise);

    if (current + amountPaise > max) {
      throw new AppError(
        ERROR_CODES.PILOT_ESCROW_CAP_REACHED,
        403,
        `Total pilot escrow cap exceeded. Current: ₹${(Number(current) / 100).toFixed(2)}, Max: ₹${(Number(max) / 100).toFixed(2)}.`,
      );
    }
  }

  static async assertCanExecutePayout(driverId: string, amountPaise: bigint): Promise<void> {
    if (!(await this.isPilotModeActive())) return;
    const counters = await this.getCounters();
    const currentDailyTotal = BigInt(counters.todayPayoutsPaise);
    const maxDailyTotal = BigInt(counters.maxDailyPayoutsPaise);
    const maxDriverDaily = BigInt(counters.maxDriverDailyPayoutPaise);

    // 1. Single driver daily withdrawal cap
    if (amountPaise > maxDriverDaily) {
      throw new AppError(
        ERROR_CODES.PILOT_PAYOUT_CAP_REACHED,
        400,
        `Withdrawal of ₹${(Number(amountPaise) / 100).toFixed(2)} exceeds driver daily limit of ₹${(Number(maxDriverDaily) / 100).toFixed(2)}.`,
      );
    }

    // 2. Check driver's total payouts today
    const todayStr = clock.todayIst();
    const todayStartUtc = new Date(`${todayStr}T00:00:00.000+05:30`);
    const todayEndUtc = new Date(`${todayStr}T23:59:59.999+05:30`);

    const driverTodayPayouts = await prisma.payout.aggregate({
      _sum: { amountPaise: true },
      where: {
        driverId,
        status: { in: ['PAID', 'PROCESSING'] },
        createdAt: { gte: todayStartUtc, lte: todayEndUtc },
      },
    });
    const driverTodayTotal = driverTodayPayouts._sum?.amountPaise ?? BigInt(0);

    if (driverTodayTotal + amountPaise > maxDriverDaily) {
      throw new AppError(
        ERROR_CODES.PILOT_PAYOUT_CAP_REACHED,
        400,
        `Total daily withdrawals for this driver would exceed the pilot limit of ₹${(Number(maxDriverDaily) / 100).toFixed(2)}.`,
      );
    }

    // 3. Platform daily aggregate payout cap
    if (currentDailyTotal + amountPaise > maxDailyTotal) {
      throw new AppError(
        ERROR_CODES.PILOT_PAYOUT_CAP_REACHED,
        403,
        `Platform daily payout capacity reached. Total today: ₹${(Number(currentDailyTotal) / 100).toFixed(2)}, Max: ₹${(Number(maxDailyTotal) / 100).toFixed(2)}.`,
      );
    }
  }
}
