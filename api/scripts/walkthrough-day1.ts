import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require(path.resolve(process.cwd(), 'node_modules/sharp'));

const API_BASE = 'http://localhost:4000/api/v1';
const STATE_PATH = path.resolve(process.cwd(), '.local/walkthrough/state.json');

const samplePosterFixture = fs.readFileSync(path.resolve(process.cwd(), '../web/e2e/fixtures/sample-poster.png'));

// State store helper
function loadState(): any {
  if (fs.existsSync(STATE_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
    } catch {
      // ignore
    }
  }
  return {
    companies: {},
    drivers: {},
    campaigns: {},
    assignments: {},
    photos: {},
    flags: {},
    disputes: {},
    strikes: {},
  };
}

function saveState(state: any) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
}

async function api(endpoint: string, options: RequestInit = {}, authToken?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  const text = await res.text();
  try {
    return { status: res.status, ok: res.ok, body: JSON.parse(text) };
  } catch {
    return { status: res.status, ok: res.ok, body: text };
  }
}

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

  if (!presignRes.ok) {
    throw new Error(`Presign failed for ${purpose}: ${JSON.stringify(presignRes.body)}`);
  }
  const { uploadUrl, fileId, fileKey, requiredHeaders } = presignRes.body.data;

  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': mimeType,
      ...(requiredHeaders || {}),
    },
    body: buf,
  });

  if (!putRes.ok) {
    throw new Error(`S3 direct upload failed with status ${putRes.status}`);
  }

  const confirmRes = await api('/uploads/confirm', {
    method: 'POST',
    body: JSON.stringify({ fileId, fileKey }),
  }, token);

  if (!confirmRes.ok) {
    throw new Error(`Confirm failed for ${purpose}: ${JSON.stringify(confirmRes.body)}`);
  }

  return fileId;
}

