import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma, disconnectPrisma } from '../shared/db/index.js';
import { AccountDirectory } from '../modules/ledger/account-directory.js';
import { LedgerService } from '../modules/ledger/ledger.service.js';
import { LedgerInvariantService } from '../modules/ledger/ledger-invariant.service.js';
import { CampaignPaymentService } from '../modules/payments/campaign-payment.service.js';
import { TaxDocumentService } from '../modules/tax-documents/tax-document.service.js';
import { SettlementService } from '../modules/settlements/settlement.service.js';
import { RefundService } from '../modules/refunds/refund.service.js';
import { DriverWalletService } from '../modules/wallet/driver-wallet.service.js';
import { AdminFinanceService } from '../modules/admin/finance/admin-finance.service.js';
import { postInstallationAllowance } from '../modules/ledger/recipes/index.js';
import {
  ROLES,
  ACCOUNT_STATUS,
  CAMPAIGN_STATUS,
  PAYMENT_STATUS,
  ASSIGNMENT_STATUS,
  REFUND_REASONS,
  REFUND_STATUS,
  SETTLEMENT_STATUS,
  PAYOUT_STATUS,
  PAYMENT_PROVIDER_NAMES,
  TAX_DOCUMENT_TYPES,
} from '@ap/shared-constants';

