import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma, disconnectPrisma } from '../shared/db/index.js';
import {
  maskPhone,
  maskEmail,
  maskGstin,
  maskPan,
  maskBankAccount,
} from '../shared/pii.js';
import { AdminSearchService } from '../modules/admin/search/admin-search.service.js';
import { WorkQueuesService } from '../modules/admin/work-queues/work-queues.service.js';
import { AnalyticsService } from '../modules/admin/analytics/analytics.service.js';
import { ReportsService } from '../modules/admin/reports/reports.service.js';
import { Entity360Service } from '../modules/admin/entity-360/entity-360.service.js';
import { AdminSettingsService } from '../modules/admin/settings/admin-settings.service.js';
import { RolesService } from '../modules/admin/roles/roles.service.js';
import { LegalService } from '../modules/admin/content/legal.service.js';
import { HelpService } from '../modules/admin/content/help.service.js';
import { SystemService } from '../modules/admin/system/system.service.js';
import { SavedViewsService } from '../modules/admin/saved-views/saved-views.service.js';
import { SettingsService } from '../modules/settings/settings.service.js';
import {
  ROLES,
  ACCOUNT_STATUS,
  CAMPAIGN_STATUS,
  SETTING_KEYS,
  LEGAL_DOCUMENT_STATUS,
  JOB_RUN_STATUS,
} from '@ap/shared-constants';

