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
  CompanyMemberRole,
  MemberStatus,
  InvitationStatus,
  ContactMessageStatus,
  CompanyPermission,
  ExportJobKind,
  ReportType,
  ReportStatus,
  AdSource,
  LocalAdCategory,
  LocalAdStatus,
  LocalAdFormat,
  LocalAdCtaType,
  LocalAdRejectReason,
  AdPlacement,
  InviteCodeStatus,
  WaitlistStatus,
  AnomalySeverity,
  AnomalyStatus,
  SecondLookOutcome,
  FeedbackCategory,
  FeedbackStatus,
  SupportRequestType,
  SupportRequestStatus,
  PrintShopStatus,
  DbEnvironment,
  PilotSignOffKey,
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

export interface AuthMeCompanySummary {
  id: string;
  name: string;
  memberId: string;
  memberRole: CompanyMemberRole;
  permissions: CompanyPermission[];
  status: AccountStatus;
  isVerified: boolean;
  kycStatus: KycSubmissionStatus | 'NOT_SUBMITTED';
}

export interface AuthMeResponse {
  user: AuthUser;
  role: Role;
  status: AccountStatus;
  permissions: string[];
  company?: AuthMeCompanySummary;
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

// ---------------------------------------------------------
// Phase 11 Company Team, Billing, & Public Contracts
// ---------------------------------------------------------

export interface CompanyMemberDto {
  id: string;
  companyId: string;
  userId: string;
  role: CompanyMemberRole;
  status: MemberStatus;
  email: string | null;
  mobile: string;
  invitedById?: string | null;
  joinedAt: string;
  createdAt: string;
}

export interface CompanyInvitationDto {
  id: string;
  companyId: string;
  email: string;
  mobile: string;
  role: CompanyMemberRole;
  status: InvitationStatus;
  expiresAt: string;
  invitedById: string;
  createdAt: string;
}

export interface BillingProfileDto {
  id: string;
  companyId: string;
  legalName: string;
  gstin?: string | null;
  billingAddress: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pinCode: string;
  };
  stateCode: string;
  invoiceEmails: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ContactMessageDto {
  id: string;
  name: string;
  email: string;
  mobile?: string | null;
  message: string;
  language: string;
  status: ContactMessageStatus;
  replyNote?: string | null;
  handledById?: string | null;
  ip?: string | null;
  createdAt: string;
}

export interface CompanyContextDto {
  companyId: string;
  memberId: string;
  memberRole: CompanyMemberRole;
  permissions: CompanyPermission[];
  status: AccountStatus;
  isVerified: boolean;
}

export interface InviteCompanyMemberInput {
  email: string;
  mobile: string;
  role: CompanyMemberRole;
}

export interface AcceptCompanyInvitationInput {
  token: string;
  password?: string;
  name?: string;
}

export interface UpdateCompanyMemberRoleInput {
  role: CompanyMemberRole;
}

export interface TransferOwnershipInput {
  memberId: string;
  stepUpCode?: string;
}

export interface UpdateBillingProfileInput {
  legalName?: string;
  gstin?: string;
  billingAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pinCode: string;
  };
  stateCode?: string;
  invoiceEmails?: string[];
  stepUpCode?: string;
}

export interface CancelPreviewDto {
  campaignId: string;
  canCancel: boolean;
  totalAssignments: number;
  releasedAssignmentsCount: number;
  noticeActiveAssignmentsCount: number;
  noticeEndAt: string | null;
  totalPaidPaise: number;
  driverCompensationPaise: number;
  platformFeeRetainedPaise: number;
  printingAllowanceSpentPaise: number;
  estimatedRefundPaise: number;
  nonRefundablePaise: number;
  reasonRequired: boolean;
}

export interface PricingPreviewInput {
  slots: number;
  days: number;
  rentPer30DaysPaise?: number;
  printingAllowancePaise?: number;
}

export interface PricingPreviewDto {
  slots: number;
  days: number;
  dailyRentPerAutoPaise: number;
  totalRentPaise: number;
  printingAllowancePaise: number;
  totalPrintingPaise: number;
  subtotalPaise: number;
  platformFeePaise: number;
  gstPaise: number;
  totalCostPaise: number;
  typicalRange: {
    minPaise: number;
    maxPaise: number;
  };
}

