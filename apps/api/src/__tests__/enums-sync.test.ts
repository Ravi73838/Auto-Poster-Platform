import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  ROLES,
  ACCOUNT_STATUS,
  CAMPAIGN_STATUS,
  ASSIGNMENT_STATUS,
  DAILY_PHOTO_STATUS,
  DOCUMENT_TYPES,
  DOCUMENT_STATUS,
  PAYMENT_STATUS,
  PAYOUT_TYPES,
  PAYOUT_STATUS,
  PAYOUT_METHODS,
  DISPUTE_STATUS,
  DISPUTE_REASONS,
  STRIKE_REASONS,
  PHOTO_KINDS,
  INSTALL_APPROVERS,
  LEDGER_ACCOUNT_TYPES,
  LEDGER_REF_TYPES,
  LEDGER_DIRECTIONS,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_STATUS,
  OTP_PURPOSES,
  ACTOR_TYPES,
  VEHICLE_TYPES,
  DEVICE_PLATFORMS,
  KYC_SUBMISSION_STATUS,
  FILE_PURPOSES,
  FILE_STATUS,
  CONSENT_TYPES,
  KYC_REASON_CODES,
  CAMPAIGN_REVIEW_REASONS,
  PRINT_MATERIALS,
  CAMPAIGN_SORTS,
  CAMPAIGN_REVIEW_DECISIONS,
  ASSIGNMENT_RELEASE_REASONS,
  INSTALL_REJECT_REASONS,
  REVIEW_OWNERS,
  DAY_STATUS,
  PHOTO_REVIEW_SOURCES,
  DAILY_REJECT_REASONS,
  PHOTO_FLAG_REASONS,
  PHOTO_FLAG_STATUSES,
  REFUND_REASONS,
  REFUND_STATUS,
  SETTLEMENT_STATUS,
  TAX_DOCUMENT_TYPES,
  ADJUSTMENT_STATUS,
  PAYOUT_PROVIDER_NAMES,
  PAYMENT_PROVIDER_NAMES,
  EXPORT_JOB_STATUS,
  SETTING_CHANGE_REQUEST_STATUS,
  LEGAL_DOCUMENT_TYPES,
  LEGAL_DOCUMENT_STATUS,
  JOB_RUN_STATUS,
} from '@ap/shared-constants';


function parsePrismaEnums(schemaContent: string): Map<string, string[]> {
  const enumRegex = /enum\s+(\w+)\s+\{([^}]+)\}/g;
  const enums = new Map<string, string[]>();

  let match: RegExpExecArray | null;
  while ((match = enumRegex.exec(schemaContent)) !== null) {
    const enumName = match[1]!;
    const body = match[2]!;
    const values = body
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('//'));
    enums.set(enumName, values);
  }

  return enums;
}

describe('Enum Synchronization: Prisma Schema vs @ap/shared-constants', () => {
  const schemaPath = path.resolve(__dirname, '../../prisma/schema.prisma');
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');
  const prismaEnums = parsePrismaEnums(schemaContent);

  const enumMappings: Record<string, Record<string, string>> = {
    Role: ROLES,
    AccountStatus: ACCOUNT_STATUS,
    CampaignStatus: CAMPAIGN_STATUS,
    AssignmentStatus: ASSIGNMENT_STATUS,
    DailyPhotoStatus: DAILY_PHOTO_STATUS,
    DocumentType: DOCUMENT_TYPES,
    DocumentStatus: DOCUMENT_STATUS,
    PaymentStatus: PAYMENT_STATUS,
    PayoutType: PAYOUT_TYPES,
    PayoutStatus: PAYOUT_STATUS,
    PayoutMethod: PAYOUT_METHODS,
    DisputeStatus: DISPUTE_STATUS,
    DisputeReason: DISPUTE_REASONS,
    StrikeReason: STRIKE_REASONS,
    PhotoKind: PHOTO_KINDS,
    InstallApprover: INSTALL_APPROVERS,
    LedgerAccountType: LEDGER_ACCOUNT_TYPES,
    LedgerRefType: LEDGER_REF_TYPES,
    LedgerDirection: LEDGER_DIRECTIONS,
    NotificationChannel: NOTIFICATION_CHANNELS,
    NotificationStatus: NOTIFICATION_STATUS,
    OtpPurpose: OTP_PURPOSES,
    ActorType: ACTOR_TYPES,
    VehicleType: VEHICLE_TYPES,
    DevicePlatform: DEVICE_PLATFORMS,
    KycSubmissionStatus: KYC_SUBMISSION_STATUS,
    FilePurpose: FILE_PURPOSES,
    FileStatus: FILE_STATUS,
    ConsentType: CONSENT_TYPES,
    KycReasonCode: KYC_REASON_CODES,
    CampaignReviewReason: CAMPAIGN_REVIEW_REASONS,
    PrintMaterial: PRINT_MATERIALS,
    CampaignSort: CAMPAIGN_SORTS,
    CampaignReviewDecision: CAMPAIGN_REVIEW_DECISIONS,
    AssignmentReleaseReason: ASSIGNMENT_RELEASE_REASONS,
    InstallRejectReason: INSTALL_REJECT_REASONS,
    ReviewOwner: REVIEW_OWNERS,
    DayStatus: DAY_STATUS,
    PhotoReviewSource: PHOTO_REVIEW_SOURCES,
    DailyRejectReason: DAILY_REJECT_REASONS,
    PhotoFlagReason: PHOTO_FLAG_REASONS,
    PhotoFlagStatus: PHOTO_FLAG_STATUSES,
    RefundReason: REFUND_REASONS,
    RefundStatus: REFUND_STATUS,
    SettlementStatus: SETTLEMENT_STATUS,
    TaxDocumentType: TAX_DOCUMENT_TYPES,
    AdjustmentStatus: ADJUSTMENT_STATUS,
    PayoutProviderName: PAYOUT_PROVIDER_NAMES,
    PaymentProviderName: PAYMENT_PROVIDER_NAMES,
    ExportJobStatus: EXPORT_JOB_STATUS,
    SettingChangeRequestStatus: SETTING_CHANGE_REQUEST_STATUS,
    LegalDocumentType: LEGAL_DOCUMENT_TYPES,
    LegalDocumentStatus: LEGAL_DOCUMENT_STATUS,
    JobRunStatus: JOB_RUN_STATUS,
  };

  it('contains all required enums in Prisma schema', () => {
    for (const enumName of Object.keys(enumMappings)) {
      expect(
        prismaEnums.has(enumName),
        `Prisma schema is missing enum "${enumName}"`,
      ).toBe(true);
    }
  });

  for (const [enumName, constantObj] of Object.entries(enumMappings)) {
    it(`Prisma enum "${enumName}" exactly matches shared-constants`, () => {
      const prismaValues = prismaEnums.get(enumName) ?? [];
      const sharedValues = Object.values(constantObj);

      expect(prismaValues.sort()).toEqual(sharedValues.sort());
    });
  }
});
