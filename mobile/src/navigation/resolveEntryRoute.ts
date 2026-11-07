import type { AuthMeResponse } from '@ap/shared-types';
import { ACCOUNT_STATUS, type KycSubmissionStatus } from '@ap/shared-constants';

export interface AppConfig {
  minVersion?: string;
  latestVersion?: string;
  maintenance?: boolean;
  maintenanceMessage?: string;
  environment?: string;
}

export interface ResolveEntryRouteParams {
  isAuthenticated: boolean;
  hasChosenLanguage?: boolean;
  me?: AuthMeResponse | null;
  kycStatus?: KycSubmissionStatus | string | null;
  appConfig?: AppConfig | null;
  currentAppVersion?: string;
}

/**
 * Compare two semver strings (e.g. "1.0.2" < "1.1.0").
 * Returns true if current is strictly lower than minVersion.
 */
export function isVersionBelow(current?: string, minVersion?: string): boolean {
  if (!current || !minVersion) return false;
  const cParts = current.split('.').map((p) => parseInt(p, 10) || 0);
  const mParts = minVersion.split('.').map((p) => parseInt(p, 10) || 0);

  const len = Math.max(cParts.length, mParts.length);
  for (let i = 0; i < len; i++) {
    const c = cParts[i] ?? 0;
    const m = mParts[i] ?? 0;
    if (c < m) return true;
    if (c > m) return false;
  }
  return false;
}

/**
 * Pure function to resolve the entry route for the mobile app.
 * Used by root layout navigation gating.
 */
export function resolveEntryRoute(params: ResolveEntryRouteParams): string {
  const {
    isAuthenticated,
    hasChosenLanguage = true,
    me,
    kycStatus,
    appConfig,
    currentAppVersion = '0.1.0',
  } = params;

  // 1. Maintenance Mode has the highest priority
  if (appConfig?.maintenance) {
    return '/(public)/maintenance';
  }

  // 2. Minimum Version Enforcement (Hard Update)
  if (appConfig?.minVersion && isVersionBelow(currentAppVersion, appConfig.minVersion)) {
    return '/(public)/update-required';
  }

  // 3. First-launch language chooser
  if (!hasChosenLanguage) {
    return '/(public)/language';
  }

  // 4. Unauthenticated users go to login
  if (!isAuthenticated || !me?.user) {
    return '/(public)/login';
  }

  const user = me.user;

  // 5. Blocked users
  if (user.status === ACCOUNT_STATUS.BLOCKED) {
    return '/blocked';
  }

  // 6. Pending legal consents force the consent gate
  if (me.pendingConsents && me.pendingConsents.length > 0) {
    return '/consent-gate';
  }

  // 7. Role check (ensure only DRIVER enters driver app)
  if (user.role !== 'DRIVER') {
    return '/(public)/login';
  }

  // 8. Account status gating
  if (user.status === ACCOUNT_STATUS.PENDING) {
    // If driver has already submitted KYC and it is under review
    if (kycStatus === 'SUBMITTED' || kycStatus === 'UNDER_REVIEW') {
      return '/(onboarding)/status';
    }
    // Otherwise driver needs to complete KYC wizard
    return '/(onboarding)/wizard';
  }

  if (user.status === 'NEED_MORE_INFO') {
    return '/(onboarding)/wizard';
  }

  if (user.status === 'REJECTED') {
    return '/(onboarding)/status';
  }

  if (user.status === ACCOUNT_STATUS.APPROVED || user.status === ACCOUNT_STATUS.SUSPENDED) {
    return '/(tabs)';
  }

  // Fallback
  return '/(tabs)';
}