export interface CompanyDashboardKpisDto {
  activeCampaigns: number;
  driversRunning: number;
  photosVerifiedToday: number;
  todayCoveragePercent: number;
  sevenDayAvgCoveragePercent: number;
  monthSpendPaise: number;
  monthRefundsPaise: number;
}

export interface CompanyPendingActionDto {
  id: string;
  type: 'PAYMENT_DUE' | 'REJECTED_CAMPAIGN' | 'INSTALLATION_REVIEW' | 'DISPUTE_UPDATE' | 'EXPIRING_INVITATION';
  title: string;
  description: string;
  deadlineAt?: string | null;
  actionUrl: string;
  primaryActionLabel: string;
}

export interface CompanyDashboardResponseDto {
  kpis: CompanyDashboardKpisDto;
  pendingActions: CompanyPendingActionDto[];
  recentCampaigns: Array<{
    id: string;
    title: string;
    status: CampaignStatus;
    slots: number;
    startDate: string;
    endDate: string;
  }>;
  onboardingChecklist: {
    isKycApproved: boolean;
    hasCreatedCampaign: boolean;
    hasPaidCampaign: boolean;
    hasReceivedPhotos: boolean;
  };
}

// -------------------------------------------------------------
// Driver Aggregated Home & Mobile Experience (Phase 12)
// -------------------------------------------------------------

export interface DriverHomeTodayDto {
  status: 'PENDING' | 'SUBMITTED' | 'VERIFIED' | 'REJECTED' | 'EXCUSED' | 'MISSED' | 'NO_ASSIGNMENT';
  windowOpen: boolean;
  cutoffTime: string;
  attemptsLeft: number;
  rejectionReason?: string | null;
  canRetake: boolean;
  currentPhotoThumbnailUrl?: string | null;
}

export interface DriverHomeActiveAssignmentDto {
  id: string;
  campaignId: string;
  campaignTitle: string;
  vehicleRegistrationNumber: string;
  status: AssignmentStatus;
  nextAction: string;
  nextActionDeadline: string;
  startedAt?: string | null;
  endsAt?: string | null;
  posterThumbnailUrl?: string | null;
}

export interface DriverHomeEarningsDto {
  availablePaise: number;
  balancePaise: number;
  inTransitPaise: number;
  lifetimeEarnedPaise: number;
  projectedFinalRentPaise: number;
  graceDaysAllowed: number;
  graceDaysUsed: number;
  graceDaysRemaining: number;
}

export interface DriverHomeDisciplineDto {
  activeStrikes: number;
  isBanned: boolean;
  banEndsAt?: string | null;
  posterFixDeadline?: string | null;
  hasActiveNotice: boolean;
}

export interface DriverHomeResponseDto {
  today: DriverHomeTodayDto;
  activeAssignment: DriverHomeActiveAssignmentDto | null;
  earnings: DriverHomeEarningsDto;
  discipline: DriverHomeDisciplineDto;
  unreadNotificationsCount: number;
  pendingQueueCount: number;
}

export interface DriverCaptureRulesDto {
  version: number;
  gpsMaxAccuracyMeters: number;
  photoMaxAgeMinutes: number;
  dailyAttemptsLimit: number;
  installAttemptsLimit: number;
  lateUploadGraceHours: number;
  clockSkewFlagMinutes: number;
  compressionHints: {
    maxDimension: number;
    jpegQuality: number;
  };
}

export interface AppConfigAdsDto {
  enabled: boolean;
  localAdsEnabled: boolean;
  placements: Record<string, boolean>;
  maxPerScreen: number;
  listEveryN: number;
  disableOnSlowNetwork: boolean;
  personalizedDefault: boolean;
  maxContentRating: 'G' | 'PG' | 'T' | 'MA';
}

export interface PublicAppConfigDto {
  minVersion: string;
  latestVersion: string;
  maintenance: boolean;
  maintenanceMessage: string | null;
  environment: string;
  ads?: AppConfigAdsDto;
}

export interface DriverOnboardingDto {
  driverProfile: {
    id: string;
    userId: string;
    fullName: string | null;
    cityId: string | null;
    cityName?: string | null;
    zoneId: string | null;
    operatingZoneIds: string[];
    isProfileComplete: boolean;
  };
  vehicle: {
    id: string;
    registrationNumber: string;
    isOwner: boolean;
    ownerName?: string | null;
    ownerMobile?: string | null;
    isVerified: boolean;
  } | null;
  documents: Array<{
    id: string;
    type: string;
    status: string;
    fileUrl?: string;
  }>;
  payoutDetails: {
    type: 'UPI' | 'BANK';
    maskedIdentifier: string;
    isVerified: boolean;
  } | null;
  consents: Array<{
    type: string;
    version: string;
    agreedAt: string;
  }>;
  kycSubmission: {
    id: string;
    status: KycSubmissionStatus;
    submittedAt?: string;
    reviewedAt?: string;
    decisionNote?: string | null;
    rejectionReasons?: string[];
  } | null;
}