async function main() {
  console.log('================================================================');
  console.log('🚀 AG-6 WALKTHROUGH DAY 1: PUBLIC SCHEMA EXECUTION (ADDITIVE)');
  console.log('================================================================\n');

  const state = loadState();

  // 1. Authenticate administrative staff
  console.log('🔑 Logging in Admin Personas...');
  const modLogin = await api('/auth/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'moderator@autoposter.in', password: 'ModeratorPassword123!' }),
  });
  if (!modLogin.ok) throw new Error('Moderator login failed');
  const moderatorToken = modLogin.body.data.accessToken;

  const finLogin = await api('/auth/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'finance@autoposter.in', password: 'FinancePassword123!' }),
  });
  if (!finLogin.ok) throw new Error('Finance login failed');
  const financeAdminToken = finLogin.body.data.accessToken;

  const superLogin = await api('/auth/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@autoposter.in', password: 'AdminPassword123!' }),
  });
  if (!superLogin.ok) throw new Error('Super Admin login failed');
  const superAdminToken = superLogin.body.data.accessToken;
  console.log('✅ Admin tokens acquired.');

  // Resolve Ahmedabad city & SG Highway zone
  const citiesRes = await api('/locations/cities', { method: 'GET' });
  const ahmedabad = citiesRes.body.data.find((c: any) => c.name === 'Ahmedabad') || citiesRes.body.data[0];
  const ahmedabadId = ahmedabad.id;

  const zonesRes = await api(`/locations/cities/${ahmedabadId}/zones`, { method: 'GET' });
  const sgZone = zonesRes.body.data.find((z: any) => z.name.includes('SG')) || zonesRes.body.data[0];
  const sgZoneId = sgZone.id;
  console.log(`📍 Location resolved: City ${ahmedabad.name} (${ahmedabadId}), Zone ${sgZone.name} (${sgZoneId})\n`);

  // ============================================================================
  // PHASE 1: COMPANIES (C1 - C4)
  // ============================================================================
  console.log('--- PHASE 1: COMPANY ONBOARDING ---');
  const uatPassword = 'UatPass2026!';

  // C1: UAT Fresh Mart
  let c1Token = state.companies['C1']?.token;
  let c1Id = state.companies['C1']?.id;
  if (!c1Id) {
    console.log('Registering C1: UAT Fresh Mart...');
    const regC1 = await api('/auth/company/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'c1.owner@demo.autoposter.test',
        password: uatPassword,
        companyName: 'UAT Fresh Mart Private Limited',
        brandName: 'FreshMart',
        contactPerson: 'Vikram Patel',
        mobile: '+919000000101',
      }),
    });
    if (!regC1.ok && regC1.status !== 409) throw new Error(`C1 registration failed: ${JSON.stringify(regC1.body)}`);
    
    const loginC1 = await api('/auth/company/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'c1.owner@demo.autoposter.test', password: uatPassword }),
    });
    c1Token = loginC1.body.data.accessToken;
    c1Id = loginC1.body.data.user.id;

    // Upload GST Document
    const c1Doc = await uploadFileHelper(c1Token, 'KYC_DOCUMENT', samplePosterFixture, 'image/png', 'gst_cert.png');
    await api('/company/profile', {
      method: 'PUT',
      body: JSON.stringify({
        businessName: 'UAT Fresh Mart Private Limited',
        brandName: 'FreshMart',
        gstNumber: '24AAACU1001A1Z1',
        address: { street: '101 Fresh Towers, SG Highway', city: 'Ahmedabad', state: 'Gujarat', pincode: '380054' },
      }),
    }, c1Token);

    await api('/company/documents', {
      method: 'POST',
      body: JSON.stringify({ type: 'GST_CERTIFICATE', uploadedFileId: c1Doc }),
    }, c1Token);

    await api('/company/consents', {
      method: 'POST',
      body: JSON.stringify({ termsAccepted: true, privacyAccepted: true }),
    }, c1Token);

    await api('/company/kyc/submit', { method: 'POST' }, c1Token);

    // Moderator Need-More-Info -> C1 resubmit -> Moderator Approve
    await api(`/admin/companies/${c1Id}/need-more-info`, {
      method: 'PATCH',
      body: JSON.stringify({ reasons: ['BLURRY_IMAGE'], customNotes: 'Please re-verify certificate' }),
    }, moderatorToken);

    await api('/company/kyc/submit', { method: 'POST' }, c1Token);

    await api(`/admin/companies/${c1Id}/claim`, { method: 'POST' }, moderatorToken);
    await api(`/admin/companies/${c1Id}/verify`, { method: 'PATCH' }, moderatorToken);

    state.companies['C1'] = { id: c1Id, email: 'c1.owner@demo.autoposter.test', status: 'APPROVED' };
    saveState(state);
    console.log('✅ C1 (UAT Fresh Mart) KYC Approved.');
  }

  // C1 Team Members
  const c1Members = [
    { email: 'c1.manager@demo.autoposter.test', name: 'Manager' },
    { email: 'c1.finance@demo.autoposter.test', name: 'Finance' },
    { email: 'c1.viewer@demo.autoposter.test', name: 'Viewer' },
  ];
  for (const m of c1Members) {
    if (!state.companies[m.email]) {
      await api('/auth/company/register', {
        method: 'POST',
        body: JSON.stringify({
          email: m.email,
          password: uatPassword,
          companyName: 'UAT Fresh Mart Private Limited',
          brandName: 'FreshMart',
          contactPerson: `FreshMart ${m.name}`,
          mobile: `+91900000010${m.name.length}`,
        }),
      });
      state.companies[m.email] = { email: m.email, role: m.name.toUpperCase() };
      saveState(state);
      console.log(`✅ C1 Team Member ${m.name} provisioned.`);
    }
  }

  // C2: UAT Tasty Bites
  if (!state.companies['C2']?.id) {
    console.log('Registering C2: UAT Tasty Bites...');
    const regC2 = await api('/auth/company/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'c2.owner@demo.autoposter.test',
        password: uatPassword,
        companyName: 'UAT Tasty Bites Foods',
        brandName: 'TastyBites',
        contactPerson: 'Anjali Sharma',
        mobile: '+919000000102',
      }),
    });
    const loginC2 = await api('/auth/company/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'c2.owner@demo.autoposter.test', password: uatPassword }),
    });
    const c2Token = loginC2.body.data.accessToken;
    const c2Id = loginC2.body.data.user.id;

    const c2Doc = await uploadFileHelper(c2Token, 'KYC_DOCUMENT', samplePosterFixture, 'image/png', 'gst_tasty.png');
    await api('/company/profile', {
      method: 'PUT',
      body: JSON.stringify({
        businessName: 'UAT Tasty Bites Foods',
        brandName: 'TastyBites',
        gstNumber: '24AAACT2002A1Z2',
        address: { street: 'Food Park, Bodakdev', city: 'Ahmedabad', state: 'Gujarat', pincode: '380054' },
      }),
    }, c2Token);
    await api('/company/documents', {
      method: 'POST',
      body: JSON.stringify({ type: 'GST_CERTIFICATE', uploadedFileId: c2Doc }),
    }, c2Token);
    await api('/company/consents', {
      method: 'POST',
      body: JSON.stringify({ termsAccepted: true, privacyAccepted: true }),
    }, c2Token);
    await api('/company/kyc/submit', { method: 'POST' }, c2Token);

    await api(`/admin/companies/${c2Id}/need-more-info`, {
      method: 'PATCH',
      body: JSON.stringify({ reasons: ['BLURRY_IMAGE'], customNotes: 'Clear address proof required' }),
    }, moderatorToken);
    await api('/company/kyc/submit', { method: 'POST' }, c2Token);
    await api(`/admin/companies/${c2Id}/claim`, { method: 'POST' }, moderatorToken);
    await api(`/admin/companies/${c2Id}/verify`, { method: 'PATCH' }, moderatorToken);

    state.companies['C2'] = { id: c2Id, email: 'c2.owner@demo.autoposter.test', status: 'APPROVED' };
    saveState(state);
    console.log('✅ C2 (UAT Tasty Bites) KYC Approved after Need-More-Info.');
  }

  // C3: UAT Quick Clinic (Left Rejected)
  if (!state.companies['C3']?.id) {
    console.log('Registering C3: UAT Quick Clinic (Target: Left Rejected)...');
    await api('/auth/company/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'c3.owner@demo.autoposter.test',
        password: uatPassword,
        companyName: 'UAT Quick Clinic Healthcare',
        brandName: 'QuickClinic',
        contactPerson: 'Dr. Suresh Mehta',
        mobile: '+919000000103',
      }),
    });
    const loginC3 = await api('/auth/company/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'c3.owner@demo.autoposter.test', password: uatPassword }),
    });
    const c3Token = loginC3.body.data.accessToken;
    const c3Id = loginC3.body.data.user.id;

    await api('/company/profile', {
      method: 'PUT',
      body: JSON.stringify({
        businessName: 'UAT Quick Clinic Healthcare',
        brandName: 'QuickClinic',
        address: { street: 'Medical Enclave, SG Highway', city: 'Ahmedabad', state: 'Gujarat', pincode: '380054' },
      }),
    }, c3Token);
    await api('/company/kyc/submit', { method: 'POST' }, c3Token);

    await api(`/admin/companies/${c3Id}/claim`, { method: 'POST' }, moderatorToken);
    await api(`/admin/companies/${c3Id}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ reasons: ['INVALID_REGISTRATION_DOC'], customNotes: 'Clinical establishment registration document missing' }),
    }, moderatorToken);

    state.companies['C3'] = { id: c3Id, email: 'c3.owner@demo.autoposter.test', status: 'REJECTED' };
    saveState(state);
    console.log('✅ C3 (UAT Quick Clinic) KYC Rejected with reason codes (Left Rejected).');
  }

  // C4: UAT New Co (Registered Only)
  if (!state.companies['C4']?.id) {
    console.log('Registering C4: UAT New Co (Target: Registered Only)...');
    const regC4 = await api('/auth/company/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'c4.owner@demo.autoposter.test',
        password: uatPassword,
        companyName: 'UAT New Co Global',
        brandName: 'NewCo',
        contactPerson: 'Pooja Shah',
        mobile: '+919000000104',
      }),
    });
    state.companies['C4'] = { email: 'c4.owner@demo.autoposter.test', status: 'REGISTERED_ONLY' };
    saveState(state);
    console.log('✅ C4 (UAT New Co) Registered only (Onboarding Not Started).');
  }

  // ============================================================================
  // PHASE 2: CAMPAIGNS (A1, A2, A3, B1, B2)
  // ============================================================================
  console.log('\n--- PHASE 2: CAMPAIGNS & ESCROW FUNDING ---');
  // Re-login C1
  const loginC1 = await api('/auth/company/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'c1.owner@demo.autoposter.test', password: uatPassword }),
  });
  c1Token = loginC1.body.data.accessToken;

  const todayStr = new Date().toISOString().split('T')[0]!;
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0]!;
  const fifteenDaysStr = new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0]!;

  const posterA1 = await uploadFileHelper(c1Token, 'CAMPAIGN_POSTER', samplePosterFixture, 'image/png', 'poster_a1.png');

  // Campaign A1: 1 Day, 3 Slots, sgZoneId
  if (!state.campaigns['A1']?.id) {
    console.log('Creating Campaign A1 (1 day, 3 slots)...');
    const a1Res = await api('/company/campaigns', {
      method: 'POST',
      body: JSON.stringify({
        title: 'UAT Fresh Mart Flash Sale (A1)',
        cityId: ahmedabadId,
        zoneIds: [sgZoneId],
        startDate: todayStr,
        endDate: tomorrowStr,
        slots: 3,
        rentPer30DaysPaise: 100000,
        printingAllowancePaise: 15000,
        posterFileId: posterA1,
      }),
    }, c1Token);
    const a1Id = a1Res.body.data.id;

    await api(`/company/campaigns/${a1Id}/submit`, { method: 'POST' }, c1Token);
    await api(`/admin/campaigns/${a1Id}/claim`, { method: 'POST' }, moderatorToken);
    await api(`/admin/campaigns/${a1Id}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision: 'APPROVED', note: 'A1 approved for flash pilot' }),
    }, moderatorToken);

    // Pay A1
    const orderRes = await api(`/company/campaigns/${a1Id}/payment/order`, { method: 'POST' }, c1Token);
    const { gatewayOrderId, amountPaise } = orderRes.body.data;
    const webhookPayload = JSON.stringify({
      id: `evt_a1_${Date.now()}`,
      event: 'payment.captured',
      payload: { payment: { entity: { id: `pay_a1_${Date.now()}`, order_id: gatewayOrderId, amount: amountPaise, currency: 'INR', status: 'captured' } } },
    });
    await api('/webhooks/razorpay', {
      method: 'POST',
      headers: { 'x-razorpay-signature': 'dev_mock_signature' },
      body: webhookPayload,
    });

    state.campaigns['A1'] = { id: a1Id, title: 'UAT Fresh Mart Flash Sale (A1)', status: 'RUNNING' };
    saveState(state);
    console.log(`✅ Campaign A1 (${a1Id}) Paid & Live in escrow.`);
  }

  // Campaign A2: 15 Days, 5 Slots
  if (!state.campaigns['A2']?.id) {
    console.log('Creating Campaign A2 (15 days, 5 slots)...');
    const a2Res = await api('/company/campaigns', {
      method: 'POST',
      body: JSON.stringify({
        title: 'UAT Fresh Mart Mega Brand (A2)',
        cityId: ahmedabadId,
        zoneIds: [sgZoneId],
        startDate: todayStr,
        endDate: fifteenDaysStr,
        slots: 5,
        rentPer30DaysPaise: 100000,
        printingAllowancePaise: 15000,
        posterFileId: posterA1,
      }),
    }, c1Token);
    const a2Id = a2Res.body.data.id;

    await api(`/company/campaigns/${a2Id}/submit`, { method: 'POST' }, c1Token);
    await api(`/admin/campaigns/${a2Id}/claim`, { method: 'POST' }, moderatorToken);
    await api(`/admin/campaigns/${a2Id}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision: 'APPROVED', note: 'A2 approved for brand launch' }),
    }, moderatorToken);

    const orderRes = await api(`/company/campaigns/${a2Id}/payment/order`, { method: 'POST' }, c1Token);
    const { gatewayOrderId, amountPaise } = orderRes.body.data;
    const webhookPayload = JSON.stringify({
      id: `evt_a2_${Date.now()}`,
      event: 'payment.captured',
      payload: { payment: { entity: { id: `pay_a2_${Date.now()}`, order_id: gatewayOrderId, amount: amountPaise, currency: 'INR', status: 'captured' } } },
    });
    await api('/webhooks/razorpay', {
      method: 'POST',
      headers: { 'x-razorpay-signature': 'dev_mock_signature' },
      body: webhookPayload,
    });

    state.campaigns['A2'] = { id: a2Id, title: 'UAT Fresh Mart Mega Brand (A2)', status: 'RUNNING' };
    saveState(state);
    console.log(`✅ Campaign A2 (${a2Id}) Paid & Live in escrow.`);
  }

  // Campaign A3: 2 Slots (Cancelled with Escrow Refund)
  if (!state.campaigns['A3']?.id) {
    console.log('Creating Campaign A3 (Target: Cancelled & Refunded)...');
    const a3Res = await api('/company/campaigns', {
      method: 'POST',
      body: JSON.stringify({
        title: 'UAT Fresh Mart Cancel Test (A3)',
        cityId: ahmedabadId,
        zoneIds: [sgZoneId],
        startDate: todayStr,
        endDate: fifteenDaysStr,
        slots: 2,
        rentPer30DaysPaise: 100000,
        printingAllowancePaise: 15000,
        posterFileId: posterA1,
      }),
    }, c1Token);
    const a3Id = a3Res.body.data.id;

    await api(`/company/campaigns/${a3Id}/submit`, { method: 'POST' }, c1Token);
    await api(`/admin/campaigns/${a3Id}/claim`, { method: 'POST' }, moderatorToken);
    await api(`/admin/campaigns/${a3Id}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision: 'APPROVED', note: 'A3 approved' }),
    }, moderatorToken);

    const orderRes = await api(`/company/campaigns/${a3Id}/payment/order`, { method: 'POST' }, c1Token);
    const { gatewayOrderId, amountPaise } = orderRes.body.data;
    const webhookPayload = JSON.stringify({
      id: `evt_a3_${Date.now()}`,
      event: 'payment.captured',
      payload: { payment: { entity: { id: `pay_a3_${Date.now()}`, order_id: gatewayOrderId, amount: amountPaise, currency: 'INR', status: 'captured' } } },
    });
    await api('/webhooks/razorpay', {
      method: 'POST',
      headers: { 'x-razorpay-signature': 'dev_mock_signature' },
      body: webhookPayload,
    });

    // C1 cancels A3 -> Escrow refunded
    await api(`/company/campaigns/${a3Id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Marketing budget reallocated to SG Highway A2' }),
    }, c1Token);

    state.campaigns['A3'] = { id: a3Id, title: 'UAT Fresh Mart Cancel Test (A3)', status: 'CANCELLED_REFUNDED' };
    saveState(state);
    console.log(`✅ Campaign A3 (${a3Id}) Cancelled and Escrow Refunded.`);
  }

  // C2 Campaigns B1 and B2
  const loginC2 = await api('/auth/company/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'c2.owner@demo.autoposter.test', password: uatPassword }),
  });
  const c2Token = loginC2.body.data.accessToken;

  if (!state.campaigns['B1']?.id) {
    console.log('Creating Campaign B1 for C2 (Reject -> Edit -> Approve -> Awaiting Payment)...');
    const posterB1 = await uploadFileHelper(c2Token, 'CAMPAIGN_POSTER', samplePosterFixture, 'image/png', 'poster_b1.png');
    const b1Res = await api('/company/campaigns', {
      method: 'POST',
      body: JSON.stringify({
        title: 'UAT Tasty Bites Breakfast Combo (B1)',
        cityId: ahmedabadId,
        zoneIds: [sgZoneId],
        startDate: todayStr,
        endDate: fifteenDaysStr,
        slots: 3,
        rentPer30DaysPaise: 100000,
        printingAllowancePaise: 15000,
        posterFileId: posterB1,
      }),
    }, c2Token);
    const b1Id = b1Res.body.data.id;

    await api(`/company/campaigns/${b1Id}/submit`, { method: 'POST' }, c2Token);
    await api(`/admin/campaigns/${b1Id}/claim`, { method: 'POST' }, moderatorToken);
    await api(`/admin/campaigns/${b1Id}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision: 'REJECTED', reasons: [{ code: 'POSTER_CONTENT_POLICY', customNote: 'Breakfast pricing font too small' }] }),
    }, moderatorToken);

    await api(`/company/campaigns/${b1Id}/reopen`, { method: 'POST' }, c2Token);
    await api(`/company/campaigns/${b1Id}/submit`, { method: 'POST' }, c2Token);
    await api(`/admin/campaigns/${b1Id}/claim`, { method: 'POST' }, moderatorToken);
    await api(`/admin/campaigns/${b1Id}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision: 'APPROVED', note: 'Price font size corrected' }),
    }, moderatorToken);

    state.campaigns['B1'] = { id: b1Id, title: 'UAT Tasty Bites Breakfast Combo (B1)', status: 'APPROVED_AWAITING_PAYMENT' };
    saveState(state);
    console.log(`✅ Campaign B1 (${b1Id}) Approved (Awaiting Payment).`);
  }

  if (!state.campaigns['B2']?.id) {
    console.log('Creating Campaign B2 for C2 (Draft)...');
    const posterB2 = await uploadFileHelper(c2Token, 'CAMPAIGN_POSTER', samplePosterFixture, 'image/png', 'poster_b2.png');
    const b2Res = await api('/company/campaigns', {
      method: 'POST',
      body: JSON.stringify({
        title: 'UAT Tasty Bites Late Night Munchies (B2)',
        cityId: ahmedabadId,
        zoneIds: [sgZoneId],
        startDate: todayStr,
        endDate: fifteenDaysStr,
        slots: 4,
        rentPer30DaysPaise: 100000,
        printingAllowancePaise: 15000,
        posterFileId: posterB2,
      }),
    }, c2Token);
    state.campaigns['B2'] = { id: b2Res.body.data.id, title: 'UAT Tasty Bites Late Night Munchies (B2)', status: 'DRAFT' };
    saveState(state);
    console.log(`✅ Campaign B2 Draft created.`);
  }

  // ============================================================================
  // PHASE 3: DRIVERS (D1 - D10)
  // ============================================================================
  console.log('\n--- PHASE 3: DRIVER ONBOARDING & ENROLLMENT ---');
  const driverDefs = [
    { code: 'D1', mobile: '+919000000001', name: 'UAT Driver 01 (D1)', vehPlate: 'GJ01UA1001', target: 'ENROLLED_A2_VERIFIED' },
    { code: 'D2', mobile: '+919000000002', name: 'UAT Driver 02 (D2)', vehPlate: 'GJ01UA1002', target: 'ENROLLED_A2_MANUAL_REVIEW' },
    { code: 'D3', mobile: '+919000000003', name: 'UAT Driver 03 (D3)', vehPlate: 'GJ01UA1003', target: 'ENROLLED_A1_INSTALL_PENDING' },
    { code: 'D4', mobile: '+919000000004', name: 'UAT Driver 04 (D4)', vehPlate: 'GJ01UA1004', target: 'ENROLLED_A1_RUNNING' },
    { code: 'D5', mobile: '+919000000005', name: 'UAT Driver 05 (D5)', vehPlate: 'GJ01UA1005', target: 'NEED_MORE_INFO' },
    { code: 'D6', mobile: '+919000000006', name: 'UAT Driver 06 (D6)', vehPlate: 'GJ01UA1006', target: 'PENDING_INITIAL' },
    { code: 'D7', mobile: '+919000000007', name: 'UAT Driver 07 (D7)', vehPlate: 'GJ01UA1007', target: 'REGISTERED_ONLY' },
    { code: 'D8', mobile: '+919000000008', name: 'UAT Driver 08 (D8)', vehPlate: 'GJ01UA1008', target: 'ENROLLED_A2_DISPUTE' },
    { code: 'D9', mobile: '+919000000009', name: 'UAT Driver 09 (D9)', vehPlate: 'GJ01UA1009', target: 'ENROLLED_A2_STRIKE' },
    { code: 'D10', mobile: '+919000000010', name: 'UAT Driver 10 (D10)', vehPlate: 'GJ01UA1010', target: 'RELEASED_RESERVATION' },
  ];

  for (const d of driverDefs) {
    if (!state.drivers[d.code]?.id) {
      console.log(`Registering ${d.code} (${d.mobile})...`);
      await api('/auth/driver/register', {
        method: 'POST',
        body: JSON.stringify({ mobile: d.mobile, password: uatPassword }),
      });

      const dLogin = await api('/auth/driver/login', {
        method: 'POST',
        body: JSON.stringify({ mobile: d.mobile, password: uatPassword }),
      });
      const dToken = dLogin.body.data.accessToken;
      const dId = dLogin.body.data.user.id;

      if (d.target !== 'REGISTERED_ONLY') {
        await api('/driver/profile', {
          method: 'PUT',
          body: JSON.stringify({ fullName: d.name, cityId: ahmedabadId, primaryZoneId: sgZoneId }),
        }, dToken);

        await api('/driver/vehicle', {
          method: 'PUT',
          body: JSON.stringify({ registrationNumber: d.vehPlate, isVehicleOwner: true }),
        }, dToken);

        const dlId = await uploadFileHelper(dToken, 'KYC_DOCUMENT', samplePosterFixture, 'image/png', `dl_${d.code}.png`);
        await api('/driver/documents', {
          method: 'POST',
          body: JSON.stringify({ type: 'DRIVING_LICENCE', uploadedFileId: dlId }),
        }, dToken);

        await api('/driver/consents', {
          method: 'POST',
          body: JSON.stringify({ termsAccepted: true, privacyAccepted: true }),
        }, dToken);

        await api('/driver/kyc/submit', { method: 'POST' }, dToken);

        if (d.target === 'NEED_MORE_INFO') {
          await api(`/admin/drivers/${dId}/need-more-info`, {
            method: 'PATCH',
            body: JSON.stringify({ reasons: ['BLURRY_IMAGE'], customNotes: 'Please re-upload driving licence clearly' }),
          }, moderatorToken);
        } else if (d.target !== 'PENDING_INITIAL') {
          await api(`/admin/drivers/${dId}/claim`, { method: 'POST' }, moderatorToken);
          await api(`/admin/drivers/${dId}/verify`, { method: 'PATCH' }, moderatorToken);
        }
      }

      state.drivers[d.code] = { id: dId, mobile: d.mobile, name: d.name, token: dToken, target: d.target };
      saveState(state);
      console.log(`✅ ${d.code} (${d.name}) registered in target state [${d.target}].`);
    }
  }

  // Reserve slots on A2 (D1, D2, D8, D9, D10) & A1 (D3, D4)
  const a1Id = state.campaigns['A1'].id;
  const a2Id = state.campaigns['A2'].id;

  const a2Drivers = ['D1', 'D2', 'D8', 'D9', 'D10'];
  for (const code of a2Drivers) {
    if (!state.assignments[`${code}_A2`]) {
      const dLogin = await api('/auth/driver/login', {
        method: 'POST',
        body: JSON.stringify({ mobile: state.drivers[code].mobile, password: uatPassword }),
      });
      const dToken = dLogin.body.data.accessToken;
      const resv = await api(`/driver/campaigns/${a2Id}/reserve`, { method: 'POST' }, dToken);
      if (resv.ok) {
        state.assignments[`${code}_A2`] = { assignmentId: resv.body.data.id || resv.body.data.assignmentId, campaignId: a2Id };
        saveState(state);
        console.log(`✅ ${code} reserved slot on Campaign A2.`);
      }
    }
  }

  const a1Drivers = ['D3', 'D4'];
  for (const code of a1Drivers) {
    if (!state.assignments[`${code}_A1`]) {
      const dLogin = await api('/auth/driver/login', {
        method: 'POST',
        body: JSON.stringify({ mobile: state.drivers[code].mobile, password: uatPassword }),
      });
      const dToken = dLogin.body.data.accessToken;
      const resv = await api(`/driver/campaigns/${a1Id}/reserve`, { method: 'POST' }, dToken);
      if (resv.ok) {
        state.assignments[`${code}_A1`] = { assignmentId: resv.body.data.id || resv.body.data.assignmentId, campaignId: a1Id };
        saveState(state);
        console.log(`✅ ${code} reserved slot on Campaign A1.`);
      }
    }
  }

  // D10 voluntarily releases reservation on A2
  if (state.assignments['D10_A2'] && !state.assignments['D10_A2'].released) {
    const d10Login = await api('/auth/driver/login', {
      method: 'POST',
      body: JSON.stringify({ mobile: state.drivers['D10'].mobile, password: uatPassword }),
    });
    const d10Token = d10Login.body.data.accessToken;
    const asgId = state.assignments['D10_A2'].assignmentId;
    await api(`/driver/assignments/${asgId}/release-reservation`, { method: 'POST' }, d10Token);
    state.assignments['D10_A2'].released = true;
    saveState(state);
    console.log('✅ D10 voluntarily released reservation on A2 (Slot restored).');
  }

  // ============================================================================
  // PHASE 4: INSTALLATIONS, DAILY PROOFS, DISPUTES & STRIKES
  // ============================================================================
  console.log('\n--- PHASE 4: INSTALLATIONS, DAILY PROOFS & ENFORCEMENT ---');

  // Submit installations for D1, D2, D3, D4, D8, D9
  const installDrivers = [
    { code: 'D1', asgKey: 'D1_A2' },
    { code: 'D2', asgKey: 'D2_A2' },
    { code: 'D3', asgKey: 'D3_A1' },
    { code: 'D4', asgKey: 'D4_A1' },
    { code: 'D8', asgKey: 'D8_A2' },
    { code: 'D9', asgKey: 'D9_A2' },
  ];

  for (const item of installDrivers) {
    const asg = state.assignments[item.asgKey];
    if (asg && !asg.installed) {
      const dLogin = await api('/auth/driver/login', {
        method: 'POST',
        body: JSON.stringify({ mobile: state.drivers[item.code].mobile, password: uatPassword }),
      });
      const dToken = dLogin.body.data.accessToken;

      const instBuf = await createTestImage(100, 150, 200);
      const instFileId = await uploadFileHelper(dToken, 'INSTALLATION_PHOTO', instBuf, 'image/png', `inst_${item.code}.png`);

      await api(`/driver/assignments/${asg.assignmentId}/installation`, {
        method: 'POST',
        body: JSON.stringify({
          uploadedFileId: instFileId,
          latitude: 23.0338,
          longitude: 72.5073,
          accuracyMeters: 10,
          capturedAt: new Date().toISOString(),
          isMockLocation: false,
        }),
      }, dToken);
      asg.installed = true;
      saveState(state);
      console.log(`✅ Installation photo submitted for ${item.code}.`);
    }
  }

  // Moderator approves D1, D4
  for (const item of [{ code: 'D1', asgKey: 'D1_A2' }, { code: 'D4', asgKey: 'D4_A1' }]) {
    const asg = state.assignments[item.asgKey];
    if (asg && !asg.approved) {
      await api(`/admin/installations/${asg.assignmentId}/claim`, { method: 'POST' }, moderatorToken);
      await api(`/admin/installations/${asg.assignmentId}/decision`, {
        method: 'POST',
        body: JSON.stringify({ decision: 'APPROVED', note: 'Installation sticker clean and confirmed' }),
      }, moderatorToken);
      asg.approved = true;
      saveState(state);
      console.log(`✅ Moderator approved installation for ${item.code}.`);
    }
  }

  // D2: Installation Rejected -> Retake -> Approved
  const d2Asg = state.assignments['D2_A2'];
  if (d2Asg && !d2Asg.approved) {
    await api(`/admin/installations/${d2Asg.assignmentId}/claim`, { method: 'POST' }, moderatorToken);
    await api(`/admin/installations/${d2Asg.assignmentId}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision: 'REJECTED', note: 'Wrinkles on auto hood poster, retake photo' }),
    }, moderatorToken);

    // Retake
    const d2Login = await api('/auth/driver/login', {
      method: 'POST',
      body: JSON.stringify({ mobile: state.drivers['D2'].mobile, password: uatPassword }),
    });
    const d2Token = d2Login.body.data.accessToken;
    const retakeBuf = await createTestImage(120, 160, 220);
    const retakeFileId = await uploadFileHelper(d2Token, 'INSTALLATION_PHOTO', retakeBuf, 'image/png', 'd2_retake.png');
    await api(`/driver/assignments/${d2Asg.assignmentId}/installation`, {
      method: 'POST',
      body: JSON.stringify({
        uploadedFileId: retakeFileId,
        latitude: 23.0338,
        longitude: 72.5073,
        accuracyMeters: 10,
        capturedAt: new Date().toISOString(),
        isMockLocation: false,
      }),
    }, d2Token);

    await api(`/admin/installations/${d2Asg.assignmentId}/claim`, { method: 'POST' }, moderatorToken);
    await api(`/admin/installations/${d2Asg.assignmentId}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision: 'APPROVED', note: 'Retake photo approved' }),
    }, moderatorToken);
    d2Asg.approved = true;
    saveState(state);
    console.log('✅ D2 installation retake approved.');
  }

  // D1 & D4 submit clean daily photo today -> Auto-Verified
  for (const item of [{ code: 'D1', asgKey: 'D1_A2' }, { code: 'D4', asgKey: 'D4_A1' }]) {
    const asg = state.assignments[item.asgKey];
    if (asg && !state.photos[`${item.code}_today`]) {
      const dLogin = await api('/auth/driver/login', {
        method: 'POST',
        body: JSON.stringify({ mobile: state.drivers[item.code].mobile, password: uatPassword }),
      });
      const dToken = dLogin.body.data.accessToken;

      const pBuf = await createTestImage(240, 180, 70);
      const pFileId = await uploadFileHelper(dToken, 'DAILY_PHOTO', pBuf, 'image/png', `${item.code}_daily.png`);

      const photoRes = await api(`/driver/assignments/${asg.assignmentId}/daily-photos`, {
        method: 'POST',
        body: JSON.stringify({
          uploadedFileId: pFileId,
          latitude: 23.0338,
          longitude: 72.5073,
          accuracyMeters: 10,
          capturedAt: new Date().toISOString(),
          isMockLocation: false,
        }),
      }, dToken);
      state.photos[`${item.code}_today`] = { id: photoRes.body.data.id || photoRes.body.data.photoId, status: 'VERIFIED' };
      saveState(state);
      console.log(`✅ ${item.code} Daily Photo submitted & auto-verified.`);
    }
  }

  // C1 flags D1's photo
  if (state.photos['D1_today'] && !state.flags['D1_photo_flag']) {
    const pId = state.photos['D1_today'].id;
    const flagRes = await api(`/company/campaigns/${a2Id}/photos/${pId}/flag`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'POSTER_NOT_VISIBLE', note: 'Glare on right section' }),
    }, c1Token);
    state.flags['D1_photo_flag'] = { id: flagRes.body.data.flagId || flagRes.body.data.id };
    saveState(state);
    console.log("✅ C1 flagged D1's daily photo.");

    // Moderator reviews flagged photo
    await api(`/admin/daily-photos/${pId}/claim`, { method: 'POST' }, moderatorToken);
    await api(`/admin/daily-photos/${pId}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision: 'APPROVE', note: 'Glare minimal, poster clearly identifiable' }),
    }, moderatorToken);
    console.log('✅ Moderator resolved company flag in favor of verified photo.');
  }

  // D9 submits duplicate photo -> Admin issues Strike 1
  if (state.assignments['D9_A2'] && !state.strikes['D9']) {
    const d9Id = state.drivers['D9'].id;
    const asgId = state.assignments['D9_A2'].assignmentId;
    const strikeRes = await api('/admin/discipline/strikes', {
      method: 'POST',
      body: JSON.stringify({
        driverId: d9Id,
        assignmentId: asgId,
        reason: 'FAKE_OR_OLD_PHOTO',
        note: 'Submitted reused installation photo for daily proof',
      }),
    }, moderatorToken);
    state.strikes['D9'] = { id: strikeRes.body.data.id || strikeRes.body.data.strikeId };
    saveState(state);
    console.log('✅ Moderator issued Strike 1 to D9 for reused proof.');
  }

  // D8 files dispute on rejected photo with evidence
  if (state.assignments['D8_A2'] && !state.disputes['D8']) {
    const d8Login = await api('/auth/driver/login', {
      method: 'POST',
      body: JSON.stringify({ mobile: state.drivers['D8'].mobile, password: uatPassword }),
    });
    const d8Token = d8Login.body.data.accessToken;
    const asgId = state.assignments['D8_A2'].assignmentId;

    const dispRes = await api('/driver/disputes', {
      method: 'POST',
      body: JSON.stringify({
        assignmentId: asgId,
        reason: 'PHOTO_WRONGLY_REJECTED',
        description: 'Photo taken at designated SG Highway petrol pump under direct sunlight',
      }),
    }, d8Token);
    state.disputes['D8'] = { id: dispRes.body.data.id };
    saveState(state);
    console.log('✅ D8 filed dispute with photo evidence (Target: Left under review).');
  }

  console.log('\n================================================================');
  console.log('🎉 AG-6 WALKTHROUGH DAY 1 COMPLETED SUCCESSFULLY!');
  console.log('================================================================');
  console.log(`📁 State safely recorded in: ${STATE_PATH}`);
}

main().catch((err) => {
  console.error('\n❌ Walkthrough Day 1 failed with error:', err);
  process.exit(1);
});
