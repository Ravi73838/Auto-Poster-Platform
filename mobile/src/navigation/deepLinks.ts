export interface NotificationPayload {
  screen?: string;
  id?: string;
  assignmentId?: string;
  campaignId?: string;
  disputeId?: string;
  payoutId?: string;
  url?: string;
}

/**
 * Maps incoming notification payload or deep link URL to canonical Expo Router path.
 * Unknown or malformed targets fall back safely to /(tabs) (Home).
 */
export function resolveDeepLink(payload?: NotificationPayload | null): string {
  if (!payload || !payload.screen) {
    if (payload?.url && payload.url.startsWith('/')) {
      return payload.url;
    }
    return '/(tabs)';
  }

  const screen = payload.screen.trim().toUpperCase();
  const targetId =
    payload.id ||
    payload.assignmentId ||
    payload.campaignId ||
    payload.disputeId ||
    payload.payoutId;

  switch (screen) {
    case 'CAMPAIGN_DETAIL':
    case 'CAMPAIGN':
      return targetId ? `/campaigns/${targetId}` : '/(tabs)/campaigns';

    case 'CAMPAIGNS':
      return '/(tabs)/campaigns';

    case 'ASSIGNMENT_DETAIL':
    case 'ASSIGNMENT':
      return targetId ? `/assignments/${targetId}` : '/(tabs)';

    case 'INSTALLATION':
    case 'INSTALLATION_START':
      return targetId ? `/assignments/${targetId}/install` : '/(tabs)';

    case 'INSTALLATION_STATUS':
      return targetId ? `/assignments/${targetId}/install-status` : '/(tabs)';

    case 'DAILY_PHOTO':
    case 'DAILY_PROOF':
      return targetId ? `/assignments/${targetId}/daily-camera` : '/(tabs)';

    case 'CALENDAR':
    case 'DAYS':
      return targetId ? `/assignments/${targetId}/calendar` : '/(tabs)';

    case 'WALLET':
    case 'EARNINGS':
      return '/(tabs)/wallet';

    case 'PAYOUT':
    case 'PAYOUT_DETAIL':
      return '/wallet/payouts';

    case 'DISCIPLINE':
    case 'STRIKE':
    case 'POSTER_FIX':
      return '/discipline';

    case 'DISPUTE_DETAIL':
    case 'DISPUTE':
      return targetId ? `/disputes/${targetId}` : '/disputes';

    case 'DISPUTES':
      return '/disputes';

    case 'NOTIFICATIONS':
      return '/(tabs)/notifications';

    case 'UPLOAD_QUEUE':
      return '/upload-queue';

    case 'HELP':
      return targetId ? `/help/${targetId}` : '/help';

    case 'PROFILE':
      return '/(tabs)/profile';

    case 'HOME':
    default:
      return '/(tabs)';
  }
}