export interface UpdateDriverProfileInput {
  fullName: string;
  cityId: string;
  zoneId?: string;
  operatingZoneIds?: string[];
}

export interface UpdateDriverVehicleInput {
  registrationNumber: string;
  isOwner: boolean;
  ownerName?: string;
  ownerMobile?: string;
}

export interface AddDriverDocumentInput {
  uploadedFileId: string;
  type: string;
}

export interface UpdateDriverPayoutDetailsInput {
  type: 'UPI' | 'BANK';
  upiId?: string;
  accountNumber?: string;
  ifscCode?: string;
  accountHolderName?: string;
}

export interface SubmitDriverConsentsInput {
  consents: Array<{
    type: string;
    version: string;
  }>;
}

// ============================================================================
// Phase 13: Reports & Ads DTOs
// ============================================================================

export interface GeneratedReportDto {
  id: string;
  publicId: string;
  type: ReportType;
  subjectType: string;
  subjectId: string;
  language: string;
  status: ReportStatus;
  version: number;
  isFinal: boolean;
  fileUrl?: string | null;
  fileSha256?: string | null;
  snapshotHash: string;
  snapshot: Record<string, any>;
  requestedById?: string | null;
  generatedAt?: string | null;
  failedReason?: string | null;
  expiresAt?: string | null;
  createdAt: string;
}

export interface PublicReportVerifyDto {
  valid: boolean;
  publicId: string;
  type: ReportType;
  subjectTitle: string;
  companyName?: string;
  generatedAt: string;
  version: number;
  isFinal: boolean;
  hashMatches: boolean;
}