describe('Phase 8 Financial Engine & Ledger Integration Tests', () => {
  let companyUser: { id: string };
  let driverUser: { id: string };
  let adminUser1: { id: string };
  let adminUser2: { id: string };
  let campaign: { id: string };
  let vehicle: { id: string };
  let assignment: { id: string };

  beforeAll(async () => {
    // 1. Initialize system ledger accounts
    await AccountDirectory.getGatewayClearingAccount();
    await AccountDirectory.getGatewayFeesAccount();
    await AccountDirectory.getPlatformRevenueAccount();
    await AccountDirectory.getGstPayableAccount();
    await AccountDirectory.getPayoutInTransitAccount();
    await AccountDirectory.getCompanyRefundAccount();
    await AccountDirectory.getSystemAdjustmentAccount();

    // 2. Create users
    companyUser = await prisma.user.create({
      data: {
        role: ROLES.COMPANY,
        mobile: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
        email: `company_${randomUUID()}@example.com`,
        status: ACCOUNT_STATUS.APPROVED,
        companyProfile: {
          create: {
            companyName: 'Acme Ads Corp',
            gstin: `24ABCDE${Math.floor(1000 + Math.random() * 9000)}F1Z5`,
            contactPersonName: 'Alice',
            contactPersonPhone: '+919876543210',
          },
        },
      },
    });

    driverUser = await prisma.user.create({
      data: {
        role: ROLES.DRIVER,
        mobile: `+9197${Math.floor(10000000 + Math.random() * 90000000)}`,
        email: `driver_${randomUUID()}@example.com`,
        status: ACCOUNT_STATUS.APPROVED,
        driverProfile: {
          create: {
            fullName: 'Rajesh Driver',
            upiIdEncrypted: 'rajesh@upi',
            bankAccountNumberEncrypted: '1234567890',
            bankIfsc: 'SBIN0001234',
            bankAccountName: 'Rajesh Driver',
          },
        },
      },
    });

    adminUser1 = await prisma.user.create({
      data: {
        role: ROLES.SUPER_ADMIN,
        mobile: `+9196${Math.floor(10000000 + Math.random() * 90000000)}`,
        email: `admin1_${randomUUID()}@example.com`,
        status: ACCOUNT_STATUS.APPROVED,
      },
    });

    adminUser2 = await prisma.user.create({
      data: {
        role: ROLES.SUPER_ADMIN,
        mobile: `+9195${Math.floor(10000000 + Math.random() * 90000000)}`,
        email: `admin2_${randomUUID()}@example.com`,
        status: ACCOUNT_STATUS.APPROVED,
      },
    });

    // 3. Create campaign
    // Total per slot: rent 100000 + printing 15000 + fee 20000 + gst 3600 = 138600
    // 2 slots -> 277200 paise
    const startDate = new Date();
    const endDate = new Date(Date.now() + 30 * 86400000);
    campaign = await prisma.campaign.create({
      data: {
        companyId: companyUser.id,
        title: 'Monsoon Mega Brand Drive',
        status: CAMPAIGN_STATUS.APPROVED,
        targetAutoCount: 2,
        startDate,
        endDate,
        dailyRentPaise: 3333,
        printingAllowancePaise: 15000,
        platformFeePaise: 40000,
        gstAmountPaise: 7200,
        totalBudgetPaise: 277200,
        totalChargedPaise: 277200,
        pricingSnapshot: {
          rentPerSlotPaise: '100000',
          printingPerSlotPaise: '15000',
          platformFeePerSlotPaise: '20000',
          gstPerSlotPaise: '3600',
          totalPerSlotPaise: '138600',
        },
      },
    });

    // 4. Create vehicle and assignment
    vehicle = await prisma.vehicle.create({
      data: {
        registrationNumber: `GJ01AB${Math.floor(1000 + Math.random() * 9000)}`,
        isVerified: true,
      },
    });

    assignment = await prisma.assignment.create({
      data: {
        campaignId: campaign.id,
        driverId: driverUser.id,
        vehicleId: vehicle.id,
        status: ASSIGNMENT_STATUS.RESERVED,
        expiresAt: new Date(Date.now() + 48 * 3600000),
        totalDays: 30,
      },
    });
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it('1. Creates payment order and captures payment via DEV provider (Recipe 1)', async () => {
    const orderResult = await CampaignPaymentService.createPaymentOrder(
      campaign.id,
      companyUser.id,
      `test-order-${randomUUID()}`,
    );

    expect(orderResult.paymentId).toBeDefined();
    expect(orderResult.amountPaise).toBe('277200');

    // Verify payment using mock signature for dev provider
    const verifyResult = await CampaignPaymentService.verifyPayment(
      {
        paymentId: orderResult.paymentId,
        gatewayOrderId: orderResult.gatewayOrderId,
        gatewayPaymentId: `dev_pay_${randomUUID()}`,
        gatewaySignature: 'dev_mock_signature',
      },
      companyUser.id,
    );

    expect(verifyResult.payment.status).toBe(PAYMENT_STATUS.PAID);

    // Verify campaign status transitioned to LIVE / RUNNING
    const updatedCampaign = await prisma.campaign.findUnique({
      where: { id: campaign.id },
    });
    expect([CAMPAIGN_STATUS.LIVE, CAMPAIGN_STATUS.RUNNING]).toContain(updatedCampaign?.status);

    // Verify campaign escrow balance = 277200
    const escrowAccount = await AccountDirectory.getCampaignEscrowAccount(campaign.id);
    const escrowBalance = await LedgerService.getBalance(escrowAccount.id);
    expect(escrowBalance).toBe(277200n);

    // Verify tax invoice was generated
    const taxInvoice = await prisma.taxDocument.findFirst({
      where: { campaignId: campaign.id, documentType: TAX_DOCUMENT_TYPES.TAX_INVOICE },
    });
    expect(taxInvoice).toBeDefined();
    expect(taxInvoice?.documentNumber).toMatch(/^INV\//);
  });

  it('2. Credits printing allowance to driver wallet on install approval (Recipe 2)', async () => {
    // Post allowance of 15000 paise (150 Rs)
    await postInstallationAllowance({
      campaignId: campaign.id,
      driverId: driverUser.id,
      assignmentId: assignment.id,
      amountPaise: 15000n,
    });

    // Check driver wallet balance
    const walletBalance = await DriverWalletService.getBalance(driverUser.id);
    expect(walletBalance.availablePaise).toBe('15000');

    // Escrow should now be 277200 - 15000 = 262200
    const escrowAccount = await AccountDirectory.getCampaignEscrowAccount(campaign.id);
    const escrowBalance = await LedgerService.getBalance(escrowAccount.id);
    expect(escrowBalance).toBe(262200n);
  });

  it('3. Computes assignment settlement and posts settlement split (Recipe 3)', async () => {
    // Populate 25 verified days and 5 missed days
    const daysData = [];
    for (let i = 1; i <= 25; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (30 - i));
      daysData.push({
        assignmentId: assignment.id,
        date: d,
        status: 'VERIFIED' as const,
      });
    }
    for (let i = 26; i <= 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (30 - i));
      daysData.push({
        assignmentId: assignment.id,
        date: d,
        status: 'MISSED' as const,
      });
    }
    await prisma.assignmentDay.createMany({ data: daysData });

    // Calculate settlement
    const settlement = await SettlementService.calculateSettlement(assignment.id);

    expect(settlement.status).toBe(SETTLEMENT_STATUS.PENDING);
    expect(settlement.rentPayablePaise).toBeGreaterThan(0n);

    // Approve settlement
    const approvedSettlement = await SettlementService.approveSettlement(
      settlement.id,
      adminUser1.id,
    );
    expect([SETTLEMENT_STATUS.APPROVED, SETTLEMENT_STATUS.PAID]).toContain(approvedSettlement.status);

    // Check driver wallet balance has increased
    const wallet = await DriverWalletService.getBalance(driverUser.id);
    expect(BigInt(wallet.availablePaise)).toBeGreaterThan(15000n);
  });

  it('4. Handles driver wallet withdrawal flow (Recipe 5 Reserve & Complete)', async () => {
    const walletBefore = await DriverWalletService.getBalance(driverUser.id);
    const withdrawAmount = 20000n;
    expect(BigInt(walletBefore.availablePaise)).toBeGreaterThanOrEqual(withdrawAmount);

    // Driver requests withdrawal of 20000 paise
    const withdrawal = await DriverWalletService.requestWithdrawal(
      driverUser.id,
      withdrawAmount,
      `withdraw-${randomUUID()}`,
    );

    expect([PAYOUT_STATUS.APPROVED, PAYOUT_STATUS.PAID]).toContain(withdrawal.status);

    // Available wallet balance dropped
    const walletAfter = await DriverWalletService.getBalance(driverUser.id);
    expect(BigInt(walletAfter.availablePaise)).toBe(BigInt(walletBefore.availablePaise) - withdrawAmount);
  });

  it('5. Enforces maker-checker dual approval for refund processing (Recipe 4)', async () => {
    // Admin 1 requests refund of 20000 paise
    const refund = await RefundService.requestRefund(
      {
        campaignId: campaign.id,
        amountPaise: 20000n,
        reason: REFUND_REASONS.UNFILLED_SLOTS,
        notes: 'Unfilled slots refund before closeout',
      },
      adminUser1.id,
    );

    expect(refund.status).toBe(REFUND_STATUS.PENDING);

    // Admin 1 CANNOT approve their own refund (Maker-Checker violation)
    await expect(
      RefundService.approveRefund(refund.id, adminUser1.id),
    ).rejects.toThrow();

    // Admin 2 approves refund -> SUCCESS
    const approvedRefundResult = await RefundService.approveRefund(refund.id, adminUser2.id);
    expect([REFUND_STATUS.APPROVED, REFUND_STATUS.PROCESSING, REFUND_STATUS.SUCCEEDED]).toContain(
      approvedRefundResult.refund.status,
    );
    expect(approvedRefundResult.creditNote).toBeDefined();
    expect(approvedRefundResult.creditNote.documentNumber).toMatch(/^CN\//);
  });

  it('6. Sweeps unfilled / unallocated slots to company refund reserve on closeout (Recipe 6)', async () => {
    // Mark assignment as PAID to allow closeout
    await prisma.assignment.update({
      where: { id: assignment.id },
      data: { status: ASSIGNMENT_STATUS.PAID },
    });

    // Closeout campaign
    const closeoutSweep = await SettlementService.closeoutCampaign(
      campaign.id,
      adminUser1.id,
    );
    expect(BigInt(closeoutSweep.sweptAmountPaise)).toBeGreaterThanOrEqual(0n);

    // Escrow balance must now be exactly 0
    const escrowAccount = await AccountDirectory.getCampaignEscrowAccount(campaign.id);
    const finalEscrow = await LedgerService.getBalance(escrowAccount.id);
    expect(finalEscrow).toBe(0n);
  });

  it('7. Verifies zero ledger imbalance and global trial balance', async () => {
    const trialBalance = await AdminFinanceService.getTrialBalance();

    expect(trialBalance.isBalanced).toBe(true);
    expect(trialBalance.diffPaise).toBe('0');
    expect(BigInt(trialBalance.totalDebitsPaise)).toBe(BigInt(trialBalance.totalCreditsPaise));
  });
});
