import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  ERROR_CODES,
  SETTING_KEYS,
  type ExportJobStatus,
} from '@ap/shared-constants';
import { prisma } from '../../../shared/db/index.js';
import { SettingsService } from '../../settings/settings.service.js';
import { AppError, NotFoundError } from '../../../shared/errors/index.js';

export interface CreateExportParams {
  requestedById: string;
  reportKey: string;
  filters?: Record<string, unknown>;
  format?: string;
}

export class ReportsService {
  private static async getExportDir(): Promise<string> {
    const dir = path.join(os.tmpdir(), 'autoposter-exports');
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  /**
   * Generates a CSV export job synchronously for fast downloads or queues it.
   */
  static async requestExport(params: CreateExportParams): Promise<{ exportId: string; status: ExportJobStatus }> {
    const maxRows = await SettingsService.get(SETTING_KEYS.EXPORT_MAX_ROWS).catch(() => 50000);
    const ttlHours = await SettingsService.get(SETTING_KEYS.EXPORT_LINK_TTL_HOURS).catch(() => 24);

    const exportJob = await prisma.exportJob.create({
      data: {
        requestedById: params.requestedById,
        reportKey: params.reportKey,
        filters: (params.filters as object) ?? {},
        status: 'RUNNING',
      },
    });

    try {
      let rows: string[][] = [];
      let headers: string[] = [];

      switch (params.reportKey.toUpperCase()) {
        case 'DRIVERS': {
          headers = [
            'Driver ID',
            'Full Name',
            'Mobile',
            'Email',
            'City',
            'Status',
            'Lifetime Earnings (Rs)',
            'Completed Campaigns',
            'Rating',
            'Strikes',
            'Created At',
          ];
          const drivers = await prisma.driverProfile.findMany({
            take: maxRows + 1,
            include: { user: true, city: true },
            orderBy: { createdAt: 'desc' },
          });

          if (drivers.length > maxRows) {
            throw new AppError(
              ERROR_CODES.EXPORT_TOO_LARGE,
              `Export exceeds maximum row limit of ${maxRows}`,
              400,
            );
          }

          rows = drivers.map((d) => [
            d.id,
            d.fullName || '',
            d.user.mobile,
            d.user.email || '',
            d.city?.name || '',
            d.user.status,
            (Number(d.lifetimeEarningsPaise) / 100).toFixed(2),
            d.completedCampaignsCount.toString(),
            d.rating.toFixed(1),
            d.strikesCount.toString(),
            d.createdAt.toISOString(),
          ]);
          break;
        }

        case 'COMPANIES': {
          headers = [
            'Company ID',
            'Company Name',
            'Legal Name',
            'GSTIN',
            'PAN',
            'City',
            'Contact Person',
            'Contact Phone',
            'Verified',
            'Created At',
          ];
          const companies = await prisma.companyProfile.findMany({
            take: maxRows + 1,
            include: { city: true },
            orderBy: { createdAt: 'desc' },
          });

          if (companies.length > maxRows) {
            throw new AppError(
              ERROR_CODES.EXPORT_TOO_LARGE,
              `Export exceeds maximum row limit of ${maxRows}`,
              400,
            );
          }

          rows = companies.map((c) => [
            c.id,
            c.companyName,
            c.legalName || '',
            c.gstin || '',
            c.pan || '',
            c.city?.name || '',
            c.contactPersonName,
            c.contactPersonPhone,
            c.isVerified ? 'YES' : 'NO',
            c.createdAt.toISOString(),
          ]);
          break;
        }

        case 'CAMPAIGNS': {
          headers = [
            'Campaign ID',
            'Title',
            'Company',
            'City',
            'Status',
            'Slots',
            'Duration (Days)',
            'Budget (Rs)',
            'Start Date',
            'End Date',
            'Created At',
          ];
          const campaigns = await prisma.campaign.findMany({
            take: maxRows + 1,
            include: { company: { include: { companyProfile: true } }, city: true },
            orderBy: { createdAt: 'desc' },
          });

          if (campaigns.length > maxRows) {
            throw new AppError(
              ERROR_CODES.EXPORT_TOO_LARGE,
              `Export exceeds maximum row limit of ${maxRows}`,
              400,
            );
          }

          rows = campaigns.map((cmp) => [
            cmp.id,
            cmp.title,
            cmp.company.companyProfile?.companyName || '',
            cmp.city?.name || '',
            cmp.status,
            cmp.targetAutoCount.toString(),
            Math.max(1, Math.round((cmp.endDate.getTime() - cmp.startDate.getTime()) / (1000 * 60 * 60 * 24))).toString(),
            (Number(cmp.totalBudgetPaise) / 100).toFixed(2),
            cmp.startDate ? cmp.startDate.toISOString() : '',
            cmp.endDate ? cmp.endDate.toISOString() : '',
            cmp.createdAt.toISOString(),
          ]);
          break;
        }

        case 'ASSIGNMENTS': {
          headers = [
            'Assignment ID',
            'Campaign Title',
            'Driver Name',
            'Driver Mobile',
            'Status',
            'Verified Days',
            'Missed Days',
            'Total Earned (Rs)',
            'Created At',
          ];
          const assignments = await prisma.assignment.findMany({
            take: maxRows + 1,
            include: { campaign: true, driver: { include: { driverProfile: true } } },
            orderBy: { createdAt: 'desc' },
          });

          if (assignments.length > maxRows) {
            throw new AppError(
              ERROR_CODES.EXPORT_TOO_LARGE,
              `Export exceeds maximum row limit of ${maxRows}`,
              400,
            );
          }

          rows = assignments.map((a) => [
            a.id,
            a.campaign.title,
            a.driver.driverProfile?.fullName || 'Driver',
            a.driver.mobile,
            a.status,
            a.verifiedDays.toString(),
            a.missedDays.toString(),
            (Number(a.rentPaidPaise) / 100).toFixed(2),
            a.createdAt.toISOString(),
          ]);
          break;
        }

        case 'PAYMENTS': {
          headers = [
            'Payment ID',
            'Order ID',
            'Gateway Reference',
            'Campaign ID',
            'Amount (Rs)',
            'Status',
            'Payment Method',
            'Created At',
          ];
          const payments = await prisma.campaignPayment.findMany({
            take: maxRows + 1,
            orderBy: { createdAt: 'desc' },
          });

          if (payments.length > maxRows) {
            throw new AppError(
              ERROR_CODES.EXPORT_TOO_LARGE,
              `Export exceeds maximum row limit of ${maxRows}`,
              400,
            );
          }

          rows = payments.map((p) => [
            p.id,
            p.gatewayOrderId || '',
            p.gatewayPaymentId || '',
            p.campaignId || '',
            (Number(p.amountPaise) / 100).toFixed(2),
            p.status,
            p.method || '',
            p.createdAt.toISOString(),
          ]);
          break;
        }

        case 'PAYOUTS': {
          headers = [
            'Payout ID',
            'Driver ID',
            'Amount (Rs)',
            'Status',
            'Method',
            'Reference',
            'UTR',
            'Created At',
          ];
          const payouts = await prisma.payout.findMany({
            take: maxRows + 1,
            orderBy: { requestedAt: 'desc' },
          });

          if (payouts.length > maxRows) {
            throw new AppError(
              ERROR_CODES.EXPORT_TOO_LARGE,
              `Export exceeds maximum row limit of ${maxRows}`,
              400,
            );
          }

          rows = payouts.map((p) => [
            p.id,
            p.driverId,
            (Number(p.amountPaise) / 100).toFixed(2),
            p.status,
            p.method,
            p.gatewayReference || '',
            p.utr || '',
            p.requestedAt.toISOString(),
          ]);
          break;
        }

        default:
          throw new AppError(
            ERROR_CODES.VALIDATION_ERROR,
            `Unsupported report key: ${params.reportKey}`,
            400,
          );
      }

      // Format CSV content
      const csvLines = [
        headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(','),
        ...rows.map((row) => row.map((val) => `"${(val || '').replace(/"/g, '""')}"`).join(',')),
      ];
      const csvContent = csvLines.join('\n');

      const exportDir = await this.getExportDir();
      const filePath = path.join(exportDir, `${exportJob.id}.csv`);
      await fs.writeFile(filePath, csvContent, 'utf-8');

      const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

      await prisma.exportJob.update({
        where: { id: exportJob.id },
        data: {
          status: 'DONE',
          rowCount: rows.length,
          fileKey: filePath,
          expiresAt,
        },
      });

      return { exportId: exportJob.id, status: 'DONE' };
    } catch (err: any) {
      await prisma.exportJob.update({
        where: { id: exportJob.id },
        data: {
          status: 'FAILED',
          error: err.message || 'Export generation failed',
        },
      });
      throw err;
    }
  }

  /**
   * Lists export jobs requested by user or all jobs for administrators.
   */
  static async listExports(requestedById?: string): Promise<any[]> {
    const jobs = await prisma.exportJob.findMany({
      where: requestedById ? { requestedById } : {},
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        requestedBy: {
          select: { email: true, role: true },
        },
      },
    });

    return jobs.map((j) => ({
      id: j.id,
      reportKey: j.reportKey,
      status: j.status,
      rowCount: j.rowCount,
      error: j.error,
      expiresAt: j.expiresAt ? j.expiresAt.toISOString() : null,
      createdAt: j.createdAt.toISOString(),
      requestedBy: j.requestedBy.email || 'Admin',
      downloadUrl: j.status === 'DONE' ? `/api/v1/admin/reports/exports/${j.id}/download` : null,
    }));
  }

  /**
   * Retrieves file path for download, verifying expiry and completion.
   */
  static async getExportFileForDownload(id: string): Promise<{ filePath: string; filename: string }> {
    const job = await prisma.exportJob.findUnique({ where: { id } });
    if (!job) {
      throw new NotFoundError('Export job not found');
    }

    if (job.status === 'RUNNING' || job.status === 'QUEUED') {
      throw new AppError(
        ERROR_CODES.EXPORT_NOT_READY,
        'Export file is still generating. Please try again shortly.',
        400,
      );
    }

    if (job.status === 'FAILED') {
      throw new AppError(ERROR_CODES.INTERNAL_ERROR, job.error || 'Export generation failed', 500);
    }

    if (job.expiresAt && job.expiresAt < new Date()) {
      throw new AppError(
        ERROR_CODES.EXPORT_EXPIRED,
        'This export download link has expired.',
        410,
      );
    }

    if (!job.fileKey) {
      throw new NotFoundError('Export file content not found');
    }

    return {
      filePath: job.fileKey,
      filename: `export-${job.reportKey.toLowerCase()}-${job.id.slice(0, 8)}.csv`,
    };
  }
}
