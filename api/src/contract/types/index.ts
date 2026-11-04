import type {
  ErrorCode,
  Role,
  AccountStatus,
  DocumentType,
  DocumentStatus,
  PayoutMethod,
  FilePurpose,
  FileStatus,
  ConsentType,
  KycReasonCode,
  KycSubmissionStatus,
  NotificationChannel,
  NotificationStatus,
  CampaignStatus,
  InstallApprover,
  VehicleType,
  CampaignReviewReason,
  PrintMaterial,
  CampaignSort,
  CampaignReviewDecision,
  AssignmentStatus,
  AssignmentReleaseReason,
  InstallRejectReason,
  NextAction,
  ReviewOwner,
  InstallReviewDecision,
  DailyPhotoStatus,
  DayStatus,
  PhotoReviewSource,
  DailyRejectReason,
  PhotoFlagReason,
  PhotoFlagStatus,
  PaymentStatus,
  PayoutType,
  PayoutStatus,
  LedgerAccountType,
  LedgerRefType,
  LedgerDirection,
  RefundReason,
  RefundStatus,
  SettlementStatus,
  TaxDocumentType,
  AdjustmentStatus,
  PayoutProviderName,
  PaymentProviderName,
  StrikeReason,
  StrikeStatus,
  StrikeSource,
  BanType,
  PosterFixStatus,
  DisputeReason,
  DisputeStatus,
  DisputeParty,
  DisputeResolutionType,
  DisputeQueue,
  DisputeMessageVisibility,
  DisputeEffect,
  NotificationCategory,
  NotificationPriority,
  DeliveryStatus,
  AnnouncementStatus,
  DevicePushProvider,
  TerminationReason,
} from '@ap/shared-constants';


export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorDetail {
  code: ErrorCode;
  message: string;
  details?: unknown;
}

export interface ApiFailureResponse {
  success: false;
  error: ApiErrorDetail;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiFailureResponse;

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  version: string;
  timestamp: string;
  uptime: number;
  services: {
    database: 'connected' | 'disconnected' | 'disabled';
    redis: 'connected' | 'disconnected' | 'disabled';
  };
}

export interface AuthUser {
  id: string;
  role: Role;
  status: AccountStatus;
  mobile: string;
  email: string | null;
  preferredLanguage: string;
  preferredTheme: string;
  twoFactorEnabled: boolean;
  mustChangePassword: boolean;
  mobileVerifiedAt: string | null;
  emailVerifiedAt: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken?: string;
  user: AuthUser;
  isNewUser?: boolean;
  mustChangePassword?: boolean;
}

export interface AdminLoginChallengeResponse {
  twoFactorRequired: true;
  challengeId: string;
  maskedMobile: string;
}

export interface AuthMeResponse {
  user: AuthUser;
  role: Role;
  status: AccountStatus;
  permissions: string[];
  preferences: {
    language: string;
    theme: string;
  };
  mustChangePassword: boolean;
  profileCompleteness: boolean;
  pendingConsents?: Array<{
    type: string;
    version: number;
    title: string;
    publishedAt: string | null;
  }>;
}

export interface SessionDto {
  id: string;
  platform: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  appVersion?: string | null;
  createdAt: string;
  lastUsedAt: string;
  isCurrent: boolean;
}

