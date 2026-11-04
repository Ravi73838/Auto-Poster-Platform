import {
  ACCOUNT_STATUS,
  ROLES,
  ERROR_CODES,
  type AccountStatus,
  type Role,
} from '@ap/shared-constants';
import { createStateMachine } from '../../shared/state-machine/index.js';
import { AppError } from '../../shared/errors/index.js';

export interface AccountTransitionContext {
  actor: {
    id?: string;
    role: Role;
    permissions?: string[];
  };
  targetUserId: string;
  reason?: string;
  submissionId?: string;
  isKycSubmission?: boolean;
}

export const accountStatusTransitions: Record<AccountStatus, readonly AccountStatus[]> = {
  [ACCOUNT_STATUS.PENDING]: [
    ACCOUNT_STATUS.APPROVED,
    ACCOUNT_STATUS.REJECTED,
    ACCOUNT_STATUS.NEED_MORE_INFO,
    ACCOUNT_STATUS.BLOCKED,
  ],
  [ACCOUNT_STATUS.NEED_MORE_INFO]: [
    ACCOUNT_STATUS.PENDING,
    ACCOUNT_STATUS.BLOCKED,
  ],
  [ACCOUNT_STATUS.REJECTED]: [
    ACCOUNT_STATUS.PENDING,
    ACCOUNT_STATUS.BLOCKED,
  ],
  [ACCOUNT_STATUS.APPROVED]: [
    ACCOUNT_STATUS.SUSPENDED,
    ACCOUNT_STATUS.BLOCKED,
  ],
  [ACCOUNT_STATUS.SUSPENDED]: [
    ACCOUNT_STATUS.APPROVED,
    ACCOUNT_STATUS.BLOCKED,
  ],
  [ACCOUNT_STATUS.BLOCKED]: [
    ACCOUNT_STATUS.APPROVED,
  ],
};

export const accountStateMachine = createStateMachine<
  AccountStatus,
  AccountTransitionContext
>({
  transitions: accountStatusTransitions,
  onTransition(from, to, context) {
    if (!context) {
      throw new AppError(
        ERROR_CODES.UNAUTHORIZED,
        401,
        'Transition context is required',
      );
    }

    const { actor, reason, isKycSubmission } = context;

    // 1. Resubmitting to PENDING (from NEED_MORE_INFO or REJECTED)
    if (to === ACCOUNT_STATUS.PENDING) {
      if (!isKycSubmission) {
        throw new AppError(
          ERROR_CODES.FORBIDDEN,
          403,
          'Account can only return to PENDING through KYC submission',
        );
      }
      return;
    }

    // 2. KYC Decision: PENDING -> APPROVED | REJECTED | NEED_MORE_INFO
    if (
      from === ACCOUNT_STATUS.PENDING &&
      (to === ACCOUNT_STATUS.APPROVED ||
        to === ACCOUNT_STATUS.REJECTED ||
        to === ACCOUNT_STATUS.NEED_MORE_INFO)
    ) {
      const hasKycPermission =
        actor.role === ROLES.SUPER_ADMIN ||
        (actor.permissions && actor.permissions.includes('kyc.review'));

      if (!hasKycPermission) {
        throw new AppError(
          ERROR_CODES.FORBIDDEN,
          403,
          'kyc.review permission required to evaluate KYC submissions',
        );
      }
      return;
    }

    // 3. Unblocking: BLOCKED -> APPROVED (SUPER_ADMIN only)
    if (from === ACCOUNT_STATUS.BLOCKED && to === ACCOUNT_STATUS.APPROVED) {
      if (actor.role !== ROLES.SUPER_ADMIN) {
        throw new AppError(
          ERROR_CODES.FORBIDDEN,
          403,
          'Only a SUPER_ADMIN can unblock an account',
        );
      }
      if (!reason || reason.trim().length === 0) {
        throw new AppError(
          ERROR_CODES.REASON_REQUIRED,
          400,
          'Reason is required to unblock an account',
        );
      }
      return;
    }

    // 4. Suspending or Blocking: requires user.manage permission and a reason
    if (to === ACCOUNT_STATUS.SUSPENDED || to === ACCOUNT_STATUS.BLOCKED) {
      const hasUserManage =
        actor.role === ROLES.SUPER_ADMIN ||
        (actor.permissions && actor.permissions.includes('user.manage'));

      if (!hasUserManage) {
        throw new AppError(
          ERROR_CODES.FORBIDDEN,
          403,
          'user.manage permission required to suspend or block accounts',
        );
      }

      if (!reason || reason.trim().length < 3) {
        throw new AppError(
          ERROR_CODES.REASON_REQUIRED,
          400,
          'A specific reason (minimum 3 characters) is required to suspend or block an account',
        );
      }
      return;
    }

    // 5. Reactivating from SUSPENDED -> APPROVED
    if (from === ACCOUNT_STATUS.SUSPENDED && to === ACCOUNT_STATUS.APPROVED) {
      const hasUserManage =
        actor.role === ROLES.SUPER_ADMIN ||
        (actor.permissions && actor.permissions.includes('user.manage'));

      if (!hasUserManage) {
        throw new AppError(
          ERROR_CODES.FORBIDDEN,
          403,
          'user.manage permission required to reactivate accounts',
        );
      }
      return;
    }
  },
});

