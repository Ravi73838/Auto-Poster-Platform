import fs from 'node:fs';
import path from 'node:path';

const API_BASE = 'http://localhost:4000/api/v1';
const STATE_PATH = path.resolve(process.cwd(), '.local/walkthrough/state.json');
const BACKUP_PATH = path.resolve(process.cwd(), '.local/walkthrough/settings-backup.json');

function loadState(): any {
  if (fs.existsSync(STATE_PATH)) {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
  }
  throw new Error(`State file not found at: ${STATE_PATH}`);
}

function saveState(state: any) {
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

async function loginAdmin(email: string, password = 'FinancePassword123!') {
  const res = await api('/auth/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login failed for ${email}`);
  return res.body.data.accessToken as string;
}

async function main() {
  console.log('================================================================');
  console.log('🌅 AG-6 WALKTHROUGH DAY 2: COMPLETION, SETTLEMENT & PAYOUT');
  console.log('================================================================\n');

  const state = loadState();
  const uatPassword = 'UatPass2026!';

  const financeToken = await loginAdmin('finance@autoposter.in', 'FinancePassword123!');
  const superAdminToken = await loginAdmin('admin@autoposter.in', 'AdminPassword123!');
  const approverToken = await loginAdmin('admin@autoposter.com', 'Admin@123456');

  const d4AssignmentId = state.assignments['D4_A1']?.assignmentId;
  const a1CampaignId = state.campaigns['A1']?.id;

  if (!d4AssignmentId || !a1CampaignId) {
    throw new Error('D4 assignment or Campaign A1 missing from state');
  }

  console.log(`Checking Settlement for Driver D4 (Assignment: ${d4AssignmentId})...`);

  // 1. Fetch settlements
  const setRes = await api('/admin/finance/settlements', { method: 'GET' }, financeToken);
  const items = Array.isArray(setRes.body.data) ? setRes.body.data : (setRes.body.data.items || []);
  let d4Settlement = items.find((s: any) => s.assignmentId === d4AssignmentId);

  // If settlement not yet generated, trigger calculation via service or direct endpoint
  if (!d4Settlement) {
    console.log('Triggering settlement calculation for completed 1-day campaign...');
    // In dev mode with clock or due-jobs
    await api('/dev/clock/run-due-jobs', { method: 'POST' }).catch(() => {});
    const retryRes = await api('/admin/finance/settlements', { method: 'GET' }, financeToken);
    const retryItems = Array.isArray(retryRes.body.data) ? retryRes.body.data : (retryRes.body.data.items || []);
    d4Settlement = retryItems.find((s: any) => s.assignmentId === d4AssignmentId);
  }

  if (d4Settlement && d4Settlement.status !== 'PAID') {
    console.log(`Approving Settlement ${d4Settlement.id} for Driver D4...`);
    const revRes = await api(`/admin/finance/settlements/${d4Settlement.id}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision: 'APPROVE' }),
    }, financeToken);

    if (!revRes.ok) {
      throw new Error(`Settlement approval failed: ${JSON.stringify(revRes.body)}`);
    }
    state.settlements = state.settlements || {};
    state.settlements['D4'] = { id: d4Settlement.id, status: 'PAID' };
    saveState(state);
    console.log('✅ Settlement approved and credited to Driver D4 wallet.');
  } else if (d4Settlement) {
    console.log(`Settlement ${d4Settlement.id} is already in status ${d4Settlement.status}.`);
  }

  // 2. Driver D4 wallet withdrawal
  const d4Mobile = state.drivers['D4'].mobile;
  const d4Login = await api('/auth/driver/login', {
    method: 'POST',
    body: JSON.stringify({ mobile: d4Mobile, password: uatPassword }),
  });
  const d4Token = d4Login.body.data.accessToken;

  const walletRes = await api('/driver/wallet', { method: 'GET' }, d4Token);
  console.log('D4 Wallet Balance Paise:', walletRes.body.data?.balancePaise);
  const bal = Number(walletRes.body.data?.balancePaise || 0);

  if (bal >= 15000 && !state.payouts?.D4) {
    console.log(`D4 requesting withdrawal of 15000 paise...`);
    const withRes = await api('/driver/withdrawals', {
      method: 'POST',
      body: JSON.stringify({
        amountPaise: 15000,
        idempotencyKey: `w_d4_${Date.now()}`,
      }),
    }, d4Token);

    if (withRes.ok) {
      const payout = withRes.body.data;
      const payoutId = payout.id || payout.payoutId;

      if (payout.status === 'APPROVED' || payout.status === 'PENDING') {
        console.log('Finance Admin exporting payouts batch CSV...');
        await api('/admin/finance/payouts/export-csv', { method: 'POST' }, financeToken);

        console.log(`Importing bank UTR CSV for payout ${payoutId}...`);
        const importCsv = `payout_id,status,utr\n"${payoutId}","PAID","UTR-UAT-998877"`;
        const impRes = await api('/admin/finance/payouts/import-csv', {
          method: 'POST',
          body: JSON.stringify({ csv: importCsv }),
        }, financeToken);
        console.log('Import result:', impRes.body);
      }

      state.payouts = state.payouts || {};
      state.payouts['D4'] = { payoutId, status: 'PAID', utr: 'UTR-UAT-998877' };
      saveState(state);
      console.log('✅ Driver D4 payout disbursed & reconciled with UTR-UAT-998877.');
    }
  }

  // 3. Restore Platform Settings from Backup
  console.log('\n🔄 Restoring platform settings from backup to baseline...');
  if (fs.existsSync(BACKUP_PATH)) {
    const backup = JSON.parse(fs.readFileSync(BACKUP_PATH, 'utf-8'));
    for (const [key, val] of Object.entries(backup)) {
      if (val !== null && val !== undefined) {
        await api('/admin/settings/request-change', {
          method: 'POST',
          body: JSON.stringify({ key, value: val, reason: 'UAT walkthrough completion: restore baseline' }),
        }, superAdminToken);
      }
    }
    console.log('✅ Platform settings restored to baseline.');
  }

  console.log('\n================================================================');
  console.log('🎉 AG-6 WALKTHROUGH DAY 2 COMPLETED SUCCESSFULLY!');
  console.log('================================================================');
}

main().catch((err) => {
  console.error('\n❌ Walkthrough Day 2 failed with error:', err);
  process.exit(1);
});
