import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma, disconnectPrisma } from '../../../shared/db/index.js';
import {
  postPaymentCaptured,
  postInstallationAllowance,
  postAssignmentSettlement,
  postRefundReserve,
  postRefundPayout,
  postPayoutReserve,
  postPayoutComplete,
  postPayoutReversal,
  postCampaignCloseout,
  postGatewayFee,
  postManualAdjustment,
} from '../recipes/index.js';
import { AccountDirectory } from '../account-directory.js';
import { LedgerService } from '../ledger.service.js';
import { LedgerInvariantService } from '../ledger-invariant.service.js';
import {
  LEDGER_DIRECTIONS,
  ROLES,
  ACCOUNT_STATUS,
  CAMPAIGN_STATUS,
} from '@ap/shared-constants';

describe('Ledger Recipes & Invariants (Phase 8)', () => {
  let testCampaignId: string;
  let testDriverId: string;
  let testCompanyId: string;
  const testAssignmentId = randomUUID();
  const testPaymentId = randomUUID();
  const testRefundId = randomUUID();
  const testPayoutId = randomUUID();
  const testAdjustmentId = randomUUID();

  beforeAll(async () => {
    // 1. Ensure system accounts exist
    await AccountDirectory.getGatewayClearingAccount();
    await AccountDirectory.getGatewayFeesAccount();
    await AccountDirectory.getPlatformRevenueAccount();
    await AccountDirectory.getGstPayableAccount();
    await AccountDirectory.getPayoutInTransitAccount();
    await AccountDirectory.getCompanyRefundAccount();
    await AccountDirectory.getSystemAdjustmentAccount();

    // 2. Create company user and driver user
    const company = await prisma.user.create({
      data: {
        role: ROLES.COMPANY,
        mobile: `+9199${Math.floor(10000000 + Math.random() * 90000000)}`,
        email: `company_${randomUUID()}@example.com`,
        status: ACCOUNT_STATUS.APPROVED,
      },
    });
    testCompanyId = company.id;

    const driver = await prisma.user.create({
      data: {
        role: ROLES.DRIVER,
        mobile: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
        status: ACCOUNT_STATUS.APPROVED,
      },
    });
    testDriverId = driver.id;

    // 3. Create campaign
    const campaign = await prisma.campaign.create({
      data: {
        companyId: company.id,
        title: 'Test Ledger Campaign',
        targetAutoCount: 10,
        startDate: new Date('2026-12-01'),
        endDate: new Date('2026-12-31'),
        dailyRentPaise: 3333,
        printingAllowancePaise: 150000,
        totalBudgetPaise: 1000000n,
        platformFeePaise: 200000n,
        gstAmountPaise: 36000n,
        totalChargedPaise: 1236000n,
        status: CAMPAIGN_STATUS.RUNNING,
      },
    });
    testCampaignId = campaign.id;
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it('Recipe 1: posts company payment captured and enforces idempotency', async () => {
    const amountPaise = 13860000n; // 138,600 INR
    const tx = await postPaymentCaptured({
      paymentId: testPaymentId,
      campaignId: testCampaignId,
      amountPaise,
    });

    expect(tx.id).toBeDefined();
    expect(tx.entries).toHaveLength(2);

    const escrow = await AccountDirectory.getCampaignEscrowAccount(testCampaignId);
    const escrowBalance = await LedgerService.getBalance(escrow.id);
    expect(escrowBalance).toBe(amountPaise);

    // Replay should return identical transaction (idempotent)
    const replay = await postPaymentCaptured({
      paymentId: testPaymentId,
      campaignId: testCampaignId,
      amountPaise,
    });
    expect(replay.id).toBe(tx.id);
  });

  it('Recipe 2: posts printing allowance on installation approval', async () => {
    const allowancePaise = 150000n; // 1,500 INR
    const tx = await postInstallationAllowance({
      assignmentId: testAssignmentId,
      campaignId: testCampaignId,
      driverId: testDriverId,
      amountPaise: allowancePaise,
    });

    expect(tx.id).toBeDefined();
    expect(tx.entries).toHaveLength(2);

    const driverWallet = await AccountDirectory.getDriverWalletAccount(testDriverId);
    const walletBalance = await LedgerService.getBalance(driverWallet.id);
    expect(walletBalance).toBe(allowancePaise);

    const escrow = await AccountDirectory.getCampaignEscrowAccount(testCampaignId);
    const escrowBalance = await LedgerService.getBalance(escrow.id);
    expect(escrowBalance).toBe(13860000n - allowancePaise);
  });

  it('Recipe 3: posts assignment settlement and conserves funds', async () => {
    // R: 100,000, C: 20,000, G: 3,600 -> Total per slot = 123,600 paise
    // Say driver ran 25/30 days:
    const rentPayablePaise = 83333n;
    const companyRefundPaise = 16667n;
    const commissionPaise = 20000n;
    const gstPaise = 3600n;

    const tx = await postAssignmentSettlement({
      assignmentId: testAssignmentId,
      campaignId: testCampaignId,
      driverId: testDriverId,
      rentPayablePaise,
      companyRefundPaise,
      commissionPaise,
      gstPaise,
    });

    expect(tx.id).toBeDefined();
    expect(tx.entries).toHaveLength(5); // 1 debit (escrow) + 4 credits

    const driverWallet = await AccountDirectory.getDriverWalletAccount(testDriverId);
    const walletBalance = await LedgerService.getBalance(driverWallet.id);
    // previous allowance 150,000 + 83,333 rent
    expect(walletBalance).toBe(150000n + rentPayablePaise);
  });

  it('Recipe 4: posts refund reserve and refund payout', async () => {
    const refundAmountPaise = 500000n;

    // 4A: Escrow to refund liability
    const reserveTx = await postRefundReserve({
      refundId: testRefundId,
      campaignId: testCampaignId,
      amountPaise: refundAmountPaise,
    });
    expect(reserveTx.id).toBeDefined();

    // 4B: Refund payout back to customer
    const payoutTx = await postRefundPayout({
      refundId: testRefundId,
      amountPaise: refundAmountPaise,
    });
    expect(payoutTx.id).toBeDefined();
  });

  it('Recipe 5: posts payout reserve, complete, and reversal lifecycle', async () => {
    const payoutAmountPaise = 50000n;

    // 5A: Reserve payout from driver wallet
    const reserveTx = await postPayoutReserve({
      payoutId: testPayoutId,
      driverId: testDriverId,
      amountPaise: payoutAmountPaise,
    });
    expect(reserveTx.id).toBeDefined();

    // 5B: Complete payout
    const completeTx = await postPayoutComplete({
      payoutId: testPayoutId,
      amountPaise: payoutAmountPaise,
    });
    expect(completeTx.id).toBeDefined();

    // 5C: Test reversal on another payout
    const failPayoutId = randomUUID();
    await postPayoutReserve({
      payoutId: failPayoutId,
      driverId: testDriverId,
      amountPaise: 20000n,
    });
    const reversalTx = await postPayoutReversal({
      payoutId: failPayoutId,
      driverId: testDriverId,
      amountPaise: 20000n,
      reason: 'Bank rejected account',
    });
    expect(reversalTx.id).toBeDefined();
  });

  it('Recipe 6: sweeps remaining escrow to company refund on closeout', async () => {
    const escrow = await AccountDirectory.getCampaignEscrowAccount(testCampaignId);
    const remainingBalance = await LedgerService.getBalance(escrow.id);
    expect(remainingBalance).toBeGreaterThan(0n);

    const closeoutTx = await postCampaignCloseout({
      campaignId: testCampaignId,
      amountPaise: remainingBalance,
    });
    expect(closeoutTx.id).toBeDefined();

    const finalEscrowBalance = await LedgerService.getBalance(escrow.id);
    expect(finalEscrowBalance).toBe(0n);
  });

  it('Recipe 7: posts gateway fee', async () => {
    const feePaise = 25000n;
    const tx = await postGatewayFee({
      paymentId: testPaymentId,
      feePaise,
    });
    expect(tx.id).toBeDefined();
  });

  it('Recipe 8: posts manual adjustment against SYS_ADJUSTMENT', async () => {
    const platformRev = await AccountDirectory.getPlatformRevenueAccount();
    const adjTx = await postManualAdjustment({
      adjustmentId: testAdjustmentId,
      targetAccountId: platformRev.id,
      direction: LEDGER_DIRECTIONS.DEBIT,
      amountPaise: 1000n,
      reason: 'Audit correction',
    });
    expect(adjTx.id).toBeDefined();
  });

  it('Trial Balance: verifies system-wide equilibrium (sum debits == sum credits)', async () => {
    const trialBalance = await LedgerInvariantService.verifyTrialBalance();
    expect(trialBalance.isBalanced).toBe(true);
    expect(trialBalance.diffPaise).toBe(0n);
    expect(trialBalance.totalDebitsPaise).toBe(trialBalance.totalCreditsPaise);
  });
});