export interface LocalAdvertiserDto {
  id: string;
  businessName: string;
  category: LocalAdCategory;
  contactName: string;
  contactMobile: string;
  contactEmail?: string | null;
  address?: string | null;
  cityId?: string | null;
  status: string;
  notes?: string | null;
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LocalAdDto {
  id: string;
  advertiserId: string;
  advertiserName?: string;
  titleByLanguage: Record<string, string>;
  bodyByLanguage: Record<string, string>;
  imageFileKey: string;
  imageUrl?: string;
  format: LocalAdFormat;
  ctaType: LocalAdCtaType;
  ctaValue: string;
  targeting?: {
    cityIds?: string[];
    zoneIds?: string[];
  };
  startDate: string;
  endDate: string;
  priority: number;
  weight: number;
  dailyImpressionCap?: number | null;
  pricingModel: string;
  agreedAmountPaise: string;
  status: LocalAdStatus;
  reviewedById?: string | null;
  reviewReasonCodes?: string[] | null;
  reviewNote?: string | null;
  createdById: string;
  pausedReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ServedLocalAdDto {
  id: string;
  advertiserName: string;
  title: string;
  body: string;
  imageUrl: string;
  format: LocalAdFormat;
  ctaType: LocalAdCtaType;
  ctaValue: string;
}

export interface AdPlacementHealthDto {
  date: string;
  placement: string;
  source: AdSource;
  loaded: number;
  failed: number;
  impressions: number;
  clicks: number;
  fillRate: number;
  ctr: number;
  hasCtrAlert: boolean;
}

export interface AdRevenueEntryDto {
  id: string;
  month: string;
  source: string;
  advertiserId?: string | null;
  advertiserName?: string | null;
  amountPaise: string;
  currencyNote: string;
  note?: string | null;
  enteredById: string;
  enteredByEmail?: string;
  createdAt: string;
}

// ============================================================================
// Phase 15: Pilot Launch, Guardrails, Rehearsal and Operations
// ============================================================================

export interface InviteCodeDto {
  id: string;
  code: string;
  targetRole: Role;
  cityId?: string | null;
  cityName?: string | null;
  label?: string | null;
  maxUses: number;
  usedCount: number;
  expiresAt?: string | null;
  status: InviteCodeStatus;
  createdById?: string | null;
  createdByEmail?: string | null;
  createdAt: string;
  updatedAt: string;
  conversions?: {
    registeredCount: number;
    kycApprovedCount: number;
    campaignSelectedCount: number;
    firstPaymentCount: number;
  };
}

export interface CreateInviteCodeInput {
  code?: string;
  targetRole: Role;
  cityId?: string | null;
  label?: string | null;
  maxUses?: number;
  expiresAt?: string | null;
}

export interface BatchCreateInviteCodesInput {
  count: number;
  targetRole: Role;
  cityId?: string | null;
  label?: string | null;
  maxUses?: number;
  expiresAt?: string | null;
}

export interface WaitlistEntryDto {
  id: string;
  role: Role;
  name?: string | null;
  contactMasked: string;
  cityName: string;
  language: string;
  source: string;
  status: WaitlistStatus;
  invitedByCodeId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WaitlistSubmitInput {
  role: Role;
  name?: string;
  contact: string;
  cityName: string;
  language?: string;
  source?: string;
  consent: boolean;
  honeypot?: string;
}

export interface AnomalyFindingDto {
  id: string;
  rule: string;
  severity: AnomalySeverity;
  subjectType: string;
  subjectId: string;
  summary: string;
  details?: Record<string, unknown> | null;
  status: AnomalyStatus;
  notes?: string | null;
  resolvedById?: string | null;
  resolvedByEmail?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewSecondLookDto {
  id: string;
  entityType: string;
  entityId: string;
  firstReviewerId: string;
  firstReviewerEmail?: string;
  secondReviewerId?: string | null;
  secondReviewerEmail?: string | null;
  firstDecision: string;
  secondDecision?: string | null;
  outcome: SecondLookOutcome;
  note?: string | null;
  escalatedToSuperAdmin: boolean;
  superAdminResolution?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

export interface FeedbackDto {
  id: string;
  userId?: string | null;
  userEmail?: string | null;
  role: Role;
  category: FeedbackCategory;
  rating?: number | null;
  text: string;
  screenName?: string | null;
  appVersion?: string | null;
  platform?: string | null;
  attachmentFileKey?: string | null;
  attachmentUrl?: string | null;
  status: FeedbackStatus;
  tags: string[];
  handledById?: string | null;
  handledByEmail?: string | null;
  handledNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFeedbackInput {
  category: FeedbackCategory;
  rating?: number;
  text: string;
  screenName?: string;
  appVersion?: string;
  platform?: string;
  attachmentFileKey?: string;
}

export interface SupportRequestDto {
  id: string;
  userId: string;
  userMobileMasked?: string;
  userEmail?: string | null;
  role: Role;
  type: SupportRequestType;
  body: string;
  language: string;
  preferredCallWindow?: string | null;
  status: SupportRequestStatus;
  assignedToId?: string | null;
  assignedToEmail?: string | null;
  notes?: string | null;
  slaDueAt: string;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupportRequestInput {
  type: SupportRequestType;
  body: string;
  preferredCallWindow?: string;
}

export interface PrintShopDto {
  id: string;
  name: string;
  address: string;
  cityId?: string | null;
  cityName?: string | null;
  zoneId?: string | null;
  zoneName?: string | null;
  phone: string;
  whatsapp?: string | null;
  mapsUrl?: string | null;
  priceNote?: string | null;
  openingHours?: string | null;
  languagesSpoken: string[];
  status: PrintShopStatus;
  notes?: string | null;
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePrintShopInput {
  name: string;
  address: string;
  cityId?: string;
  zoneId?: string;
  phone: string;
  whatsapp?: string;
  mapsUrl?: string;
  priceNote?: string;
  openingHours?: string;
  languagesSpoken?: string[];
  notes?: string;
}

export interface UpdatePrintShopInput extends Partial<CreatePrintShopInput> {
  status?: PrintShopStatus;
}

export interface PilotCountersDto {
  driversCount: number;
  driversCap: number;
  companiesCount: number;
  companiesCap: number;
  activeCampaignsCount: number;
  activeCampaignsCap: number;
  totalEscrowPaise: string;
  totalEscrowCapPaise: string;
  todayPayoutPaise: string;
  todayPayoutCapPaise: string;
  openCityIds: string[];
  inviteOnly: boolean;
  pilotModeEnabled: boolean;
}

export interface PilotCounters {
  activeDrivers: number;
  maxDrivers: number;
  activeCompanies: number;
  maxCompanies: number;
  activeCampaigns: number;
  maxActiveCampaigns: number;
  maxSlotsPerCampaign: number;
  totalEscrowPaise: string;
  maxTotalEscrowPaise: string;
  todayPayoutsPaise: string;
  maxDailyPayoutsPaise: string;
  maxDriverDailyPayoutPaise: string;
  isInviteOnlyDrivers: boolean;
  isInviteOnlyCompanies: boolean;
  isPilotActive: boolean;
}

export interface PilotCommandCenterDto {
  counters: PilotCountersDto;
  kycFunnel: {
    submitted: number;
    underReview: number;
    approved: number;
    rejected: number;
    avgTurnaroundHours: number;
  };
  dailyPhotos: {
    expected: number;
    received: number;
    verified: number;
    underReview: number;
    missed: number;
    coveragePercent: number;
  };
  reviewQueues: {
    kycPending: number;
    campaignPending: number;
    installationPending: number;
    dailyPhotoPending: number;
    disputesOpen: number;
    settlementsPending: number;
    payoutsPending: number;
    refundsPending: number;
    slaBreachesCount: number;
  };
  money: {
    escrowPaise: string;
    todayPaymentsPaise: string;
    todayPayoutsPaise: string;
    pendingPayoutsPaise: string;
    reconciliationOk: boolean;
  };
  discipline: {
    activeStrikes: number;
    activeBans: number;
    openFixNotices: number;
  };
  support: {
    openCallbacks: number;
    openHelpTickets: number;
    feedbackCountToday: number;
  };
  reliability: {
    errorRatePercent: number;
    crashFreeSessionsPercent: number;
    queueLagSeconds: number;
    workerHeartbeatOk: boolean;
  };
  anomalies: AnomalyFindingDto[];
  attentionItems: {
    title: string;
    severity: AnomalySeverity;
    count: number;
    link: string;
  }[];
}

export interface PilotCommandCenter {
  counters: PilotCounters;
  readiness: LaunchReadiness;
  anomalies: {
    totalOpen: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  pendingSecondLooks: number;
  feedback: {
    avgRating: number;
    avgNps: number;
    recent: any[];
  };
  support: {
    openTickets: number;
    openCallbacks: number;
  };
}

export interface LaunchReadinessItem {
  id: string;
  title: string;
  category: 'SECURITY' | 'DATABASE' | 'MONITORING' | 'SETTINGS' | 'LEGAL' | 'OPERATIONS';
  status: 'PASS' | 'FAIL' | 'MANUAL';
  blocking: boolean;
  attestedBy?: string | null;
  attestedAt?: string | null;
  remediation: string;
  details?: string | null;
}

export interface LaunchReadinessResponse {
  isLaunchReady: boolean;
  environment: DbEnvironment;
  items: LaunchReadinessItem[];
  missingBlockingCount: number;
  totalItems: number;
}

export interface PilotSignOff {
  key: PilotSignOffKey;
  label: string;
  description: string;
  attested: boolean;
  attestedBy?: string | null;
  attestedByEmail?: string | null;
  attestedAt?: string | null;
  notes?: string | null;
  ipAddress?: string | null;
}

export interface LaunchReadiness {
  environment: DbEnvironment;
  overallStatus: 'READY' | 'WARNING' | 'BLOCKED';
  allSignOffsComplete: boolean;
  signOffs: PilotSignOff[];
  checks: Array<{
    id: string;
    name: string;
    status: 'PASS' | 'WARN' | 'FAIL';
    message: string;
  }>;
  checkedAt: string;
}

export interface ClockState {
  simulatedTime: string;
  simulatedTimeIst: string;
  todayIst: string;
  offsetMs: number;
  isRealTime: boolean;
  environment: string;
}

export interface LaunchSignOffAttestationInput {
  signOffKey: PilotSignOffKey;
  evidenceNote: string;
}

export interface ClockStateDto {
  systemTime: string;
  effectiveTime: string;
  offsetSeconds: number;
  isClockShifted: boolean;
  clockControlEnabled: boolean;
}

export interface AdvanceClockInput {
  days?: number;
  hours?: number;
  minutes?: number;
}

export interface PilotReportNoteDto {
  id: string;
  weekIdentifier: string;
  narrative: string;
  status: 'DRAFT' | 'FINALISED';
  authorId: string;
  authorEmail?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavePilotReportNoteInput {
  weekIdentifier: string;
  narrative: string;
  finalise?: boolean;
}










