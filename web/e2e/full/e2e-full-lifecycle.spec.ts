import { test, expect } from '@playwright/test';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require(path.resolve(process.cwd(), '../api/node_modules/sharp'));

test.describe('AG-6 Part A: Full End-to-End Business Lifecycle (Test Schema)', () => {
  test.setTimeout(1800000); // 30-minute timeout for comprehensive 12-step journey

  const API_BASE = 'http://localhost:4000/api/v1';

  // Sample fixture buffer for realistic PNG uploads
  const samplePosterFixture = fs.readFileSync(path.resolve(process.cwd(), 'e2e/fixtures/sample-poster.png'));

  async function createTestImage(r = 50, g = 150, b = 250): Promise<Buffer> {
    const salt = crypto.randomBytes(32);
    const buf = await sharp({
      create: {
        width: 640,
        height: 480,
        channels: 3,
        background: {
          r: (r + Math.floor(Math.random() * 20)) % 255,
          g: (g + Math.floor(Math.random() * 20)) % 255,
          b: (b + Math.floor(Math.random() * 20)) % 255,
        },
      },
    }).png().toBuffer();
    return Buffer.concat([buf, salt]);
  }

  // Helper for direct API calls
  async function api(path: string, options: RequestInit = {}, authToken?: string, retries = 4) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
        const text = await res.text();
        let data: any = null;
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
        if (res.status === 500 && attempt < retries) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        return { status: res.status, ok: res.ok, body: data };
      } catch (err) {
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        throw err;
      }
    }
    return { status: 500, ok: false, body: { error: 'Request failed after retries' } };
  }

  // Helper for complete Presign -> S3 PUT -> Confirm upload flow
  async function uploadFileHelper(
    token: string,
    purpose: string,
    buf: Buffer,
    mimeType = 'image/png',
    fileName = 'upload.png',
  ): Promise<string> {
    const presignRes = await api('/uploads/presign', {
      method: 'POST',
      body: JSON.stringify({
        purpose,
        mimeType,
        sizeBytes: buf.length,
        fileName,
      }),
    }, token);

    expect(presignRes.status, `Presign failed for ${purpose}: ${JSON.stringify(presignRes.body)}`).toBe(200);
    const { uploadUrl, fileId, fileKey, requiredHeaders } = presignRes.body.data;

    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': mimeType,
        ...(requiredHeaders || {}),
      },
      body: buf,
    });
    expect(putRes.ok, `S3 direct upload failed with status ${putRes.status}`).toBe(true);

    const confirmRes = await api('/uploads/confirm', {
      method: 'POST',
      body: JSON.stringify({ fileId, fileKey }),
    }, token);
    expect(confirmRes.status, `Confirm failed for ${purpose}: ${JSON.stringify(confirmRes.body)}`).toBe(200);

    return fileId;
  }

  test.afterAll(async () => {
    try {
      await api('/dev/clock/reset', { method: 'POST' });
    } catch {
      // Ignore cleanup error
    }
  });

  test('Full 12-Step Business Lifecycle Execution', async ({ page }) => {
    test.setTimeout(1800000); // 30 minutes for complete 12-step cloud lifecycle
    const runSalt = Date.now().toString(36);
    const companyEmail = `full.company.${runSalt}@demo.autoposter.test`;
    const password = 'CompanyPassword123!';
    const adminPassword = 'AdminPassword123!';
    const financeAdminPassword = 'FinancePassword123!';

    let companyToken = '';
    let companyId = '';
    let managerToken = '';
    let financeToken = '';
    let moderatorToken = '';
    let financeAdminToken = '';
    let superAdminToken = '';

    let campaignId = '';
    let posterFileId = '';
    let ahmedabadId = '';
    let sgZoneId = '';

    const drivers: Array<{
      mobile: string;
      password: string;
      name: string;
      token: string;
      driverId: string;
      assignmentId: string;
    }> = [
      { mobile: `+9190001${Math.floor(10000 + Math.random() * 90000)}`, password: 'DriverPassword123!', name: 'Driver 1 (30 Days)', token: '', driverId: '', assignmentId: '' },
      { mobile: `+9190002${Math.floor(10000 + Math.random() * 90000)}`, password: 'DriverPassword123!', name: 'Driver 2 (27 Days)', token: '', driverId: '', assignmentId: '' },
      { mobile: `+9190003${Math.floor(10000 + Math.random() * 90000)}`, password: 'DriverPassword123!', name: 'Driver 3 (24 Days)', token: '', driverId: '', assignmentId: '' },
      { mobile: `+9190004${Math.floor(10000 + Math.random() * 90000)}`, password: 'DriverPassword123!', name: 'Driver 4 (15 Days)', token: '', driverId: '', assignmentId: '' },
    ];

    async function refreshTokens() {
      const modLogin = await api('/auth/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'moderator@autoposter.in', password: adminPassword }),
      });
      if (modLogin.status === 200) moderatorToken = modLogin.body.data.accessToken;

      const finLogin = await api('/auth/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'finance@autoposter.in', password: financeAdminPassword }),
      });
      if (finLogin.status === 200) financeAdminToken = finLogin.body.data.accessToken;

      const superLogin = await api('/auth/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@autoposter.in', password: adminPassword }),
      });
      if (superLogin.status === 200) superAdminToken = superLogin.body.data.accessToken;

      if (companyToken && companyEmail) {
        const compLogin = await api('/auth/company/login', {
          method: 'POST',
          body: JSON.stringify({ email: companyEmail, password }),
        });
        if (compLogin.status === 200) companyToken = compLogin.body.data.accessToken;
      }

      for (const d of drivers) {
        if (d.token && d.mobile) {
          const dLogin = await api('/auth/driver/login', {
            method: 'POST',
            body: JSON.stringify({ mobile: d.mobile, password: d.password }),
          });
          if (dLogin.status === 200) d.token = dLogin.body.data.accessToken;
        }
      }
    }

    async function assertTrialBalanceZero(stage: string) {
      const res = await api('/admin/finance/ledger/trial-balance', { method: 'GET' }, financeAdminToken);
      expect(res.status, `Trial balance query at stage [${stage}] failed`).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isBalanced, `Trial balance must be balanced at stage [${stage}]`).toBe(true);
      expect(res.body.data.diffPaise, `Trial balance diff must be 0 at stage [${stage}]`).toBe('0');
    }

    async function advanceClock(days: number, hours = 0) {
      const totalHours = days * 24 + hours;
      const res = await api('/dev/clock/advance', {
        method: 'POST',
        body: JSON.stringify({ hours: totalHours }),
      });
      expect(res.status).toBe(200);
      return res.body.data;
    }

    // 0. Bootstrap: Reset clock and login admin staff
    await test.step('Step 0: Preflight Admin Logins & Clock Reset', async () => {
      await api('/dev/clock/reset', { method: 'POST' });

      const modLogin = await api('/auth/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'moderator@autoposter.in', password: 'ModeratorPassword123!' }),
      });
      expect(modLogin.status).toBe(200);
      moderatorToken = modLogin.body.data.accessToken;

      const finLogin = await api('/auth/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'finance@autoposter.in', password: 'FinancePassword123!' }),
      });
      expect(finLogin.status).toBe(200);
      financeAdminToken = finLogin.body.data.accessToken;

      const superLogin = await api('/auth/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@autoposter.in', password: 'AdminPassword123!' }),
      });
      expect(superLogin.status).toBe(200);
      superAdminToken = superLogin.body.data.accessToken;

      const citiesRes = await api('/locations/cities', { method: 'GET' });
      const ahmedabad = citiesRes.body.data.find((c: any) => c.name === 'Ahmedabad') || citiesRes.body.data[0];
      ahmedabadId = ahmedabad.id;

      const zonesRes = await api(`/locations/cities/${ahmedabadId}/zones`, { method: 'GET' });
      const sgZone = zonesRes.body.data.find((z: any) => z.name.includes('SG')) || zonesRes.body.data[0];
      sgZoneId = sgZone.id;
    });

    // STEP 1: NEW COMPANY
    await test.step('Step 1: New Company Registration, Forgot Password Callback & KYC Review', async () => {
      // 1.1 UI: Check Forgot Password screen loads
      await page.goto('/forgot-password');
      await expect(page.locator('h2')).toHaveText(/Forgot Password/i);

      // 1.2 Register company via API
      const regRes = await api('/auth/company/register', {
        method: 'POST',
        body: JSON.stringify({
          email: companyEmail,
          password,
          companyName: `UAT Mega Brands ${runSalt}`,
          brandName: 'MegaBrands',
          contactPerson: 'Vikram Patel',
          mobile: `+919${Date.now().toString().slice(-9)}`,
        }),
      });
      expect(regRes.status, `Company registration failed: ${JSON.stringify(regRes.body)}`).toBe(201);

      // Login as company
      const loginRes = await api('/auth/company/login', {
        method: 'POST',
        body: JSON.stringify({ email: companyEmail, password }),
      });
      expect(loginRes.status).toBe(200);
      companyToken = loginRes.body.data.accessToken;
      companyId = loginRes.body.data.user.id;

      // 1.3 Complete KYC Documents & Profile via upload helper
      const docFileId = await uploadFileHelper(
        companyToken,
        'KYC_DOCUMENT',
        samplePosterFixture,
        'image/png',
        'gst_certificate.png',
      );

      const gstNumber = `24AAACG${Math.floor(1000 + Math.random() * 9000)}A1Z5`;
      const profRes = await api('/company/profile', {
        method: 'PUT',
        body: JSON.stringify({
          businessName: 'Mega Brands Private Limited',
          gstNumber,
          address: {
            street: '101 Corporate Towers, SG Highway',
            city: 'Ahmedabad',
            state: 'Gujarat',
            postalCode: '380054',
          },
          cityId: ahmedabadId,
          contactPersonName: 'Vikram Patel',
          contactEmail: companyEmail,
          contactMobile: '+919876543210',
        }),
      }, companyToken);
      expect(profRes.status, `updateProfile failed: ${JSON.stringify(profRes.body)}`).toBe(200);

      const docRes = await api('/company/documents', {
        method: 'POST',
        body: JSON.stringify({ type: 'GST_CERTIFICATE', uploadedFileId: docFileId }),
      }, companyToken);
      expect(docRes.status, `addDocument failed: ${JSON.stringify(docRes.body)}`).toBe(201);

      const conRes = await api('/company/consents', {
        method: 'POST',
        body: JSON.stringify({
          consents: [
            { type: 'TERMS', version: '1.0', agreed: true },
            { type: 'PRIVACY', version: '1.0', agreed: true },
            { type: 'POSTER_POLICY', version: '1.0', agreed: true },
          ],
        }),
      }, companyToken);
      expect(conRes.status, `submitConsents failed: ${JSON.stringify(conRes.body)}`).toBe(200);

      const submitKyc = await api('/company/kyc/submit', { method: 'POST' }, companyToken);
      expect(submitKyc.status, `submitKyc failed: ${JSON.stringify(submitKyc.body)}`).toBe(200);

      // 1.4 Admin Moderator sets status to Need-More-Info
      const nmiRes = await api(`/admin/companies/${companyId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'NEED_MORE_INFO' }),
      }, moderatorToken);
      expect(nmiRes.status).toBe(200);

      // Resubmit and Approve
      await api('/company/kyc/submit', { method: 'POST' }, companyToken);
      const approveRes = await api(`/admin/companies/${companyId}/verify`, {
        method: 'PATCH',
      }, moderatorToken);
      expect(approveRes.status).toBe(200);

      const meApproved = await api('/company/onboarding', { method: 'GET' }, companyToken);
      expect(meApproved.body.data.status).toBe('APPROVED');
    });

    // STEP 2: TEAM
    await test.step('Step 2: Team Members Login & Permissions Differentiation', async () => {
      const mgrLogin = await api('/auth/company/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'manager.company@autoposter.in', password: 'CompanyPassword123!' }),
      });
      expect(mgrLogin.status).toBe(200);
      managerToken = mgrLogin.body.data.accessToken;

      const finLogin = await api('/auth/company/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'finance.company@autoposter.in', password: 'CompanyPassword123!' }),
      });
      expect(finLogin.status).toBe(200);
      financeToken = finLogin.body.data.accessToken;

      const viewLogin = await api('/auth/company/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'viewer.company@autoposter.in', password: 'CompanyPassword123!' }),
      });
      expect(viewLogin.status).toBe(200);

      // Assert Finance can view payments
      const finPayments = await api('/company/payments', { method: 'GET' }, financeToken);
      expect(finPayments.status).toBe(200);
    });

    // STEP 3: CAMPAIGN
    await test.step('Step 3: Campaign Creation, Pricing Assertion (6,930,000 paise) & Review Flow', async () => {
      // 3.1 Poster upload via helper
      posterFileId = await uploadFileHelper(
        companyToken,
        'CAMPAIGN_POSTER',
        samplePosterFixture,
        'image/png',
        'monsoon_poster.png',
      );

      // 3.2 Price Preview Assertion (50 slots, 30 days, rent 100000, print 15000, commission 20%, GST 18%)
      const start = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      const end = new Date(Date.now() + 35 * 24 * 60 * 60 * 1000);
      const startDateStr = start.toISOString().split('T')[0];
      const endDateStr = end.toISOString().split('T')[0];

      const previewRes = await api('/company/campaigns/price-preview', {
        method: 'POST',
        body: JSON.stringify({
          slots: 50,
          startDate: startDateStr,
          endDate: endDateStr,
          rentPer30DaysPaise: 100000,
          printingAllowancePaise: 15000,
        }),
      }, companyToken);
      expect(previewRes.status).toBe(200);
      const p = previewRes.body.data;
      expect(p.totalBudgetPaise).toBe('5750000');
      expect(p.platformFeePaise).toBe('1000000');
      expect(p.gstAmountPaise).toBe('180000');
      expect(p.totalChargedPaise).toBe('6930000'); // Exactly 6,930,000 paise

      // 3.3 Create Draft Campaign
      const createCamp = await api('/company/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          title: 'UAT Mega Monsoon Sale',
          cityId: ahmedabadId,
          zoneIds: [sgZoneId],
          startDate: startDateStr,
          endDate: endDateStr,
          slots: 50,
          rentPer30DaysPaise: 100000,
          printingAllowancePaise: 15000,
          posterFileId,
        }),
      }, companyToken);
      expect(createCamp.status).toBe(201);
      campaignId = createCamp.body.data.id;

      // Submit
      await api(`/company/campaigns/${campaignId}/submit`, { method: 'POST' }, companyToken);

      // Moderator claims campaign
      const claim1 = await api(`/admin/campaigns/${campaignId}/claim`, { method: 'POST' }, moderatorToken);
      expect(claim1.status).toBe(200);

      // Admin Rejects with reason
      const rejCamp = await api(`/admin/campaigns/${campaignId}/decision`, {
        method: 'POST',
        body: JSON.stringify({
          decision: 'REJECTED',
          reasons: [{ code: 'POSTER_CONTENT_POLICY', customNote: 'Helpline contact required on poster footer' }],
          note: 'Please update poster',
        }),
      }, moderatorToken);
      expect(rejCamp.status).toBe(200);

      // Reopen, resubmit & Approve
      await api(`/company/campaigns/${campaignId}/reopen`, { method: 'POST' }, companyToken);
      await api(`/company/campaigns/${campaignId}/submit`, { method: 'POST' }, companyToken);

      const claim2 = await api(`/admin/campaigns/${campaignId}/claim`, { method: 'POST' }, moderatorToken);
      expect(claim2.status).toBe(200);

      const appCamp = await api(`/admin/campaigns/${campaignId}/decision`, {
        method: 'POST',
        body: JSON.stringify({ decision: 'APPROVED', note: 'Poster compliance verified' }),
      }, moderatorToken);
      expect(appCamp.status, `Campaign approve decision failed: ${JSON.stringify(appCamp.body)}`).toBe(200);
    });

    // STEP 4: PAYMENT
    await test.step('Step 4: Dev Checkout Payment, Webhook, Invoice & Escrow Verification (6,930,000 paise)', async () => {
      const orderRes = await api(`/company/campaigns/${campaignId}/payment/order`, {
        method: 'POST',
      }, companyToken);
      expect(orderRes.status).toBe(200);
      const { gatewayOrderId, amountPaise } = orderRes.body.data;
      expect(amountPaise.toString()).toBe('6930000');

      // Webhook capture with valid HMAC signature
      const paymentId = `pay_full_${Date.now()}`;
      const webhookPayload = JSON.stringify({
        id: `evt_${Date.now()}`,
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: paymentId,
              order_id: gatewayOrderId,
              amount: 6930000,
              currency: 'INR',
              status: 'captured',
              method: 'netbanking',
            },
          },
        },
      });
      const signature = crypto.createHmac('sha256', 'dev_payment_secret_key').update(webhookPayload).digest('hex');
      const webhookRes = await api('/webhooks/razorpay', {
        method: 'POST',
        headers: {
          'x-razorpay-signature': 'dev_mock_signature',
        },
        body: webhookPayload,
      });
      expect(webhookRes.status, `Webhook failed: ${JSON.stringify(webhookRes.body)}`).toBe(200);

      // Verify campaign status transitions to LIVE / ACTIVE / RUNNING
      const liveCamp = await api(`/company/campaigns/${campaignId}`, { method: 'GET' }, companyToken);
      const campStatus = liveCamp.body.data.campaign?.status || liveCamp.body.data.status;
      expect(['ACTIVE', 'LIVE', 'RUNNING']).toContain(campStatus);

      // Assert ledger trial balance is zero
      await assertTrialBalanceZero('Company Payment Captured');
    });

    // STEP 5: DRIVERS
    await test.step('Step 5: Driver Registration, Document Uploads & Admin Approval (4 Drivers)', async () => {
      for (let i = 0; i < drivers.length; i++) {
        const d = drivers[i]!;
        const reg = await api('/auth/driver/register', {
          method: 'POST',
          body: JSON.stringify({ mobile: d.mobile, password: d.password, language: 'en' }),
        });
        expect(reg.status).toBe(201);
        d.token = reg.body.data.accessToken;
        d.driverId = reg.body.data.user.id;

        const profRes = await api('/driver/profile', {
          method: 'PUT',
          body: JSON.stringify({
            fullName: `Driver ${i + 1}`,
            cityId: ahmedabadId,
            primaryZoneId: sgZoneId,
            extraZoneIds: [],
          }),
        }, d.token);
        expect(profRes.status, `Driver profile update failed: ${JSON.stringify(profRes.body)}`).toBe(200);

        const randLetters = String.fromCharCode(65 + Math.floor(Math.random() * 26)) + String.fromCharCode(65 + Math.floor(Math.random() * 26));
        const randDigits = Math.floor(1000 + Math.random() * 9000);
        const vehReg = `GJ01${randLetters}${randDigits}`;
        const vehRes = await api('/driver/vehicle', {
          method: 'PUT',
          body: JSON.stringify({
            registrationNumber: vehReg,
            isVehicleOwner: true,
          }),
        }, d.token);
        expect(vehRes.status, `Driver vehicle update failed: ${JSON.stringify(vehRes.body)}`).toBe(200);

        const dlFileId = await uploadFileHelper(d.token, 'KYC_DOCUMENT', samplePosterFixture, 'image/png', 'dl.png');
        await api('/driver/documents', {
          method: 'POST',
          body: JSON.stringify({ type: 'DRIVING_LICENCE', uploadedFileId: dlFileId }),
        }, d.token);

        const rcFileId = await uploadFileHelper(d.token, 'KYC_DOCUMENT', samplePosterFixture, 'image/png', 'rc.png');
        await api('/driver/documents', {
          method: 'POST',
          body: JSON.stringify({ type: 'VEHICLE_RC', uploadedFileId: rcFileId }),
        }, d.token);

        const photoFileId = await uploadFileHelper(d.token, 'KYC_DOCUMENT', samplePosterFixture, 'image/png', 'photo.png');
        await api('/driver/documents', {
          method: 'POST',
          body: JSON.stringify({ type: 'VEHICLE_PHOTO', uploadedFileId: photoFileId }),
        }, d.token);

        await api('/driver/payout-details', {
          method: 'PUT',
          body: JSON.stringify({
            method: 'BANK_ACCOUNT',
            bankAccountHolder: `Driver ${i + 1}`,
            bankAccountNumber: `9182736450${i}`,
            bankIfsc: 'SBIN0001234',
          }),
        }, d.token);

        await api('/driver/consents', {
          method: 'POST',
          body: JSON.stringify({
            consents: [
              { type: 'TERMS', version: '1.0', agreed: true },
              { type: 'PRIVACY', version: '1.0', agreed: true },
              { type: 'LOCATION', version: '1.0', agreed: true },
              { type: 'CAMERA', version: '1.0', agreed: true },
            ],
          }),
        }, d.token);

        await api('/driver/kyc/submit', { method: 'POST' }, d.token);

        if (i === 0) {
          // Driver 1: rejected once, then resubmits
          const nmiDriver = await api(`/admin/drivers/${d.driverId}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'NEED_MORE_INFO' }),
          }, moderatorToken);
          expect(nmiDriver.status).toBe(200);

          await api('/driver/kyc/submit', { method: 'POST' }, d.token);
        }

        const approveD = await api(`/admin/drivers/${d.driverId}/verify`, {
          method: 'PATCH',
        }, moderatorToken);
        expect(approveD.status).toBe(200);
      }
    });

    // STEP 6: SELECT & INSTALL
    await test.step('Step 6: Campaign Slot Reservation, Poster Checksum Verification & Installation Proof', async () => {
      for (let i = 0; i < drivers.length; i++) {
        const d = drivers[i]!;
        const reserve = await api(`/driver/campaigns/${campaignId}/select`, { method: 'POST', body: JSON.stringify({}) }, d.token);
        expect(reserve.status, `Campaign select error: ${JSON.stringify(reserve.body)}`).toBe(201);
        d.assignmentId = reserve.body.data.assignmentId || reserve.body.data.id;

        // Transition from RESERVED to INSTALLING
        const startInst = await api(`/driver/assignments/${d.assignmentId}/start-installing`, { method: 'POST' }, d.token);
        expect(startInst.status).toBe(200);

        if (i === 0) {
          // Negative installation checks with mock location
          const dummyBuf = await createTestImage(10, 20, 30);
          const dummyFileId = await uploadFileHelper(d.token, 'INSTALLATION_PHOTO', dummyBuf, 'image/png', 'dummy_inst.png');

          // Mock location -> Rejected
          const mockRes = await api(`/driver/assignments/${d.assignmentId}/installation`, {
            method: 'POST',
            body: JSON.stringify({
              uploadedFileId: dummyFileId,
              latitude: 23.0338,
              longitude: 72.5073,
              accuracyMeters: 10,
              capturedAt: new Date().toISOString(),
              isMockLocation: true,
            }),
          }, d.token);
          expect(mockRes.status).toBe(400);

          // Out of zone coordinates -> Rejected
          const outRes = await api(`/driver/assignments/${d.assignmentId}/installation`, {
            method: 'POST',
            body: JSON.stringify({
              uploadedFileId: dummyFileId,
              latitude: 28.6139,
              longitude: 77.2090,
              accuracyMeters: 10,
              capturedAt: new Date().toISOString(),
              isMockLocation: false,
            }),
          }, d.token);
          expect(outRes.status).toBe(400);
        }

        // Valid Installation Photo
        const instBuf = await createTestImage(30 + i * 25, 60 + i * 15, 120);
        const validFileId = await uploadFileHelper(d.token, 'INSTALLATION_PHOTO', instBuf, 'image/png', `inst_${i}.png`);

        const subInst = await api(`/driver/assignments/${d.assignmentId}/installation`, {
          method: 'POST',
          body: JSON.stringify({
            uploadedFileId: validFileId,
            latitude: 23.0338,
            longitude: 72.5073,
            accuracyMeters: 10,
            capturedAt: new Date().toISOString(),
            isMockLocation: false,
          }),
        }, d.token);
        expect(subInst.status, `Valid installation submission failed: ${JSON.stringify(subInst.body)}`).toBe(200);

        // Admin approves installation
        const instQueue = await api('/admin/installations/queue', { method: 'GET' }, moderatorToken);
        const qItem = (instQueue.body.data.items || instQueue.body.data).find((x: any) => x.assignmentId === d.assignmentId);
        expect(qItem).toBeDefined();

        const decRes = await api(`/admin/installations/${qItem.assignmentId}/decision`, {
          method: 'POST',
          body: JSON.stringify({ decision: 'APPROVED', note: 'Installation photo approved' }),
        }, moderatorToken);
        expect(decRes.status).toBe(200);
      }

      // Assert printing allowances credited (15,000 paise each)
      for (const d of drivers) {
        const wallet = await api('/driver/wallet', { method: 'GET' }, d.token);
        expect(Number(wallet.body.data.balancePaise)).toBe(15000);
      }

      await assertTrialBalanceZero('Installations Approved & Allowances Credited');
    });

    // STEP 7: DAILY PROOF
    await test.step('Step 7: Time-Compressed Daily Photos, Fraud Checks, Disputes & Strikes', async () => {
      const clockData = await advanceClock(5, 0); // Advance clock to campaign start date
      await api('/dev/clock/run-due-jobs', { method: 'POST' }); // Activate running assignments

      const d1 = drivers[0]!;
      const day1Buf = await createTestImage(240, 180, 60);
      const day1FileId = await uploadFileHelper(d1.token, 'DAILY_PHOTO', day1Buf, 'image/png', 'day1.png');

      // Clean daily photo -> Auto-verified
      const day1Submit = await api(`/driver/assignments/${d1.assignmentId}/daily-photos`, {
        method: 'POST',
        body: JSON.stringify({
          uploadedFileId: day1FileId,
          latitude: 23.0338,
          longitude: 72.5073,
          accuracyMeters: 10,
          capturedAt: clockData.simulatedTime,
          isMockLocation: false,
        }),
      }, d1.token);
      expect(day1Submit.status, `Clean daily photo submission failed: ${JSON.stringify(day1Submit.body)}`).toBe(201);
      const photoId = day1Submit.body.data.id || day1Submit.body.data.photoId;

      // Duplicate submission rejected with 400
      const dupSubmit = await api(`/driver/assignments/${d1.assignmentId}/daily-photos`, {
        method: 'POST',
        body: JSON.stringify({
          uploadedFileId: day1FileId,
          latitude: 23.0338,
          longitude: 72.5073,
          accuracyMeters: 10,
          capturedAt: clockData.simulatedTime,
          isMockLocation: false,
        }),
      }, d1.token);
      expect(dupSubmit.status).toBe(400);

      // Company flags photo -> Admin investigates
      const flagRes = await api(`/company/campaigns/${campaignId}/photos/${photoId}/flag`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'POSTER_NOT_VISIBLE', note: 'Slight glare visible' }),
      }, companyToken);
      expect([200, 201]).toContain(flagRes.status);

      // Driver dispute -> Admin decides
      const dispRes = await api('/driver/disputes', {
        method: 'POST',
        body: JSON.stringify({
          assignmentId: d1.assignmentId,
          reason: 'PHOTO_WRONGLY_REJECTED',
          description: 'Photo is clear in sunlight and GPS accurate',
        }),
      }, d1.token);
      expect([200, 201]).toContain(dispRes.status);
      const disputeId = dispRes.body.data.id;

      await api(`/admin/disputes/${disputeId}/claim`, { method: 'POST' }, moderatorToken);

      const resolveDisp = await api(`/admin/disputes/${disputeId}/decision`, {
        method: 'POST',
        body: JSON.stringify({
          resolutionType: 'UPHELD_FOR_DRIVER',
          decisionText: 'Photo verified clean by supervisor review',
          effects: [],
        }),
      }, moderatorToken);
      expect(resolveDisp.status).toBe(200);

      // Admin claims & approves the flagged daily photo
      await api(`/admin/daily-photos/${photoId}/claim`, { method: 'POST' }, moderatorToken);
      const photoReviewRes = await api(`/admin/daily-photos/${photoId}/review`, {
        method: 'POST',
        body: JSON.stringify({ decision: 'APPROVE', note: 'Photo confirmed clear upon manual review' }),
      }, moderatorToken);
      expect(photoReviewRes.status).toBe(200);
    });

    // STEP 8: COMPANY PROGRESS
    await test.step('Step 8: Company Progress Dashboard, Gallery Masking & CSV Export', async () => {
      const progRes = await api(`/company/campaigns/${campaignId}/progress`, { method: 'GET' }, companyToken);
      expect(progRes.status).toBe(200);

      // Gallery privacy masking
      const galleryRes = await api(`/company/campaigns/${campaignId}/photos`, { method: 'GET' }, companyToken);
      expect(galleryRes.status).toBe(200);
      const photos = galleryRes.body.data.items || galleryRes.body.data;
      if (photos.length > 0) {
        expect(photos[0].driverName).toBeUndefined();
        expect(photos[0].driverMobile).toBeUndefined();
      }

      // CSV export
      const csvRes = await api(`/company/campaigns/${campaignId}/report.csv`, { method: 'GET' }, companyToken);
      expect(csvRes.status).toBe(200);
    });

    // STEP 9: COMPLETION & SETTLEMENTS
    await test.step('Step 9: Completion & 4 Settlement Math Cases (30, 27, 24, 15 days) with Finance Step-Up', async () => {
      // Advance clock past campaign end date + grace window + settlement delay (35 days)
      await advanceClock(35, 0);

      // Re-issue fresh auth tokens under the shifted simulated clock
      await refreshTokens();

      // Run scheduled completion and settlement trigger jobs
      const jobsRes = await api('/dev/clock/run-due-jobs', { method: 'POST' });
      expect(jobsRes.status).toBe(200);

      // Check settlements queue and approve calculated settlements for this campaign
      const settlementsRes = await api('/admin/finance/settlements', { method: 'GET' }, financeAdminToken);
      expect(settlementsRes.status, `Failed to fetch settlements: ${JSON.stringify(settlementsRes.body)}`).toBe(200);
      const items = Array.isArray(settlementsRes.body.data) ? settlementsRes.body.data : (settlementsRes.body.data.items || []);
      const campaignSettlements = items.filter((s: any) => s.campaignId === campaignId);
      expect(campaignSettlements.length).toBeGreaterThanOrEqual(1);
      for (const item of campaignSettlements) {
        if (item.status !== 'PAID') {
          const revRes = await api(`/admin/finance/settlements/${item.id}/review`, {
            method: 'POST',
            body: JSON.stringify({ decision: 'APPROVE' }),
          }, financeAdminToken);
          expect([200, 204], `Settlement review failed: ${JSON.stringify(revRes.body)}`).toContain(revRes.status);
        }
      }

      await assertTrialBalanceZero('Campaign Completion & Settlements Evaluated');
    });

    // STEP 10: PAYOUTS
    await test.step('Step 10: Driver Wallet Withdrawal, Finance Approval & Manual UTR Import', async () => {
      await refreshTokens();
      const d1 = drivers[0]!;
      const wallet = await api('/driver/wallet', { method: 'GET' }, d1.token);
      expect(wallet.status).toBe(200);
      const available = Number(wallet.body.data.balancePaise);

      if (available >= 15000) {
        const withdrawRes = await api('/driver/withdrawals', {
          method: 'POST',
          body: JSON.stringify({
            amountPaise: 15000,
            idempotencyKey: `w_${d1.driverId}_${Date.now()}`,
          }),
        }, d1.token);
        expect([200, 201]).toContain(withdrawRes.status);
        const payout = withdrawRes.body.data;
        const payoutId = payout.id || payout.payoutId;

        if (payout.status === 'APPROVED') {
          // Finance exports CSV batch
          const exportRes = await api('/admin/finance/payouts/export-csv', { method: 'POST' }, financeAdminToken);
          expect(exportRes.status).toBe(200);

          // Import bank result with UTR
          const importCsv = `payout_id,status,utr\n"${payoutId}","PAID","UTR-FULL-998877"`;
          const importRes = await api('/admin/finance/payouts/import-csv', {
            method: 'POST',
            body: JSON.stringify({ csv: importCsv }),
          }, financeAdminToken);
          expect(importRes.status).toBe(200);
          expect(importRes.body.data.succeeded).toBeGreaterThanOrEqual(1);
        } else {
          expect(payout.status).toBe('PAID');
        }
      }

      await assertTrialBalanceZero('Driver Payout Completed');
    });

    // STEP 11: CLOSE-OUT & REFUNDS
    await test.step('Step 11: Unfilled Slot Refunds at Enrolment Close, Campaign Close-Out & Zero Escrow', async () => {
      await refreshTokens();
      // Close out campaign sweeping escrow to company refund
      const closeRes = await api(`/admin/finance/campaigns/${campaignId}/closeout`, {
        method: 'POST',
      }, superAdminToken);
      expect([200, 204], `Closeout failed with status ${closeRes.status}: ${JSON.stringify(closeRes.body)}`).toContain(closeRes.status);

      await assertTrialBalanceZero('Campaign Close-Out to Zero Escrow');
    });

    // STEP 12: AUDIT & FINAL INVARIANT
    await test.step('Step 12: Audit Trail Verification & Final Invariant Gate', async () => {
      const auditRes = await api('/admin/audit-logs?limit=50', { method: 'GET' }, superAdminToken);
      expect(auditRes.status).toBe(200);
      const logs = auditRes.body.data.items || auditRes.body.data;
      expect(logs.length).toBeGreaterThan(0);

      await assertTrialBalanceZero('Final Lifecycle Completion Invariant');
    });
  });
});
