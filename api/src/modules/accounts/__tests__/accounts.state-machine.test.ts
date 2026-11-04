import { describe, it, expect } from 'vitest';
import { ACCOUNT_STATUS, ROLES } from '@ap/shared-constants';
import { accountStateMachine } from '../accounts.state-machine.js';

describe('AccountStatus State Machine Unit Tests', () => {
  it('allows PENDING -> APPROVED with kyc.review permission', async () => {
    expect(accountStateMachine.can(ACCOUNT_STATUS.PENDING, ACCOUNT_STATUS.APPROVED)).toBe(true);
    await expect(
      accountStateMachine.assertTransition(ACCOUNT_STATUS.PENDING, ACCOUNT_STATUS.APPROVED, {
        actor: { id: 'admin-1', role: ROLES.MODERATOR, permissions: ['kyc.review'] },
        targetUserId: 'user-1',
      }),
    ).resolves.not.toThrow();
  });

  it('rejects PENDING -> APPROVED without kyc.review permission', async () => {
    await expect(
      accountStateMachine.assertTransition(ACCOUNT_STATUS.PENDING, ACCOUNT_STATUS.APPROVED, {
        actor: { id: 'finance-1', role: ROLES.FINANCE, permissions: ['ledger:read'] },
        targetUserId: 'user-1',
      }),
    ).rejects.toThrow();
  });

  it('allows PENDING -> REJECTED and PENDING -> NEED_MORE_INFO', async () => {
    expect(accountStateMachine.can(ACCOUNT_STATUS.PENDING, ACCOUNT_STATUS.REJECTED)).toBe(true);
    expect(accountStateMachine.can(ACCOUNT_STATUS.PENDING, ACCOUNT_STATUS.NEED_MORE_INFO)).toBe(true);

    await expect(
      accountStateMachine.assertTransition(ACCOUNT_STATUS.PENDING, ACCOUNT_STATUS.NEED_MORE_INFO, {
        actor: { id: 'mod-1', role: ROLES.MODERATOR, permissions: ['kyc.review'] },
        targetUserId: 'user-1',
      }),
    ).resolves.not.toThrow();
  });

  it('allows NEED_MORE_INFO and REJECTED to return to PENDING via KYC submit', async () => {
    expect(accountStateMachine.can(ACCOUNT_STATUS.NEED_MORE_INFO, ACCOUNT_STATUS.PENDING)).toBe(true);
    expect(accountStateMachine.can(ACCOUNT_STATUS.REJECTED, ACCOUNT_STATUS.PENDING)).toBe(true);

    await expect(
      accountStateMachine.assertTransition(ACCOUNT_STATUS.NEED_MORE_INFO, ACCOUNT_STATUS.PENDING, {
        actor: { id: 'driver-1', role: ROLES.DRIVER },
        targetUserId: 'driver-1',
        isKycSubmission: true,
      }),
    ).resolves.not.toThrow();

    // Rejects if not through KYC submission
    await expect(
      accountStateMachine.assertTransition(ACCOUNT_STATUS.NEED_MORE_INFO, ACCOUNT_STATUS.PENDING, {
        actor: { id: 'driver-1', role: ROLES.DRIVER },
        targetUserId: 'driver-1',
        isKycSubmission: false,
      }),
    ).rejects.toThrow();
  });

  it('allows APPROVED -> SUSPENDED or BLOCKED only with user.manage and reason', async () => {
    expect(accountStateMachine.can(ACCOUNT_STATUS.APPROVED, ACCOUNT_STATUS.SUSPENDED)).toBe(true);
    expect(accountStateMachine.can(ACCOUNT_STATUS.APPROVED, ACCOUNT_STATUS.BLOCKED)).toBe(true);

    // Missing reason fails
    await expect(
      accountStateMachine.assertTransition(ACCOUNT_STATUS.APPROVED, ACCOUNT_STATUS.SUSPENDED, {
        actor: { id: 'mod-1', role: ROLES.MODERATOR, permissions: ['user.manage'] },
        targetUserId: 'user-1',
        reason: '',
      }),
    ).rejects.toThrow();

    // Valid reason succeeds
    await expect(
      accountStateMachine.assertTransition(ACCOUNT_STATUS.APPROVED, ACCOUNT_STATUS.SUSPENDED, {
        actor: { id: 'mod-1', role: ROLES.MODERATOR, permissions: ['user.manage'] },
        targetUserId: 'user-1',
        reason: 'Multiple missing daily photos',
      }),
    ).resolves.not.toThrow();
  });

  it('allows BLOCKED -> APPROVED only for SUPER_ADMIN', async () => {
    expect(accountStateMachine.can(ACCOUNT_STATUS.BLOCKED, ACCOUNT_STATUS.APPROVED)).toBe(true);

    // Moderator fails
    await expect(
      accountStateMachine.assertTransition(ACCOUNT_STATUS.BLOCKED, ACCOUNT_STATUS.APPROVED, {
        actor: { id: 'mod-1', role: ROLES.MODERATOR, permissions: ['user.manage'] },
        targetUserId: 'user-1',
        reason: 'Appealed successfully',
      }),
    ).rejects.toThrow();

    // Super admin succeeds with reason
    await expect(
      accountStateMachine.assertTransition(ACCOUNT_STATUS.BLOCKED, ACCOUNT_STATUS.APPROVED, {
        actor: { id: 'admin-1', role: ROLES.SUPER_ADMIN },
        targetUserId: 'user-1',
        reason: 'Formal appeal granted',
      }),
    ).resolves.not.toThrow();
  });

  it('strictly rejects illegal transitions', () => {
    expect(accountStateMachine.can(ACCOUNT_STATUS.APPROVED, ACCOUNT_STATUS.PENDING)).toBe(false);
    expect(accountStateMachine.can(ACCOUNT_STATUS.BLOCKED, ACCOUNT_STATUS.NEED_MORE_INFO)).toBe(false);
    expect(accountStateMachine.can(ACCOUNT_STATUS.SUSPENDED, ACCOUNT_STATUS.NEED_MORE_INFO)).toBe(false);
  });
});

