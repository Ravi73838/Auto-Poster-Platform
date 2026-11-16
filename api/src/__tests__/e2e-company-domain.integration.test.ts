import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import { createApp } from '../app.js';
import { prisma } from '../shared/db/index.js';
import { disconnectRedis } from '../shared/redis/index.js';
import { TokenService } from '../modules/auth/token.service.js';
import { storageProvider } from '../integrations/storage/index.js';
import {
  ROLES,
  ACCOUNT_STATUS,
  CAMPAIGN_STATUS,
  ASSIGNMENT_STATUS,
  DOCUMENT_TYPES,
  CONSENT_TYPES,
  DISPUTE_REASONS,
  FILE_PURPOSES,
  INSTALL_REVIEW_DECISIONS,
  PHOTO_FLAG_REASONS,
} from '@ap/shared-constants';

describe('Suite 3: Company Domain Flow Endpoints', () => {
  const app = createApp();

  // Test state
  let cityId: string;
  let zoneId: string;

  // Company 1: Onboarding Company (PENDING)
  let onboardingCompanyId: string;
  let onboardingCompanyToken: string;
  let uploadedKycFileId: string;
  let uploadedDocId: string;

  // Company 2: Fully Approved Company
  let activeCompanyId: string;
  let activeCompanyToken: string;
  let posterFileId: string;

  // Campaigns & Related Objects
  let approvedCampaignId: string;
  let liveCampaignId: string;
  let draftCampaignId: string;
  let submittedAssignmentId: string;
  let dailyPhotoId: string;
  let seededPaymentId: string;
  let seededTaxDocId: string;
  let createdDisputeId: string;

  beforeAll(async () => {
    // 0. Mock storage operations with a valid 400x400 PNG so image sanity checks pass
    const VALID_PNG_BUFFER = await sharp({
      create: {
        width: 400,
        height: 400,
        channels: 4,
        background: { r: 0, g: 128, b: 255, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    vi.spyOn(storageProvider, 'getObject').mockResolvedValue(VALID_PNG_BUFFER);
    vi.spyOn(storageProvider, 'putObject').mockResolvedValue(undefined as any);
    vi.spyOn(storageProvider, 'getSignedReadUrl').mockResolvedValue('https://mock-storage.test/file.png');

    // 1. Clean test tables
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "dispute_messages",
        "disputes",
        "tax_documents",
        "campaign_payments",
        "photos",
        "assignment_days",
        "assignment_settlements",
        "assignments",
        "campaign_zones",
        "campaigns",
        "documents",
        "uploaded_files",
        "driver_zones",
        "vehicles",
        "driver_profiles",
        "company_profiles",
        "zones",
        "cities",
        "sessions",
        "users"
      CASCADE;
    `);

    // 2. Seed City & Zone
    const city = await prisma.city.upsert({
      where: {
        name_state: {
          name: 'Ahmedabad',
          state: 'Gujarat',
        },
      },
      create: {
        name: 'Ahmedabad',
        state: 'Gujarat',
        country: 'IN',
        isActive: true,
      },
      update: {
        isActive: true,
      },
    });
    cityId = city.id;

    const zone = await prisma.zone.create({
      data: {
        cityId: city.id,
        name: 'Navrangpura',
        centerLat: 23.0365,
        centerLng: 72.5611,
        radiusMeters: 5000,
        isActive: true,
      },
    });
    zoneId = zone.id;

    // 3. Seed Onboarding Company (PENDING)
    const onboardingCompany = await prisma.user.create({
      data: {
        role: ROLES.COMPANY,
        status: ACCOUNT_STATUS.PENDING,
        mobile: '+919911001100',
        email: 'onboarding@testbrand.com',
        preferredLanguage: 'en',
      },
    });
    onboardingCompanyId = onboardingCompany.id;

    const onboardingSession = await TokenService.createSession({
      userId: onboardingCompany.id,
      platform: 'WEB',
    });
    onboardingCompanyToken = onboardingSession.accessToken;

    const kycFile = await prisma.uploadedFile.create({
      data: {
        ownerUserId: onboardingCompany.id,
        fileKey: 'company/kyc/gst_cert.png',
        purpose: FILE_PURPOSES.KYC_DOCUMENT,
        mimeType: 'image/png',
        sizeBytes: 4096,
        status: 'CONFIRMED',
      },
    });
    uploadedKycFileId = kycFile.id;

    // 4. Seed Active Approved Company
    const activeCompany = await prisma.user.create({
      data: {
        role: ROLES.COMPANY,
        status: ACCOUNT_STATUS.APPROVED,
        mobile: '+919922002200',
        email: 'marketing@superbrand.com',
        preferredLanguage: 'en',
      },
    });
    activeCompanyId = activeCompany.id;

    await prisma.companyProfile.create({
      data: {
        userId: activeCompany.id,
        cityId: city.id,
        companyName: 'Super Brand Retail Pvt Ltd',
        brandName: 'SuperBrand',
        gstin: '24AAACC1234D1Z5',
        contactPersonName: 'Gautam Adani',
        contactPersonPhone: '+919922002200',
        isVerified: true,
      },
    });

    const activeSession = await TokenService.createSession({
      userId: activeCompany.id,
      platform: 'WEB',
    });
    activeCompanyToken = activeSession.accessToken;

    // Seed poster file
    const poster = await prisma.uploadedFile.create({
      data: {
        ownerUserId: activeCompany.id,
        fileKey: 'company/posters/campaign_poster.png',
        purpose: FILE_PURPOSES.CAMPAIGN_POSTER,
        mimeType: 'image/png',
        sizeBytes: 1048576,
        status: 'CONFIRMED',
      },
    });
    posterFileId = poster.id;

    // 5. Seed Approved Campaign (Ready for payment)
    const today = new Date();
    const startDate = new Date(today.getTime() + 86400 * 1000); // Tomorrow
    const endDate = new Date(today.getTime() + 31 * 86400 * 1000); // 30 days run

    const approvedCampaign = await prisma.campaign.create({
      data: {
        companyId: activeCompany.id,
        cityId: city.id,
        posterFileId: poster.id,
        title: 'SuperBrand Spring Carnival',
        targetAutoCount: 5,
        enrolledCount: 0,
        startDate,
        endDate,
        dailyRentPaise: 15000,
        printingAllowancePaise: 50000,
        totalBudgetPaise: 2500000n,
        platformFeePaise: 250000n,
        gstAmountPaise: 495000n,
        totalChargedPaise: 3245000n,
        status: CAMPAIGN_STATUS.APPROVED,
      },
    });
    approvedCampaignId = approvedCampaign.id;

    // 6. Seed Live Running Campaign with Assignments & Photos for progress/installations
    const runStart = new Date(today.getTime() - 2 * 86400 * 1000);
    const runEnd = new Date(today.getTime() + 28 * 86400 * 1000);

    const liveCampaign = await prisma.campaign.create({
      data: {
        companyId: activeCompany.id,
        cityId: city.id,
        posterFileId: poster.id,
        title: 'SuperBrand Mega Electronics Sale',
        targetAutoCount: 5,
        enrolledCount: 1,
        startDate: runStart,
        endDate: runEnd,
        dailyRentPaise: 15000,
        printingAllowancePaise: 50000,
        totalBudgetPaise: 2500000n,
        platformFeePaise: 250000n,
        gstAmountPaise: 495000n,
        totalChargedPaise: 3245000n,
        status: CAMPAIGN_STATUS.RUNNING,
      },
    });
    liveCampaignId = liveCampaign.id;

    await prisma.campaignZone.create({
      data: {
        campaignId: liveCampaign.id,
        zoneId: zone.id,
      },
    });

    // Seed Driver & Vehicle for Live Campaign's assignment
    const driverUser = await prisma.user.create({
      data: {
        role: ROLES.DRIVER,
        status: ACCOUNT_STATUS.APPROVED,
        mobile: '+919933003300',
        preferredLanguage: 'en',
      },
    });

    const vehicle = await prisma.vehicle.create({
      data: {
        registrationNumber: 'GJ01CD5678',
        vehicleType: 'AUTO_RICKSHAW',
        isVerified: true,
      },
    });

    const assignment = await prisma.assignment.create({
      data: {
        campaignId: liveCampaign.id,
        driverId: driverUser.id,
        vehicleId: vehicle.id,
        status: ASSIGNMENT_STATUS.INSTALL_SUBMITTED,
        reservedAt: runStart,
        expiresAt: runEnd,
        totalDays: 30,
      },
    });
    submittedAssignmentId = assignment.id;

    // Seed Installation Photo
    await prisma.photo.create({
      data: {
        assignmentId: assignment.id,
        driverId: driverUser.id,
        kind: 'INSTALLATION',
        photoUrl: 'photos/install_sample.png',
        lat: 23.0365,
        lng: 72.5611,
        accuracyMeters: 10,
        capturedAt: runStart,
        status: 'PENDING_CHECK',
      },
    });

    // Seed Daily Photo
    const dailyPhoto = await prisma.photo.create({
      data: {
        assignmentId: assignment.id,
        driverId: driverUser.id,
        kind: 'DAILY',
        photoDate: runStart,
        photoUrl: 'photos/daily_sample.png',
        lat: 23.0365,
        lng: 72.5611,
        accuracyMeters: 15,
        capturedAt: runStart,
        status: 'VERIFIED',
      },
    });
    dailyPhotoId = dailyPhoto.id;

    // Seed Payment and TaxDocument
    const payment = await prisma.campaignPayment.create({
      data: {
        campaignId: liveCampaign.id,
        companyId: activeCompany.id,
        amountPaise: 3245000n,
        currency: 'INR',
        gateway: 'DEV',
        status: 'PAID',
        gatewayOrderId: 'order_dev_123456',
        gatewayPaymentId: 'pay_dev_123456',
        capturedAt: runStart,
      },
    });
    seededPaymentId = payment.id;

    const taxDoc = await prisma.taxDocument.create({
      data: {
        documentType: 'TAX_INVOICE',
        documentNumber: 'INV-2026-0001',
        financialYear: '2026-27',
        sequenceNumber: 1,
        campaignId: liveCampaign.id,
        companyId: activeCompany.id,
        paymentId: payment.id,
        taxableAmountPaise: 2750000n,
        cgstPaise: 247500n,
        sgstPaise: 247500n,
        totalAmountPaise: 3245000n,
      },
    });
    seededTaxDocId = taxDoc.id;
  }, 30000);

  afterAll(async () => {
    vi.restoreAllMocks();
    await prisma.$disconnect();
    await disconnectRedis();
  }, 30000);

  // --------------------------------------------------------------------------
  // 1. Base Company Guards & Onboarding
  // --------------------------------------------------------------------------
  describe('Company Onboarding & KYC Flow', () => {
    it('GET /api/v1/company/ping verifies company authentication', async () => {
      const res = await request(app)
        .get('/api/v1/company/ping')
        .set('Authorization', `Bearer ${onboardingCompanyToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe('pong');
      expect(res.body.data.role).toBe(ROLES.COMPANY);
    });

    it('rejects unauthenticated requests to company endpoints', async () => {
      const res = await request(app).get('/api/v1/company/onboarding');
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/company/onboarding returns initial onboarding state', async () => {
      const res = await request(app)
        .get('/api/v1/company/onboarding')
        .set('Authorization', `Bearer ${onboardingCompanyToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.canSubmit).toBe(false);
    });

    it('PUT /api/v1/company/profile updates business details', async () => {
      const res = await request(app)
        .put('/api/v1/company/profile')
        .set('Authorization', `Bearer ${onboardingCompanyToken}`)
        .send({
          businessName: 'NextGen Retail Innovations',
          cityId,
          address: {
            street: '100 Feet Road, Satellite',
            city: 'Ahmedabad',
            state: 'Gujarat',
            postalCode: '380015',
          },
          contactPersonName: 'Vikram Sarabhai',
          contactEmail: 'vikram@nextgenretail.com',
          contactMobile: '+919911001100',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/v1/company/documents attaches company verification document', async () => {
      const res = await request(app)
        .post('/api/v1/company/documents')
        .set('Authorization', `Bearer ${onboardingCompanyToken}`)
        .send({
          type: DOCUMENT_TYPES.BUSINESS_PROOF,
          uploadedFileId: uploadedKycFileId,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const doc = await prisma.document.findFirst({
        where: { userId: onboardingCompanyId, documentType: DOCUMENT_TYPES.BUSINESS_PROOF },
      });
      expect(doc).not.toBeNull();
      uploadedDocId = doc!.id;
    });

    it('DELETE /api/v1/company/documents/:id removes attached document', async () => {
      const res = await request(app)
        .delete(`/api/v1/company/documents/${uploadedDocId}`)
        .set('Authorization', `Bearer ${onboardingCompanyToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Re-attach for completing steps
      await request(app)
        .post('/api/v1/company/documents')
        .set('Authorization', `Bearer ${onboardingCompanyToken}`)
        .send({
          type: DOCUMENT_TYPES.BUSINESS_PROOF,
          uploadedFileId: uploadedKycFileId,
        });
    });

    it('POST /api/v1/company/consents records required platform consents', async () => {
      const res = await request(app)
        .post('/api/v1/company/consents')
        .set('Authorization', `Bearer ${onboardingCompanyToken}`)
        .send({
          consents: [
            { type: CONSENT_TYPES.TERMS, version: '1.0' },
            { type: CONSENT_TYPES.PRIVACY, version: '1.0' },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/v1/company/kyc returns KYC review status', async () => {
      const res = await request(app)
        .get('/api/v1/company/kyc')
        .set('Authorization', `Bearer ${onboardingCompanyToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // 2. Campaign Creation, Pricing & Management
  // --------------------------------------------------------------------------
  describe('Campaign Lifecycle & Pricing', () => {
    it('GET /api/v1/company/campaigns/rules returns platform campaign rules', async () => {
      const res = await request(app)
        .get('/api/v1/company/campaigns/rules')
        .set('Authorization', `Bearer ${activeCompanyToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('GET /api/v1/company/campaigns/availability returns city vehicle supply', async () => {
      const res = await request(app)
        .get(`/api/v1/company/campaigns/availability?cityId=${cityId}`)
        .set('Authorization', `Bearer ${activeCompanyToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('POST /api/v1/company/campaigns/price-preview calculates cost quote', async () => {
      const res = await request(app)
        .post('/api/v1/company/campaigns/price-preview')
        .set('Authorization', `Bearer ${activeCompanyToken}`)
        .send({
          startDate: '2026-12-01',
          endDate: '2026-12-31',
          slots: 10,
          rentPer30DaysPaise: 450000,
          printingAllowancePaise: 50000,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalChargedPaise).toBeDefined();
    });

    it('POST /api/v1/company/campaigns creates a new campaign draft', async () => {
      const res = await request(app)
        .post('/api/v1/company/campaigns')
        .set('Authorization', `Bearer ${activeCompanyToken}`)
        .send({
          title: 'Ahmedabad Food Festival Campaign',
          description: 'Promote street food carnival on 10 autos',
          cityId,
          zoneIds: [zoneId],
          slots: 10,
          startDate: '2026-12-01',
          endDate: '2026-12-31',
          rentPer30DaysPaise: 450000,
          printingAllowancePaise: 50000,
          posterFileId,
          printMaterial: 'VINYL_STICKER',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      draftCampaignId = res.body.data.id;
    });

    it('GET /api/v1/company/campaigns lists company campaigns', async () => {
      const res = await request(app)
        .get('/api/v1/company/campaigns')
        .set('Authorization', `Bearer ${activeCompanyToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.items.length).toBeGreaterThan(0);
    });

    it('GET /api/v1/company/campaigns/:id returns campaign details', async () => {
      const res = await request(app)
        .get(`/api/v1/company/campaigns/${draftCampaignId}`)
        .set('Authorization', `Bearer ${activeCompanyToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.campaign.id).toBe(draftCampaignId);
      expect(res.body.data.campaign.title).toBe('Ahmedabad Food Festival Campaign');
    });

    it('PATCH /api/v1/company/campaigns/:id updates campaign draft', async () => {
      const res = await request(app)
        .patch(`/api/v1/company/campaigns/${draftCampaignId}`)
        .set('Authorization', `Bearer ${activeCompanyToken}`)
        .send({
          title: 'Ahmedabad Winter Food Carnival',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Ahmedabad Winter Food Carnival');
    });

    it('POST /api/v1/company/campaigns/:id/clone duplicates campaign', async () => {
      const res = await request(app)
        .post(`/api/v1/company/campaigns/${draftCampaignId}/clone`)
        .set('Authorization', `Bearer ${activeCompanyToken}`);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.id).not.toBe(draftCampaignId);
    });

    it('POST /api/v1/company/campaigns/:id/submit submits draft for admin review', async () => {
      const res = await request(app)
        .post(`/api/v1/company/campaigns/${draftCampaignId}/submit`)
        .set('Authorization', `Bearer ${activeCompanyToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(CAMPAIGN_STATUS.SUBMITTED);
    });

    it('POST /api/v1/company/campaigns/:id/cancel cancels campaign', async () => {
      const res = await request(app)
        .post(`/api/v1/company/campaigns/${draftCampaignId}/cancel`)
        .set('Authorization', `Bearer ${activeCompanyToken}`)
        .send({
          reason: 'Cancelled due to date reshuffling',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(CAMPAIGN_STATUS.CANCELLED);
    });

    it('GET /api/v1/company/campaigns/:id/payment-summary returns quote breakdown', async () => {
      const res = await request(app)
        .get(`/api/v1/company/campaigns/${approvedCampaignId}/payment-summary`)
        .set('Authorization', `Bearer ${activeCompanyToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalChargedPaise).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // 3. Campaign Payments & Invoices
  // --------------------------------------------------------------------------
  describe('Campaign Payments & Tax Documents', () => {
    it('POST /api/v1/company/campaigns/:id/payment/order generates payment order', async () => {
      const res = await request(app)
        .post(`/api/v1/company/campaigns/${approvedCampaignId}/payment/order`)
        .set('Authorization', `Bearer ${activeCompanyToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.gatewayOrderId).toBeDefined();
    });

    it('GET /api/v1/company/campaigns/:id/payments lists payments for campaign', async () => {
      const res = await request(app)
        .get(`/api/v1/company/campaigns/${liveCampaignId}/payments`)
        .set('Authorization', `Bearer ${activeCompanyToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('GET /api/v1/company/payments lists all company payments across campaigns', async () => {
      const res = await request(app)
        .get('/api/v1/company/payments')
        .set('Authorization', `Bearer ${activeCompanyToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.items.length).toBeGreaterThan(0);
    });

    it('GET /api/v1/company/campaigns/:id/invoices lists tax invoices', async () => {
      const res = await request(app)
        .get(`/api/v1/company/campaigns/${liveCampaignId}/invoices`)
        .set('Authorization', `Bearer ${activeCompanyToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('GET /api/v1/company/tax-documents/:id/pdf downloads invoice PDF', async () => {
      const res = await request(app)
        .get(`/api/v1/company/tax-documents/${seededTaxDocId}/pdf`)
        .set('Authorization', `Bearer ${activeCompanyToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
    });
  });

  // --------------------------------------------------------------------------
  // 4. Installations & Daily Proof Operations
  // --------------------------------------------------------------------------
  describe('Installations & Daily Proof Tracking', () => {
    it('GET /api/v1/company/campaigns/:id/installations lists installations', async () => {
      const res = await request(app)
        .get(`/api/v1/company/campaigns/${liveCampaignId}/installations`)
        .set('Authorization', `Bearer ${activeCompanyToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('POST /api/v1/company/installations/:id/decision reviews installation', async () => {
      const res = await request(app)
        .post(`/api/v1/company/installations/${submittedAssignmentId}/decision`)
        .set('Authorization', `Bearer ${activeCompanyToken}`)
        .send({
          decision: INSTALL_REVIEW_DECISIONS.APPROVED,
          note: 'Poster neatly pasted on auto rear.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(ASSIGNMENT_STATUS.INSTALL_APPROVED);
    });

    it('GET /api/v1/company/campaigns/:id/progress returns campaign execution metrics', async () => {
      const res = await request(app)
        .get(`/api/v1/company/campaigns/${liveCampaignId}/progress`)
        .set('Authorization', `Bearer ${activeCompanyToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalVehicles).toBeDefined();
    });

    it('GET /api/v1/company/campaigns/:id/photos lists daily proof photos', async () => {
      const res = await request(app)
        .get(`/api/v1/company/campaigns/${liveCampaignId}/photos`)
        .set('Authorization', `Bearer ${activeCompanyToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.items.length).toBeGreaterThan(0);
    });

    it('GET /api/v1/company/campaigns/:id/map returns geo coordinates of proofs', async () => {
      const res = await request(app)
        .get(`/api/v1/company/campaigns/${liveCampaignId}/map`)
        .set('Authorization', `Bearer ${activeCompanyToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('POST /api/v1/company/campaigns/:id/photos/:photoId/flag flags suspect photo', async () => {
      const res = await request(app)
        .post(`/api/v1/company/campaigns/${liveCampaignId}/photos/${dailyPhotoId}/flag`)
        .set('Authorization', `Bearer ${activeCompanyToken}`)
        .send({
          reason: PHOTO_FLAG_REASONS.POSTER_NOT_VISIBLE,
          note: 'Angle is obscured by dirt',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/v1/company/campaigns/:id/report.csv exports CSV audit report', async () => {
      const res = await request(app)
        .get(`/api/v1/company/campaigns/${liveCampaignId}/report.csv`)
        .set('Authorization', `Bearer ${activeCompanyToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
    });
  });

  // --------------------------------------------------------------------------
  // 5. Company Disputes
  // --------------------------------------------------------------------------
  describe('Company Disputes', () => {
    it('POST /api/v1/company/disputes creates a new company dispute', async () => {
      const res = await request(app)
        .post('/api/v1/company/disputes')
        .set('Authorization', `Bearer ${activeCompanyToken}`)
        .send({
          campaignId: liveCampaignId,
          reason: DISPUTE_REASONS.PRINT_QUALITY,
          description: 'Print color fading on vinyl posters across Ahmedabad zone',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      createdDisputeId = res.body.data.id;
    });

    it('GET /api/v1/company/disputes lists disputes opened by company', async () => {
      const res = await request(app)
        .get('/api/v1/company/disputes')
        .set('Authorization', `Bearer ${activeCompanyToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('GET /api/v1/company/disputes/:id returns dispute detail', async () => {
      const res = await request(app)
        .get(`/api/v1/company/disputes/${createdDisputeId}`)
        .set('Authorization', `Bearer ${activeCompanyToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(createdDisputeId);
    });

    it('POST /api/v1/company/disputes/:id/messages adds response to dispute', async () => {
      const res = await request(app)
        .post(`/api/v1/company/disputes/${createdDisputeId}/messages`)
        .set('Authorization', `Bearer ${activeCompanyToken}`)
        .send({
          body: 'We have contacted our printing vendor to inspect sample batch.',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
    });
  });
});
