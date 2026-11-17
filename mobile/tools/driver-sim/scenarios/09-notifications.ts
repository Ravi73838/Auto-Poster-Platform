import type { SimulatorContext } from '../harness';
import { resolveDeepLink } from '../../../src/navigation/deepLinks';

export async function runNotificationsScenario(
  ctx: SimulatorContext,
  driverAuth: { driverUserId: string; driverToken: string },
): Promise<void> {
  const { client, testPrisma } = ctx;
  (client as any).setTokens({ accessToken: driverAuth.driverToken, refreshToken: null });

  // 1. Seed two test notifications for driver in test schema
  const n1 = await testPrisma.notification.create({
    data: {
      userId: driverAuth.driverUserId,
      title: 'Daily Verification Approved',
      body: 'Your photo for today has been verified. ₹250 has been credited to your wallet.',
      category: 'MONEY',
      channel: 'IN_APP',
      data: { screen: 'WALLET' },
    },
  });

  const n2 = await testPrisma.notification.create({
    data: {
      userId: driverAuth.driverUserId,
      title: 'New Campaign Available in Your City',
      body: 'Reserve your spot for the upcoming Ahmedabad Festival campaign.',
      category: 'CAMPAIGN_UPDATES',
      channel: 'IN_APP',
      data: { screen: 'CAMPAIGNS' },
    },
  });

  // 2. Fetch unread notifications count
  const unreadCount = await client.getUnreadNotificationsCount();
  if (unreadCount < 2) {
    throw new Error(`Expected at least 2 unread notifications, got: ${unreadCount}`);
  }

  // 3. List notifications
  const listRes = await client.listNotifications({ page: 1, pageSize: 20 });
  const items = Array.isArray(listRes) ? listRes : (listRes as any)?.items || (listRes as any)?.data || [];
  if (items.length < 2) {
    throw new Error(`Notifications list did not return seeded items (got ${items.length})`);
  }

  // 4. Mark single notification as read
  await client.markNotificationRead(n1.id);
  const updatedUnread = await client.getUnreadNotificationsCount();
  if (updatedUnread >= unreadCount) {
    throw new Error('Unread notifications count did not decrement after markNotificationRead');
  }

  // 5. Mark all as read
  await client.markAllNotificationsRead();
  const finalUnread = await client.getUnreadNotificationsCount();
  if (finalUnread !== 0) {
    throw new Error(`Expected 0 unread notifications after markAllNotificationsRead, got: ${finalUnread}`);
  }

  // 6. Test deep link mapping from notification payloads
  expectDeepLink(n1.data as any, '/(tabs)/wallet');
  expectDeepLink(n2.data as any, '/(tabs)/campaigns');

  // 7. Register device push notification token
  const deviceRes = await client.registerDeviceToken({
    token: 'ExponentPushToken[SIM_TEST_DRIVER_TOKEN_001]',
    platform: 'ANDROID',
    provider: 'EXPO',
  });
  if (!deviceRes || (!deviceRes.id && !deviceRes.token)) {
    throw new Error('Register device push token failed');
  }
}

function expectDeepLink(payload: any, expected: string): void {
  const actual = resolveDeepLink(payload);
  if (actual !== expected) {
    throw new Error(`Deep link mismatch for payload ${JSON.stringify(payload)}: expected ${expected}, got ${actual}`);
  }
}
