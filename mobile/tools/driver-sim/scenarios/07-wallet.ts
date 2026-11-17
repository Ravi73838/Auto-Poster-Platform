import type { SimulatorContext } from '../harness';
import { assertTestLedgerBalanced } from '../harness';
import {
  LEDGER_ACCOUNT_TYPES,
  LEDGER_REF_TYPES,
  ACTOR_TYPES,
} from '../../../src/shared/constants/index';

export async function runWalletScenario(
  ctx: SimulatorContext,
  driverAuth: { driverUserId: string; driverToken: string },
): Promise<void> {
  const { client, testPrisma } = ctx;
  (client as any).setTokens({ accessToken: driverAuth.driverToken, refreshToken: null });

  // 1. Fetch initial wallet balance
  const initialBalance = await client.getDriverWalletBalance();
  if (initialBalance === undefined) {
    throw new Error('Failed to fetch driver wallet balance');
  }

  // 2. Credit test earnings via double-entry ledger in test schema
  const { LedgerService } = await import('../../../../api/src/modules/ledger/ledger.service');

  // Ensure driver wallet and escrow ledger accounts exist
  let driverAccount = await testPrisma.ledgerAccount.findFirst({
    where: {
      accountType: LEDGER_ACCOUNT_TYPES.DRIVER_WALLET,
      userId: driverAuth.driverUserId,
    },
  });

  if (!driverAccount) {
    driverAccount = await LedgerService.getOrCreateAccount({
      code: `DRV_WALLET_${driverAuth.driverUserId}`,
      accountType: LEDGER_ACCOUNT_TYPES.DRIVER_WALLET,
      userId: driverAuth.driverUserId,
    });
  }

  const adjustmentAccount = await LedgerService.getOrCreateAccount({
    code: 'SYSTEM_ADJUSTMENT_SIM',
    accountType: LEDGER_ACCOUNT_TYPES.ADJUSTMENT,
  });

  // Post verified rent credit of ₹1,000 (100,000 paise) to Driver Wallet
  await LedgerService.postTransaction({
    refType: LEDGER_REF_TYPES.RENT_PAYOUT,
    refId: `daily_credit_test_${Date.now()}`,
    description: 'Driver verified daily rent credit for simulation',
    entries: [
      {
        accountId: adjustmentAccount.id,
        direction: 'DEBIT',
        amountPaise: 100000n,
      },
      {
        accountId: driverAccount.id,
        direction: 'CREDIT',
        amountPaise: 100000n,
      },
    ],
  });

  // Verify ledger is balanced
  await assertTestLedgerBalanced();

  // 3. Re-check wallet balance in app - must reflect credit
  const updatedBalance = await client.getDriverWalletBalance();
  const available = BigInt(updatedBalance.availablePaise || updatedBalance.balancePaise);
  if (available < 100000n) {
    throw new Error(`Expected wallet balance >= 100,000 paise after ledger credit, got: ${available}`);
  }

  // 4. Withdrawal under minimum limit (₹50 < ₹100 minimum) must be rejected
  let underMinRejected = false;
  try {
    await client.requestDriverWithdrawal({
      amountPaise: '5000', // ₹50
    });
  } catch (err: any) {
    if (err?.code === 'WITHDRAWAL_BELOW_MINIMUM' || err?.status === 400) {
      underMinRejected = true;
    }
  }
  if (!underMinRejected) {
    throw new Error('Withdrawal request under ₹100 minimum was not rejected');
  }

  // 5. Withdrawal exceeding available balance must be rejected
  let overdraftRejected = false;
  try {
    await client.requestDriverWithdrawal({
      amountPaise: '99999999', // Exceeding balance
    });
  } catch (err: any) {
    if (err?.code === 'INSUFFICIENT_WALLET_BALANCE' || err?.status === 400) {
      overdraftRejected = true;
    }
  }
  if (!overdraftRejected) {
    throw new Error('Withdrawal exceeding available balance was not rejected');
  }

  // 6. Valid withdrawal request of ₹500 (50,000 paise)
  const withdrawRes = await client.requestDriverWithdrawal({
    amountPaise: '50000',
  });
  if (!withdrawRes.payout && !withdrawRes.id) {
    throw new Error('Valid withdrawal request failed to generate payout record');
  }

  // Verify ledger remains balanced
  await assertTestLedgerBalanced();
}
