import { ERROR_CODES, SETTING_KEYS } from '@ap/shared-constants';
import { prisma } from '../../../shared/db/index.js';
import { SettingsService } from '../../settings/settings.service.js';
import { AppError } from '../../../shared/errors/index.js';
import { maskPhone, maskEmail, maskGstin } from '../../../shared/pii.js';

export interface SearchResultItem {
  category: 'drivers' | 'companies' | 'vehicles' | 'campaigns' | 'disputes' | 'payments' | 'payouts';
  id: string;
  title: string;
  subtitle: string;
  badge?: string;
  link: string;
}

export interface SearchResponseData {
  query: string;
  totalMatches: number;
  results: Record<string, SearchResultItem[]>;
}

export class AdminSearchService {
  static async search(query: string): Promise<SearchResponseData> {
    const minChars = await SettingsService.get(SETTING_KEYS.SEARCH_MIN_CHARS).catch(() => 2);
    const q = query.trim();

    if (q.length < minChars) {
      throw new AppError(
        ERROR_CODES.SEARCH_QUERY_TOO_SHORT,
        `Search query must be at least ${minChars} characters`,
        400,
        { minChars },
      );
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q);

    const [drivers, companies, vehicles, campaigns, disputes, payments, payouts] =
      await Promise.all([
        // 1. Drivers
        prisma.driverProfile.findMany({
          where: {
            OR: [
              { fullName: { contains: q, mode: 'insensitive' } },
              { user: { mobile: { contains: q } } },
              { user: { email: { contains: q, mode: 'insensitive' } } },
              ...(isUuid ? [{ id: q }, { userId: q }] : []),
            ],
          },
          include: { user: true },
          take: 8,
        }),

        // 2. Companies
        prisma.companyProfile.findMany({
          where: {
            OR: [
              { companyName: { contains: q, mode: 'insensitive' } },
              { legalName: { contains: q, mode: 'insensitive' } },
              { gstin: { contains: q, mode: 'insensitive' } },
              { user: { email: { contains: q, mode: 'insensitive' } } },
              ...(isUuid ? [{ id: q }, { userId: q }] : []),
            ],
          },
          include: { user: true },
          take: 8,
        }),

        // 3. Vehicles
        prisma.vehicle.findMany({
          where: {
            OR: [
              { registrationNumber: { contains: q, mode: 'insensitive' } },
              { rcNumber: { contains: q, mode: 'insensitive' } },
              ...(isUuid ? [{ id: q }] : []),
            ],
          },
          take: 8,
        }),

        // 4. Campaigns
        prisma.campaign.findMany({
          where: {
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              ...(isUuid ? [{ id: q }] : []),
            ],
          },
          include: { company: true },
          take: 8,
        }),

        // 5. Disputes
        prisma.dispute.findMany({
          where: {
            OR: [
              { details: { contains: q, mode: 'insensitive' } },
              ...(isUuid ? [{ id: q }] : []),
            ],
          },
          take: 8,
        }),

        // 6. Payments
        prisma.campaignPayment.findMany({
          where: {
            OR: [
              { gatewayPaymentId: { contains: q, mode: 'insensitive' } },
              { gatewayOrderId: { contains: q, mode: 'insensitive' } },
              ...(isUuid ? [{ id: q }] : []),
            ],
          },
          take: 8,
        }),

        // 7. Payouts
        prisma.payout.findMany({
          where: {
            OR: [
              { gatewayReference: { contains: q, mode: 'insensitive' } },
              { utr: { contains: q, mode: 'insensitive' } },
              ...(isUuid ? [{ id: q }] : []),
            ],
          },
          take: 8,
        }),
      ]);

    const formattedDrivers: SearchResultItem[] = drivers.map((d: any) => ({
      category: 'drivers',
      id: d.id,
      title: d.fullName || 'Driver',
      subtitle: `${maskPhone(d.user.mobile)}${d.user.email ? ' • ' + maskEmail(d.user.email) : ''}`,
      badge: d.user.status,
      link: `/admin/drivers/${d.id}`,
    }));

    const formattedCompanies: SearchResultItem[] = companies.map((c: any) => ({
      category: 'companies',
      id: c.id,
      title: c.companyName,
      subtitle: `${c.legalName || 'Company'} • ${maskGstin(c.gstin)}`,
      badge: c.isVerified ? 'VERIFIED' : 'UNVERIFIED',
      link: `/admin/companies/${c.id}`,
    }));

    const formattedVehicles: SearchResultItem[] = vehicles.map((v: any) => ({
      category: 'vehicles',
      id: v.id,
      title: v.registrationNumber,
      subtitle: `${v.vehicleType} • ${v.ownerName || 'Auto'}`,
      badge: v.isVerified ? 'VERIFIED' : 'PENDING',
      link: `/admin/drivers?vehicleId=${v.id}`,
    }));

    const formattedCampaigns: SearchResultItem[] = campaigns.map((cmp: any) => ({
      category: 'campaigns',
      id: cmp.id,
      title: cmp.title,
      subtitle: `${cmp.company?.companyProfile?.companyName || 'Company'} • ${cmp.targetSlots} slots`,
      badge: cmp.status,
      link: `/admin/campaigns/${cmp.id}`,
    }));

    const formattedDisputes: SearchResultItem[] = disputes.map((disp: any) => ({
      category: 'disputes',
      id: disp.id,
      title: `Dispute #${disp.id.slice(0, 8)}`,
      subtitle: disp.reason,
      badge: disp.status,
      link: `/admin/disputes/${disp.id}`,
    }));

    const formattedPayments: SearchResultItem[] = payments.map((pay: any) => ({
      category: 'payments',
      id: pay.id,
      title: `Payment ₹${(Number(pay.amountPaise) / 100).toFixed(2)}`,
      subtitle: pay.gatewayPaymentId || pay.gatewayOrderId || pay.id,
      badge: pay.status,
      link: `/admin/finance/payments`,
    }));

    const formattedPayouts: SearchResultItem[] = payouts.map((p: any) => ({
      category: 'payouts',
      id: p.id,
      title: `Payout ₹${(Number(p.amountPaise) / 100).toFixed(2)}`,
      subtitle: p.utr || p.gatewayReference || p.id,
      badge: p.status,
      link: `/admin/finance/payouts`,
    }));

    const results = {
      drivers: formattedDrivers,
      companies: formattedCompanies,
      vehicles: formattedVehicles,
      campaigns: formattedCampaigns,
      disputes: formattedDisputes,
      payments: formattedPayments,
      payouts: formattedPayouts,
    };

    const totalMatches =
      formattedDrivers.length +
      formattedCompanies.length +
      formattedVehicles.length +
      formattedCampaigns.length +
      formattedDisputes.length +
      formattedPayments.length +
      formattedPayouts.length;

    return {
      query: q,
      totalMatches,
      results,
    };
  }
}