export interface AdminUserDto {
  id: string;
  email: string;
  mobile: string;
  role: Role;
  status: AccountStatus;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface CreateAdminResponse {
  admin: AdminUserDto;
  temporaryPassword: string;
}

// =============================================================================
// PHASE 4: UPLOADS & FILE STORAGE
// =============================================================================

export interface PresignedUploadResponse {
  uploadUrl: string;
  fileKey: string;
  fileId: string;
  requiredHeaders: Record<string, string>;
  expiresAt: string;
}

export interface UploadedFileDto {
  id: string;
  fileKey: string;
  purpose: FilePurpose;
  mimeType: string;
  sizeBytes: number;
  status: FileStatus;
  sha256?: string | null;
  width?: number | null;
  height?: number | null;
  createdAt: string;
  confirmedAt?: string | null;
}

export interface SignedFileUrlResponse {
  fileId: string;
  url: string;
  expiresAt: string;
}

// =============================================================================
// PHASE 4: LOCATIONS & LEGAL
// =============================================================================

export interface CityDto {
  id: string;
  name: string;
  state: string;
  country: string;
  isActive: boolean;
  zonesCount?: number;
  createdAt: string;
}

export interface ZoneDto {
  id: string;
  cityId: string;
  name: string;
  pinCodes: string[];
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  isActive: boolean;
  createdAt: string;
}

export interface LegalVersionsResponse {
  termsVersion: string;
  termsUrl: string;
  privacyVersion: string;
  privacyUrl: string;
  posterPolicyVersion: string;
  posterPolicyUrl: string;
}

// =============================================================================
// PHASE 4: DOCUMENTS & ONBOARDING
// =============================================================================

export interface DocumentDto {
  id: string;
  documentType: DocumentType;
  status: DocumentStatus;
  rejectReasonCode?: KycReasonCode | null;
  rejectionReason?: string | null;
  uploadedFileId?: string | null;
  fileUrl?: string | null;
  mimeType: string;
  fileSizeBytes: number;
  isCurrent: boolean;
  createdAt: string;
  verifiedAt?: string | null;
}

export interface OnboardingStepState {
  completed: boolean;
  missingItems: string[];
}

export interface KycSubmissionSummaryDto {
  id: string;
  attemptNo: number;
  status: KycSubmissionStatus;
  submittedAt: string;
  decisionNote?: string | null;
  reviewReasons?: {
    reasonCode: KycReasonCode;
    fieldOrDocType?: string;
    note?: string;
  }[] | null;
  assignedToId?: string | null;
  reviewedById?: string | null;
  reviewedAt?: string | null;
}

export interface DriverOnboardingState {
  status: AccountStatus;
  canSubmit: boolean;
  steps: {
    personal: OnboardingStepState;
    vehicle: OnboardingStepState;
    documents: OnboardingStepState;
    payout: OnboardingStepState;
    consent: OnboardingStepState;
  };
  profile?: {
    fullName: string;
    cityId: string;
    cityName?: string;
    primaryZoneId: string;
    primaryZoneName?: string;
    extraZoneIds: string[];
  } | null;
  vehicle?: {
    id: string;
    registrationNumber: string;
    isVehicleOwner: boolean;
    ownerName?: string | null;
    ownerMobile?: string | null;
    isVerified: boolean;
  } | null;
  payout?: {
    method: PayoutMethod;
    upiIdMasked?: string | null;
    bankAccountHolder?: string | null;
    bankAccountNumberMasked?: string | null;
    bankIfsc?: string | null;
    payoutDetailsChangedAt?: string | null;
  } | null;
  documents: DocumentDto[];
  consents: { type: ConsentType; version: string; acceptedAt: string }[];
  latestKyc?: KycSubmissionSummaryDto | null;
}

export interface CompanyOnboardingState {
  status: AccountStatus;
  canSubmit: boolean;
  steps: {
    business: OnboardingStepState;
    documents: OnboardingStepState;
    consent: OnboardingStepState;
  };
  profile?: {
    businessName: string;
    gstNumber?: string | null;
    address: { street: string; city: string; state: string; postalCode: string };
    cityId: string;
    cityName?: string;
    contactPersonName: string;
    contactEmail: string;
    contactMobile: string;
    website?: string | null;
    isVerified: boolean;
  } | null;
  documents: DocumentDto[];
  consents: { type: ConsentType; version: string; acceptedAt: string }[];
  latestKyc?: KycSubmissionSummaryDto | null;
}

// =============================================================================
// PHASE 4: ADMIN KYC REVIEW & USER MANAGEMENT
// =============================================================================

export interface KycQueueItemDto {
  id: string;
  userId: string;
  role: Role;
  attemptNo: number;
  status: KycSubmissionStatus;
  userName: string;
  userMobile: string;
  userEmail?: string | null;
  cityName?: string | null;
  vehicleNumber?: string | null;
  gstin?: string | null;
  submittedAt: string;
  waitingTimeMinutes: number;
  assignedToId?: string | null;
  assignedToName?: string | null;
}

export interface KycDetailDto {
  submission: KycSubmissionSummaryDto;
  user: {
    id: string;
    role: Role;
    status: AccountStatus;
    mobile: string;
    email?: string | null;
    createdAt: string;
  };
  profileSnapshot: Record<string, unknown>;
  documents: DocumentDto[];
  duplicateFlags: {
    sameVehicleCount?: number;
    sameGstinCount?: number;
    sameBankFingerprintCount?: number;
    sameMobileCount?: number;
    details?: string[];
  };
  reviewChecklist: {
    nameConsistent: boolean;
    vehicleNumberMatches: boolean;
    ownerPermissionPresent: boolean;
    documentsNotExpired: boolean;
    notes: string[];
  };
  previousSubmissions: KycSubmissionSummaryDto[];
}

export interface UserManagementItemDto {
  id: string;
  role: Role;
  status: AccountStatus;
  name: string;
  mobile: string;
  email?: string | null;
  cityName?: string | null;
  vehicleNumber?: string | null;
  gstin?: string | null;
  createdAt: string;
}

// =============================================================================
// PHASE 4: NOTIFICATIONS
// =============================================================================

export interface NotificationDto {
  id: string;
  userId: string;
  channel: NotificationChannel;
  title: string;
  body: string;
  data?: Record<string, unknown> | null;
  status: NotificationStatus;
  sentAt?: string | null;
  readAt?: string | null;
  createdAt: string;
}

// =============================================================================
// PHASE 5: CAMPAIGNS
// =============================================================================

export interface CampaignPricingSnapshotDto {
  slots: number;
  days: number;
  rentPer30DaysPaise: number;
  rentForCampaignPerAutoPaise: number;
  printingAllowancePaise: number;
  driverRentTotalPaise: string;
  driverPrintingTotalPaise: string;
  totalBudgetPaise: string;
  commissionBps: number;
  platformFeePaise: string;
  gstBps: number;
  gstAmountPaise: string;
  totalChargedPaise: string;
}

export interface CampaignPricePreviewDto {
  slots: number;
  days: number;
  rentPer30DaysPaise: number;
  rentForCampaignPerAutoPaise: number;
  printingAllowancePaise: number;
  driverRentTotalPaise: string;
  driverPrintingTotalPaise: string;
  totalBudgetPaise: string;
  commissionBps: number;
  platformFeePaise: string;
  gstBps: number;
  gstAmountPaise: string;
  totalChargedPaise: string;
  perAutoBreakdown: {
    rentPaise: number;
    allowancePaise: number;
    totalPerAutoPaise: number;
  };
}

export interface CampaignDto {
  id: string;
  companyId: string;
  companyName?: string;
  title: string;
  description?: string | null;
  posterFileId?: string | null;
  posterUrl?: string | null;
  posterPreviewUrl?: string | null;
  posterThumbnailUrl?: string | null;
  printInstructions?: string | null;
  targetVehicleType: VehicleType;
  cityId?: string | null;
  cityName?: string | null;
  zoneIds: string[];
  zoneNames?: string[];
  slots: number;
  enrolledCount: number;
  startDate: string;
  endDate: string;
  durationDays: number;
  rentPer30DaysPaise: number;
  dailyRentPaise: number;
  printingAllowancePaise: number;
  totalBudgetPaise: string;
  platformFeePaise: string;
  gstAmountPaise: string;
  totalChargedPaise: string;
  status: CampaignStatus;
  installApprover: InstallApprover;
  printMaterial: PrintMaterial;
  printSize?: string | null;
  enrolmentClosesAt?: string | null;
  paymentDeadlineAt?: string | null;
  liveAt?: string | null;
  assignedToId?: string | null;
  assignedToName?: string | null;
  assignedAt?: string | null;
  revisionCount: number;
  reviewReasons?: { code: CampaignReviewReason; customNote?: string }[] | null;
  lastSubmittedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  pricingSnapshot?: CampaignPricingSnapshotDto | null;
}

export interface CampaignReviewDto {
  id: string;
  campaignId: string;
  attemptNo: number;
  reviewerId: string;
  reviewerName?: string | null;
  decision: CampaignReviewDecision;
  reasons?: { code: CampaignReviewReason; customNote?: string }[] | null;
  note?: string | null;
  createdAt: string;
}

export interface CampaignDetailDto {
  campaign: CampaignDto;
  reviews: CampaignReviewDto[];
  slotUsage: { total: number; occupied: number; available: number };
  company: { id: string; businessName: string; kycApprovedAt?: string | null };
  warnings?: string[];
  paymentSummary?: {
    totalChargedPaise: string;
    paymentDeadlineAt?: string | null;
    isPayable: boolean;
    statusText: string;
  };
}

export interface DriverCampaignDto {
  id: string;
  title: string;
  companyName: string;
  posterThumbnailUrl?: string | null;
  posterPreviewUrl?: string | null;
  startDate: string;
  endDate: string;
  durationDays: number;
  cityName: string;
  zoneNames: string[];
  slotsAvailable: number | string;
  rentForCampaignPaise: number;
  printingAllowancePaise: number;
  estimatedEarningsPaise: number;
  canSelect: boolean;
  cannotSelectReason?: string | null;
  printMaterial: PrintMaterial;
  printSize?: string | null;
  printInstructions?: string | null;
  rulesSummaryKeys: string[];
}

export interface CampaignRulesDto {
  minSlots: number;
  maxSlots: number;
  minLeadDays: number;
  minCampaignDays: number;
  maxCampaignDays: number;
  minRentPer30DaysPaise: number;
  maxRentPer30DaysPaise: number;
  maxPrintingAllowancePaise: number;
  maxPosterUploadBytes: number;
  minPosterWidthPx: number;
  commissionBps: number;
  gstBps: number;
  defaultInstallApprover: InstallApprover;
  policyChecklist: { key: string; labelKey: string }[];
}

export interface DriverAvailabilityDto {
  count: number;
  bucket: 'NONE' | 'FEW' | 'SOME' | 'MANY';
}

// ---------------------------------------------------------
// PHASE 6: ASSIGNMENTS & INSTALLATION
// ---------------------------------------------------------

export interface AssignmentDto {
  id: string;
  campaignId: string;
  campaignTitle?: string;
  driverId: string;
  vehicleId: string;
  vehicleRegistrationNumber?: string;
  status: AssignmentStatus;
  expiresAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  totalDays: number;
  windowDays?: number | null;
  runStartDate?: string | null;
  runEndDate?: string | null;
  dailyRentPaise: number;
  printingAllowancePaise: number;
  calculatedRentPaise?: number;
  releaseReason?: AssignmentReleaseReason | null;
  releasedAt?: string | null;
  installAttempts: number;
  extraAttemptsGranted: number;
  maxInstallAttempts: number;
  reviewOwner: ReviewOwner;
  escalatedAt?: string | null;
  reviewClaimedById?: string | null;
  reviewClaimedByName?: string | null;
  reviewClaimedAt?: string | null;
  nextAction: NextAction;
  nextActionDeadline?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InstallationPhotoDto {
  id: string;
  assignmentId: string;
  attemptNo: number;
  fileKey: string;
  fileUrl?: string | null;
  thumbnailUrl?: string | null;
  status: DailyPhotoStatus;
  latitude?: number | null;
  longitude?: number | null;
  accuracyMeters?: number | null;
  capturedAt: string;
  reviewReasonCodes?: { code: InstallRejectReason; note?: string }[] | null;
  duplicateFlags?: { isDuplicate: boolean; distance?: number; matchedPhotoId?: string } | null;
  rejectionReason?: string | null;
  verifiedAt?: string | null;
  createdAt: string;
}

export interface AssignmentDetailDto {
  assignment: AssignmentDto;
  campaign: {
    id: string;
    title: string;
    companyName: string;
    startDate: string;
    endDate: string;
    durationDays: number;
    cityName: string;
    printMaterial: PrintMaterial;
    printSize?: string | null;
    printInstructions?: string | null;
    posterDownloadUrl?: string | null;
    posterThumbnailUrl?: string | null;
  };
  installationPhotos: InstallationPhotoDto[];
  printGuide: {
    dimensions: string;
    material: PrintMaterial;
    instructions: string;
    checklist: { key: string; labelKey: string }[];
  };
  timeline: {
    step: string;
    status: 'COMPLETED' | 'CURRENT' | 'UPCOMING';
    timestamp?: string | null;
  }[];
}

export interface InstallationReviewQueueItemDto {
  assignmentId: string;
  campaignId: string;
  campaignTitle: string;
  driverId: string;
  driverName?: string | null;
  driverMobile?: string | null;
  vehicleRegistrationNumber: string;
  cityName: string;
  attemptNo: number;
  submittedAt: string;
  waitingMinutes: number;
  isSlaBreached: boolean;
  reviewOwner: ReviewOwner;
  claimedById?: string | null;
  claimedByName?: string | null;
  photoUrl: string;
  posterPreviewUrl?: string | null;
}

export interface CompanyInstallationItemDto {
  assignmentId: string;
  campaignId: string;
  driverCode: string;
  vehiclePlateMasked: string;
  cityName: string;
  attemptNo: number;
  submittedAt: string;
  reviewStatus: AssignmentStatus;
  photoUrl: string;
  posterPreviewUrl?: string | null;
}

export interface InstallationDecisionInputDto {
  decision: InstallReviewDecision;
  reasons?: { code: InstallRejectReason; note?: string }[];
  note?: string;
}

// ---------------------------------------------------------------------------
// Phase 7: Daily Photo Proof & Fraud DTOs
// ---------------------------------------------------------------------------

export interface AssignmentDayDto {
  id: string;
  assignmentId: string;
  date: string;
  status: DayStatus;
  verifiedPhotoId?: string | null;
  verifiedPhotoThumbnailUrl?: string | null;
  reasonCode?: string | null;
  excusedById?: string | null;
  excuseNote?: string | null;
  statusChangedAt?: string | null;
}

export interface DailyPhotoSubmissionDto {
  photoId: string;
  status: DailyPhotoStatus;
  dayStatus: DayStatus;
  attemptsLeftToday: number;
  autoCheckResult: {
    passed: boolean;
    riskScore: number;
    messageKey?: string;
  };
  reviewSource?: PhotoReviewSource | null;
}

export interface TodayStatusDto {
  dayStatus: DayStatus;
  cutoffTime: string;
  attemptsLeft: number;
  lastPhotoStatus?: DailyPhotoStatus | null;
  rejectReasons?: Array<{ code: DailyRejectReason; note?: string }>;
  isPastCutoff: boolean;
}

export interface AssignmentDaysSummaryDto {
  days: AssignmentDayDto[];
  totalDays: number;
  verifiedDays: number;
  missedDays: number;
  excusedDays: number;
  pendingDays: number;
  payableDays: number;
  graceDaysAllowed: number;
  graceDaysRemaining: number;
  earnedRentPaiseEstimate: number;
  projectedFinalRentPaise: number;
}

export interface DailyPhotoQueueItemDto {
  photoId: string;
  assignmentId: string;
  campaignId: string;
  campaignTitle: string;
  driverId: string;
  driverName?: string | null;
  driverMobile?: string | null;
  vehicleRegistrationNumber: string;
  cityName: string;
  date: string;
  capturedAt: string;
  photoUrl: string;
  thumbnailUrl?: string | null;
  reviewSource: PhotoReviewSource;
  riskScore: number;
  autoCheckFlags?: Record<string, unknown> | null;
  isSlaBreached: boolean;
  waitingMinutes: number;
  claimedById?: string | null;
  claimedByName?: string | null;
}

export interface DailyPhotoDetailDto {
  photo: DailyPhotoQueueItemDto;
  installationPhotoUrl?: string | null;
  previousDayPhotoUrl?: string | null;
  posterPreviewUrl?: string | null;
  driverStats: {
    totalSubmitted: number;
    verifiedCount: number;
    rejectedCount: number;
    missedDaysCount: number;
    recentRejectionCount30d: number;
  };
  flags: Array<{
    id: string;
    flaggedByRole: string;
    reason: PhotoFlagReason;
    note?: string | null;
    createdAt: string;
  }>;
}

export interface CompanyCampaignProgressDto {
  campaignId: string;
  totalVehicles: number;
  runningVehicles: number;
  todayExpectedPhotos: number;
  todayVerifiedPhotos: number;
  todayCoveragePercent: number;
  overallCoveragePercent: number;
  overallMissedRatePercent: number;
  dailySeries: Array<{
    date: string;
    expected: number;
    verified: number;
    underReview: number;
    missed: number;
  }>;
  zoneBreakdown: Array<{
    zoneId: string;
    zoneName: string;
    vehicleCount: number;
    verifiedToday: number;
  }>;
}

export interface DriverDailyPhotoItemDto {
  id: string;
  date: string | null;
  photoUrl: string;
  thumbnailUrl: string;
  status: DailyPhotoStatus;
  riskScore: number;
  reviewSource: string;
  attemptNo: number;
  capturedAt: string;
  rejectReasons: string[];
}

export interface CompanyDailyPhotoDto {
  id: string;
  date: string;
  zoneName: string;
  approxLat: number;
  approxLng: number;
  thumbnailUrl: string;
  driverCode: string;
  status: string;
  isFlagged: boolean;
  flagStatus?: PhotoFlagStatus | null;
}

export interface FraudOverviewDto {
  summary7d: {
    flagCount: number;
    autoFlaggedCount: number;
    rejectedCount: number;
  };
  summary30d: {
    flagCount: number;
    autoFlaggedCount: number;
    rejectedCount: number;
  };
  topFlaggedDrivers: Array<{
    driverId: string;
    driverName: string;
    flagCount: number;
    rejectCount: number;
  }>;
  sharedDevices: Array<{
    deviceInstallId: string;
    accountCount: number;
    accounts: string[];
  }>;
  stationaryAssignments: Array<{
    assignmentId: string;
    consecutiveDays: number;
    avgDistanceMeters: number;
  }>;
  nearDuplicateClusters: Array<{
    photoIds: string[];
    maxDistance: number;
  }>;
}

// ---------------------------------------------------------------------------
// Phase 8: Financial Ledger, Escrow, Payments and Payouts DTOs
// ---------------------------------------------------------------------------

export interface CampaignPaymentDto {
  id: string;
  campaignId: string;
  companyId: string;
  amountPaise: string;
  gatewayFeePaise: string;
  currency: string;
  gateway: string;
  gatewayOrderId: string | null;
  gatewayPaymentId: string | null;
  status: PaymentStatus;
  method: string | null;
  capturedAt: string | null;
  signatureVerifiedAt: string | null;
  orderExpiresAt: string | null;
  createdAt: string;
  campaign?: { id: string; title: string };
  taxDocuments?: Array<{ id: string; documentNumber: string; documentType: string; totalAmountPaise: string }>;
}

export interface PaymentOrderResultDto {
  paymentId: string;
  campaignId: string;
  amountPaise: string;
  currency: string;
  gateway: string;
  gatewayOrderId: string;
  orderExpiresAt: string;
  keyId?: string;
}

export interface RefundDto {
  id: string;
  campaignId: string;
  companyId: string;
  paymentId: string | null;
  amountPaise: string;
  reason: RefundReason;
  status: RefundStatus;
  notes: string | null;
  requestedById: string;
  approvedById: string | null;
  rejectedById: string | null;
  rejectionReason: string | null;
  gatewayRefundId: string | null;
  creditNoteId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssignmentSettlementDto {
  id: string;
  assignmentId: string;
  campaignId: string;
  driverId: string;
  status: SettlementStatus;
  totalDays: number;
  verifiedDays: number;
  missedDays: number;
  graceDaysUsed: number;
  payableDays: number;
  dailyRentPaise: string;
  rentPayablePaise: string;
  printingAllowancePaise: string;
  companyRefundPaise: string;
  commissionPaise: string;
  gstPaise: string;
  totalAmountPaise: string;
  anomalyFlags: Record<string, unknown> | null;
  holdReason: string | null;
  approvedById: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export interface TaxDocumentDto {
  id: string;
  documentType: TaxDocumentType;
  documentNumber: string;
  financialYear: string;
  sequenceNumber: number;
  campaignId: string;
  companyId: string;
  paymentId: string | null;
  taxableAmountPaise: string;
  cgstPaise: string;
  sgstPaise: string;
  igstPaise: string;
  totalAmountPaise: string;
  pdfUrl: string | null;
  issuedAt: string;
  createdAt: string;
}

export interface AdjustmentDto {
  id: string;
  accountId: string;
  accountCode?: string;
  amountPaise: string;
  direction: LedgerDirection;
  reason: string;
  status: AdjustmentStatus;
  requestedById: string;
  approvedById: string | null;
  rejectedById: string | null;
  rejectionReason: string | null;
  transactionId: string | null;
  createdAt: string;
}

export interface PayoutDto {
  id: string;
  driverId: string;
  assignmentId: string | null;
  payoutType: PayoutType;
  amountPaise: string;
  method: PayoutMethod;
  status: PayoutStatus;
  gatewayReference: string | null;
  failureReason: string | null;
  batchId: string | null;
  utr: string | null;
  provider: PayoutProviderName;
  requestedAt: string;
  approvedAt: string | null;
  processedAt: string | null;
}

export interface PayoutBatchDto {
  id: string;
  batchNumber: string;
  provider: PayoutProviderName;
  totalCount: number;
  totalAmountPaise: string;
  status: string;
  csvFileUrl: string | null;
  processedAt: string | null;
  createdAt: string;
  payouts?: PayoutDto[];
}

export interface DriverWalletDto {
  driverId: string;
  balancePaise: string;
  availablePaise: string;
  currency: string;
  activePayoutInTransitPaise: string;
  totalEarnedPaise: string;
  totalWithdrawnPaise: string;
}

export interface WalletStatementEntryDto {
  id: string;
  transactionId: string;
  refType: LedgerRefType;
  refId: string;
  description: string;
  direction: LedgerDirection;
  amountPaise: string;
  balanceAfterPaise: string;
  postedAt: string;
}

export interface FinanceDashboardDto {
  escrowBalancePaise: string;
  driverWalletBalancePaise: string;
  payoutInTransitPaise: string;
  platformRevenuePaise: string;
  gstPayablePaise: string;
  companyRefundPaise: string;
  gatewayClearingPaise: string;
  gatewayFeesPaise: string;
  pendingSettlementsCount: number;
  pendingPayoutsCount: number;
  pendingRefundsCount: number;
  paymentsEnabled: boolean;
  payoutsEnabled: boolean;
}

export interface LedgerAccountDto {
  id: string;
  code: string;
  accountType: LedgerAccountType;
  currency: string;
  userId: string | null;
  campaignId: string | null;
  balancePaise: string;
  isActive: boolean;
}

export interface LedgerTransactionDto {
  id: string;
  refType: LedgerRefType;
  refId: string;
  description: string;
  metadata: Record<string, unknown> | null;
  postedAt: string;
  entries: Array<{
    id: string;
    accountId: string;
    accountCode: string;
    accountType: LedgerAccountType;
    direction: LedgerDirection;
    amountPaise: string;
    balanceAfterPaise: string;
  }>;
}

export interface TrialBalanceDto {
  asOf: string;
  isBalanced: boolean;
  totalDebitsPaise: string;
  totalCreditsPaise: string;
  diffPaise: string;
  accounts: Array<{
    accountId: string;
    code: string;
    accountType: LedgerAccountType;
    debitPaise: string;
    creditPaise: string;
    netBalancePaise: string;
  }>;
}

export interface ReconciliationRunDto {
  id: string;
  runDate: string;
  status: string;
  trialBalanceDiffPaise: string;
  anomaliesFound: number;
  details: Record<string, unknown> | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Phase 9: Discipline, Disputes & Notifications DTOs
// ---------------------------------------------------------------------------

export interface StrikeDto {
  id: string;
  driverId: string;
  assignmentId?: string | null;
  reason: StrikeReason;
  status: StrikeStatus;
  source: StrikeSource;
  notes?: string | null;
  issuedAt: string;
  expiresAt: string;
  revokedAt?: string | null;
  revokeReason?: string | null;
  appealDeadlineAt: string;
  canAppeal: boolean;
}

export interface DriverBanDto {
  id: string;
  driverId: string;
  type: BanType;
  startsAt: string;
  endsAt?: string | null;
  reason: string;
  strikeIds: string[];
  liftedAt?: string | null;
  liftReason?: string | null;
}

export interface PosterFixNoticeDto {
  id: string;
  assignmentId: string;
  openedAt: string;
  deadlineAt: string;
  status: PosterFixStatus;
  sourcePhotoId?: string | null;
  resolvedPhotoId?: string | null;
}

export interface DriverDisciplineDto {
  activeStrikes: StrikeDto[];
  totalStrikesCount: number;
  isBanned: boolean;
  bannedUntil?: string | null;
  banReason?: string | null;
  activeNotices: PosterFixNoticeDto[];
  trustScore?: number;
}

export interface DisciplineRuleDto {
  strikeLimit: number;
  banDays: number;
  appealWindowDays: number;
  posterFixHours: number;
  strikeExpiryDays: number;
  rulesText: string[];
}

export interface DisputeMessageDto {
  id: string;
  disputeId: string;
  authorId: string;
  authorRole: Role;
  authorName?: string;
  body: string;
  visibleTo: DisputeMessageVisibility;
  createdAt: string;
}

export interface DisputeEvidenceDto {
  id: string;
  disputeId: string;
  uploadedByUserId: string;
  fileUrl: string;
  notes?: string | null;
  visibleToOtherParty: boolean;
  createdAt: string;
}

export interface DisputeEventDto {
  id: string;
  disputeId: string;
  type: string;
  actorId?: string | null;
  actorRole?: Role | null;
  data?: Record<string, unknown> | null;
  createdAt: string;
}

export interface DisputeDto {
  id: string;
  assignmentId?: string | null;
  campaignId?: string | null;
  campaignTitle?: string;
  photoId?: string | null;
  strikeId?: string | null;
  settlementId?: string | null;
  disputedDate?: string | null;
  raisedByUserId: string;
  raisedByRole: Role;
  againstParty: DisputeParty;
  reason: DisputeReason;
  details: string;
  status: DisputeStatus;
  claimedAmountPaise: string;
  heldAmountPaise: string;
  slaDueAt?: string | null;
  isSlaBreached: boolean;
  assignedToId?: string | null;
  assignedToName?: string | null;
  reviewLevel: number;
  resolutionType?: DisputeResolutionType | null;
  resolution?: string | null;
  resolutionToDriverPaise?: string | null;
  resolutionToCompanyPaise?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  reopenRequestedAt?: string | null;
  queue: DisputeQueue;
  createdAt: string;
  updatedAt: string;
}

export interface DisputeDetailDto {
  dispute: DisputeDto;
  messages: DisputeMessageDto[];
  evidences: DisputeEvidenceDto[];
  events: DisputeEventDto[];
  systemEvidence?: {
    photos?: any[];
    assignmentTimeline?: any[];
    strikeHistory?: StrikeDto[];
    settlementNumbers?: Record<string, unknown>;
  };
}

export interface DisputeDecisionPreviewDto {
  effects: Array<{
    effect: DisputeEffect;
    description: string;
    moneyChanges?: {
      driverPaise?: string;
      companyPaise?: string;
      escrowImpactPaise?: string;
    };
  }>;
  totalHeldPaise: string;
  releasedToDriverPaise: string;
  releasedToCompanyPaise: string;
}

export interface NotificationDto {
  id: string;
  userId: string;
  category: NotificationCategory;
  channel: NotificationChannel;
  priority: NotificationPriority;
  title: string;
  body: string;
  data?: Record<string, unknown> | null;
  groupKey?: string | null;
  status: NotificationStatus;
  sentAt?: string | null;
  readAt?: string | null;
  createdAt: string;
}

export interface NotificationPreferenceDto {
  category: NotificationCategory;
  channel: NotificationChannel;
  enabled: boolean;
  isLocked: boolean;
  lockReason?: string;
}

export interface UserNotificationSettingsDto {
  quietHoursStart: string;
  quietHoursEnd: string;
  language?: string | null;
}

export interface DeviceTokenDto {
  id: string;
  userId: string;
  token: string;
  platform: string;
  provider: string;
  appVersion?: string | null;
  lastRegisteredAt: string;
}

export interface AnnouncementDto {
  id: string;
  createdById: string;
  titleByLanguage: Record<string, string>;
  bodyByLanguage: Record<string, string>;
  audience: {
    roles?: Role[];
    cityIds?: string[];
    accountStatuses?: string[];
    activeOnly?: boolean;
  };
  scheduledFor?: string | null;
  status: AnnouncementStatus;
  counts: {
    target: number;
    sent: number;
    failed: number;
  };
  sentAt?: string | null;
  createdAt: string;
}

export interface NotificationStatsDto {
  period24h: {
    totalSent: number;
    totalFailed: number;
    byChannel: Record<string, { sent: number; failed: number }>;
  };
  period7d: {
    totalSent: number;
    totalFailed: number;
    byChannel: Record<string, { sent: number; failed: number }>;
  };
  topFailureReasons: Array<{ error: string; count: number }>;
  activeDeviceTokens: number;
  disabledDeviceTokens: number;
}