describe('Phase 10 Admin Portal Integration Tests', () => {
  let superAdminUser: any;
  let moderatorUser: any;
  let driverUser: any;
  let companyUser: any;
  let city: any;
  let campaign: any;

  beforeAll(async () => {
    // 1. Create Super Admin
    superAdminUser = await prisma.user.create({
      data: {
        role: ROLES.SUPER_ADMIN,
        mobile: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
        email: `admin_${randomUUID()}@autoposter.com`,
        status: ACCOUNT_STATUS.APPROVED,
        preferredLanguage: 'en',
      },
    });

    // 2. Create Moderator
    moderatorUser = await prisma.user.create({
      data: {
        role: ROLES.MODERATOR,
        mobile: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
        email: `mod_${randomUUID()}@autoposter.com`,
        status: ACCOUNT_STATUS.APPROVED,
        preferredLanguage: 'en',
      },
    });

    // 3. Create City
    city = await prisma.city.create({
      data: {
        name: `City_${randomUUID().slice(0, 6)}`,
        state: 'Maharashtra',
        country: 'India',
        isActive: true,
      },
    });

    // 4. Create Driver
    driverUser = await prisma.user.create({
      data: {
        role: ROLES.DRIVER,
        mobile: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
        email: `driver_${randomUUID()}@example.com`,
        status: ACCOUNT_STATUS.APPROVED,
        driverProfile: {
          create: {
            fullName: 'Admin Test Driver',
            cityId: city.id,
            upiIdEncrypted: 'test@upi',
            bankAccountNumberEncrypted: '123456789012',
            bankIfsc: 'SBIN0001234',
            bankAccountName: 'Admin Test Driver',
          },
        },
      },
      include: { driverProfile: true },
    });

    // 5. Create Company
    const randomGstin = `27AAB${Math.floor(1000 + Math.random() * 9000)}R1Z${Math.floor(Math.random() * 9)}`;
    const randomPan = `AAB${Math.floor(1000 + Math.random() * 9000)}R`;
    companyUser = await prisma.user.create({
      data: {
        role: ROLES.COMPANY,
        mobile: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
        email: `company_${randomUUID()}@brand.com`,
        status: ACCOUNT_STATUS.APPROVED,
        companyProfile: {
          create: {
            companyName: 'Test Brand PVT LTD',
            legalName: 'Test Brand Private Limited',
            gstin: randomGstin,
            pan: randomPan,
            contactPersonName: 'Brand Manager',
            contactPersonPhone: '+919876543210',
            cityId: city.id,
          },
        },
      },
      include: { companyProfile: true },
    });

    // 6. Create Campaign
    campaign = await prisma.campaign.create({
      data: {
        companyId: companyUser.id,
        cityId: city.id,
        title: 'Phase 10 Admin Promo',
        targetAutoCount: 10,
        dailyRentPaise: 5000,
        printingAllowancePaise: 15000,
        totalBudgetPaise: 250000n,
        platformFeePaise: 25000n,
        gstAmountPaise: 4500n,
        totalChargedPaise: 279500n,
        startDate: new Date(),
        endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        status: CAMPAIGN_STATUS.RUNNING,
      },
    });

    // 7. Seed sensitive settings list
    await prisma.setting.upsert({
      where: { key: SETTING_KEYS.SENSITIVE_SETTING_KEYS },
      create: {
        key: SETTING_KEYS.SENSITIVE_SETTING_KEYS,
        value: ['platform.commission_rate_bps', 'platform.gst_rate_bps'],
      },
      update: {
        value: ['platform.commission_rate_bps', 'platform.gst_rate_bps'],
      },
    });
    SettingsService.clearCache();
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  describe('1. PII Masking Utilities', () => {
    it('masks phone numbers keeping only prefix and last 3 digits', () => {
      const masked = maskPhone('+919876543210');
      expect(masked).toBe('+9198*****210');
      expect(maskPhone(null)).toBe('');
    });

    it('masks email addresses preserving first letter and domain', () => {
      const masked = maskEmail('operations@autoposter.com');
      expect(masked).toBe('o***s@autoposter.com');
      expect(maskEmail(null)).toBe('');
    });

    it('masks bank accounts preserving only last 4 digits', () => {
      const masked = maskBankAccount('987654321098');
      expect(masked).toBe('********1098');
      expect(maskBankAccount(null)).toBe('');
    });

    it('masks PAN preserving first and last 2 characters', () => {
      const masked = maskPan('ABCDE1234F');
      expect(masked).toBe('ABC****4F');
    });

    it('masks GSTIN preserving state code and last 3 characters', () => {
      const masked = maskGstin('27AABCU9603R1ZM');
      expect(masked).toBe('27A*****R1ZM');
    });
  });

  describe('2. Global Omnisearch', () => {
    it('rejects queries shorter than min characters', async () => {
      await expect(AdminSearchService.search('a')).rejects.toThrow();
    });

    it('finds drivers and companies matching query with masked PII', async () => {
      const res = await AdminSearchService.search('Admin Test Driver');
      expect(res).toBeDefined();
      expect(res.results.drivers).toBeDefined();
      expect(res.results.drivers!.length).toBeGreaterThan(0);
      expect(res.results.drivers![0]?.title).toBe('Admin Test Driver');
      expect(res.results.drivers![0]?.subtitle).toContain('+91');
      expect(res.results.drivers![0]?.subtitle).toContain('***');
    });
  });

  describe('3. Work Queues & My-Work Aggregator', () => {
    it('returns summary counts for all operational queues', async () => {
      const summary = await WorkQueuesService.getSummary();
      expect(summary).toBeDefined();
      expect(summary.queues).toBeDefined();
      expect(Array.isArray(summary.queues)).toBe(true);
      expect(typeof summary.totalPending).toBe('number');
    });

    it('retrieves assigned work items for an admin', async () => {
      const myWork = await WorkQueuesService.getMyWork(moderatorUser.id);
      expect(Array.isArray(myWork)).toBe(true);
    });
  });

  describe('4. Dashboards & Analytics Rollups', () => {
    it('computes daily rollup and stores in database', async () => {
      const today = new Date().toISOString().slice(0, 10);
      await AnalyticsService.computeRollupForDate(today);
      const metrics = await prisma.dailyMetric.findFirst({
        where: { date: new Date(`${today}T00:00:00.000Z`) },
      });
      expect(metrics).toBeDefined();
    });

    it('returns overview metrics and city breakdown', async () => {
      const overview = await AnalyticsService.getOverview();
      expect(overview).toBeDefined();
      expect(overview.kpis).toBeDefined();
      expect(Array.isArray(overview.cityBreakdown)).toBe(true);
    });
  });

  describe('5. Reports Registry & Export Streaming', () => {
    it('creates and processes a CSV export job', async () => {
      const job = await ReportsService.requestExport({
        reportKey: 'CAMPAIGNS',
        format: 'CSV',
        requestedById: superAdminUser.id,
      });

      expect(job.exportId).toBeDefined();

      const exportsList = await ReportsService.listExports();
      expect(exportsList.some((e) => e.id === job.exportId)).toBe(true);
    });
  });

  describe('6. 360-Degree Entity Overviews', () => {
    it('returns complete driver 360 snapshot with masked data', async () => {
      const dOverview = await Entity360Service.getDriverOverview(driverUser.driverProfile.id);
      expect(dOverview).toBeDefined();
      expect(dOverview.profile.fullName).toBe('Admin Test Driver');
      expect(dOverview.profile.mobile).toContain('***');
      expect(dOverview.profile.lifetimeEarningsPaise).toBeDefined();
    });

    it('returns complete company 360 snapshot with masked tax details', async () => {
      const cOverview = await Entity360Service.getCompanyOverview(companyUser.companyProfile.id);
      expect(cOverview).toBeDefined();
      expect(cOverview.profile.companyName).toBe('Test Brand PVT LTD');
      expect(cOverview.profile.gstin).toContain('***');
      expect(cOverview.financialSummary).toBeDefined();
    });
  });

  describe('7. Maker-Checker Parameter Changes & Settings', () => {
    it('creates a change request for sensitive keys rather than updating directly', async () => {
      const result = await AdminSettingsService.updateOrRequestSetting(
        moderatorUser.id,
        'platform.commission_rate_bps',
        1200,
        'Annual fee review',
      );

      expect(result.requiresApproval).toBe(true);
      expect(result.requestId).toBeDefined();

      // Checker approvals
      await AdminSettingsService.reviewChangeRequest(
        superAdminUser.id,
        result.requestId,
        'APPROVE',
      );

      const requestInDb = await prisma.settingChangeRequest.findUnique({
        where: { id: result.requestId },
      });
      expect(requestInDb?.status).toBe('APPROVED');
    });

    it('prevents maker from being their own checker', async () => {
      const result = await AdminSettingsService.updateOrRequestSetting(
        moderatorUser.id,
        'platform.gst_rate_bps',
        1800,
        'GST test',
      );

      await expect(
        AdminSettingsService.reviewChangeRequest(
          moderatorUser.id, // Same admin!
          result.requestId,
          'APPROVE',
        )
      ).rejects.toThrow();
    });
  });

  describe('8. Roles & Permissions Matrix', () => {
    it('returns immutable Super Admin permissions and editable roles', async () => {
      const matrix = await RolesService.getRolesMatrix();
      expect(matrix.roles).toContain(ROLES.SUPER_ADMIN);
      expect(matrix.matrix[ROLES.SUPER_ADMIN].length).toBe(matrix.permissions.length);
    });

    it('blocks attempting to reduce Super Admin permissions', async () => {
      await expect(
        RolesService.updateRolePermissions(superAdminUser.id, ROLES.SUPER_ADMIN, [])
      ).rejects.toThrow();
    });
  });

  describe('9. Legal Documents & Help Articles CMS', () => {
    it('creates and publishes legal policy draft', async () => {
      const draft = await LegalService.createDraft(superAdminUser.id, {
        type: 'TERMS',
        title: 'Updated Master Terms of Service',
        bodyMarkdown: '# Terms and Conditions\n\nAll partners agree...',
      });

      expect(draft.status).toBe(LEGAL_DOCUMENT_STATUS.DRAFT);

      const published = await LegalService.publishDocument(superAdminUser.id, draft.id);
      expect(published.status).toBe(LEGAL_DOCUMENT_STATUS.PUBLISHED);
    });

    it('creates, reads and updates help articles', async () => {
      const article = await HelpService.createArticle(superAdminUser.id, {
        category: 'DRIVERS',
        title: 'Poster Mounting Guide',
        bodyMarkdown: 'Always mount posters on flat dry metal surface.',
        published: true,
      });

      expect(article.id).toBeDefined();

      const retrieved = await HelpService.getArticle(article.id);
      expect(retrieved.title).toBe('Poster Mounting Guide');
    });
  });

  describe('10. System Health Diagnostics & Job Runs', () => {
    it('records job execution runs and monitors status', async () => {
      await SystemService.recordJobRun({
        jobName: 'daily-analytics-aggregation',
        status: JOB_RUN_STATUS.SUCCESS,
        startedAt: new Date(Date.now() - 5000),
        finishedAt: new Date(),
      });

      const jobsList = await SystemService.listJobRuns({ limit: 10 });
      expect(jobsList.items.some((j) => j.jobName === 'daily-analytics-aggregation')).toBe(true);
    });

    it('returns healthy status for core services', async () => {
      const health = await SystemService.getHealth();
      expect(health.status).toBe('HEALTHY');
      expect(health.checks.database.status).toBe('UP');
    });
  });

  describe('11. Saved Views Management', () => {
    it('creates and retrieves custom saved views', async () => {
      const savedView = await SavedViewsService.createSavedView(superAdminUser.id, {
        pageKey: 'drivers-registry',
        name: 'Maharashtra Verified Drivers',
        filters: { columns: ['fullName', 'mobile', 'cityName'] },
      });

      expect(savedView.id).toBeDefined();

      const views = await SavedViewsService.listSavedViews(superAdminUser.id, 'drivers-registry');
      expect(views.some((v) => v.id === savedView.id)).toBe(true);

      await SavedViewsService.deleteSavedView(superAdminUser.id, savedView.id);
    });
  });
});
