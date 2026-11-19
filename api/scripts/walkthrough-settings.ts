import fs from 'node:fs';
import path from 'node:path';

const API_BASE = 'http://localhost:4000/api/v1';
const BACKUP_PATH = path.resolve(process.cwd(), '.local/walkthrough/settings-backup.json');

async function api(path: string, options: RequestInit = {}, token?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const text = await res.text();
  try {
    return { status: res.status, ok: res.ok, body: JSON.parse(text) };
  } catch {
    return { status: res.status, ok: res.ok, body: text };
  }
}

async function loginAdmin(email: string, password = 'AdminPassword123!') {
  const res = await api('/auth/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(res.body)}`);
  }
  return res.body.data.accessToken as string;
}

export async function backupSettings(): Promise<Record<string, any>> {
  console.log('📦 Backing up platform settings before walkthrough compression...');
  const adminToken = await loginAdmin('admin@autoposter.in');
  const res = await api('/admin/settings', { method: 'GET' }, adminToken);
  if (!res.ok) {
    throw new Error(`Failed to list settings: ${JSON.stringify(res.body)}`);
  }

  const groups = res.body.data;
  const flatSettings: Record<string, any> = {};

  for (const cat of Object.keys(groups)) {
    for (const item of groups[cat]) {
      flatSettings[item.key] = item.effectiveValue ?? item.value ?? item.defaultValue;
    }
  }

  const targetKeys = [
    'min_lead_days',
    'min_campaign_days',
    'settlement_delay_days',
    'driver.daily_photo_late_grace_hours',
    'daily_photo_late_grace_hours',
  ];

  const backup: Record<string, any> = {};
  for (const key of targetKeys) {
    if (key in flatSettings) {
      backup[key] = flatSettings[key];
    }
  }

  // Ensure default fallback if not explicitly set
  if (backup['min_lead_days'] === undefined) backup['min_lead_days'] = 3;
  if (backup['min_campaign_days'] === undefined) backup['min_campaign_days'] = 15;
  if (backup['settlement_delay_days'] === undefined) backup['settlement_delay_days'] = 2;
  if (backup['driver.daily_photo_late_grace_hours'] === undefined) backup['driver.daily_photo_late_grace_hours'] = 12;

  fs.mkdirSync(path.dirname(BACKUP_PATH), { recursive: true });
  fs.writeFileSync(BACKUP_PATH, JSON.stringify(backup, null, 2), 'utf-8');
  console.log(`✅ Settings backup written to: ${BACKUP_PATH}`);
  console.table(backup);
  return backup;
}

export async function updateSetting(
  key: string,
  value: any,
  proposerToken: string,
  approverToken: string,
  reason: string,
) {
  console.log(`Setting [${key}] -> ${value}...`);
  const reqRes = await api('/admin/settings/request-change', {
    method: 'POST',
    body: JSON.stringify({ key, value, reason }),
  }, proposerToken);

  if (!reqRes.ok) {
    throw new Error(`Failed to request change for ${key}: ${JSON.stringify(reqRes.body)}`);
  }

  if (reqRes.body.data?.isPendingApproval) {
    const requestId = reqRes.body.data.requestId || reqRes.body.data.id;
    console.log(`  -> Sensitive setting requires maker-checker approval (Request ID: ${requestId})`);
    const revRes = await api(`/admin/settings/change-requests/${requestId}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision: 'APPROVE' }),
    }, approverToken);
    if (!revRes.ok) {
      throw new Error(`Approval failed for ${key} (Request ${requestId}): ${JSON.stringify(revRes.body)}`);
    }
    console.log(`  -> Approved by 2nd Super Admin.`);
  } else {
    console.log(`  -> Updated immediately.`);
  }
}

export async function compressSettings() {
  console.log('\n⚡ Compressing settings for walkthrough on public schema...');
  const proposerToken = await loginAdmin('admin@autoposter.in', 'AdminPassword123!');
  const approverToken = await loginAdmin('admin@autoposter.com', 'Admin@123456');

  await updateSetting('min_lead_days', 0, proposerToken, approverToken, 'UAT walkthrough: allow immediate campaign start');
  await updateSetting('min_campaign_days', 1, proposerToken, approverToken, 'UAT walkthrough: allow 1-day testing campaign');
  await updateSetting('settlement_delay_days', 0, proposerToken, approverToken, 'UAT walkthrough: allow immediate settlement after completion');
  try {
    await updateSetting('driver.daily_photo_late_grace_hours', 0, proposerToken, approverToken, 'UAT walkthrough: immediate daily cutoff');
  } catch {
    // Ignore if optional key
  }
  console.log('✅ Settings compression completed.\n');
}

export async function restoreSettings() {
  console.log('\n🔄 Restoring platform settings from backup...');
  if (!fs.existsSync(BACKUP_PATH)) {
    throw new Error(`Backup file not found at: ${BACKUP_PATH}`);
  }

  const backup = JSON.parse(fs.readFileSync(BACKUP_PATH, 'utf-8'));
  const proposerToken = await loginAdmin('admin@autoposter.in', 'AdminPassword123!');
  const approverToken = await loginAdmin('admin@autoposter.com', 'Admin@123456');

  for (const [key, val] of Object.entries(backup)) {
    if (val !== null && val !== undefined) {
      await updateSetting(key, val, proposerToken, approverToken, 'UAT walkthrough: restore baseline setting');
    }
  }
  console.log('✅ Settings restored to original baseline.\n');
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}`) {
  const mode = process.argv[2] || 'compress';
  if (mode === 'backup') {
    await backupSettings();
  } else if (mode === 'compress') {
    await backupSettings();
    await compressSettings();
  } else if (mode === 'restore') {
    await restoreSettings();
  }
}
