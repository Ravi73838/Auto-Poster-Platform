import { z } from 'zod';
import {
  SUPPORTED_LANGUAGES,
  SUPPORTED_THEMES,
  SETTING_KEYS,
  type SettingKey,
  ROLES,
  ACCOUNT_STATUS,
  DOCUMENT_TYPES,
  DOCUMENT_STATUS,
  PAYOUT_METHODS,
  FILE_PURPOSES,
  CONSENT_TYPES,
  KYC_REASON_CODES,
  KYC_SUBMISSION_STATUS,
  CAMPAIGN_STATUS,
  INSTALL_APPROVERS,
  VEHICLE_TYPES,
  CAMPAIGN_REVIEW_REASONS,
  PRINT_MATERIALS,
  CAMPAIGN_SORTS,
  CAMPAIGN_REVIEW_DECISIONS,
  ASSIGNMENT_STATUS,
  ASSIGNMENT_RELEASE_REASONS,
  INSTALL_REJECT_REASONS,
  INSTALL_REVIEW_DECISIONS,
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
  LEDGER_DIRECTIONS,
  LEDGER_ACCOUNT_TYPES,
  STRIKE_REASONS,
  DISPUTE_REASONS,
  DISPUTE_RESOLUTION_TYPES,
  DISPUTE_MESSAGE_VISIBILITY,
  DISPUTE_EFFECTS,
  NOTIFICATION_CATEGORIES,
  DEVICE_PUSH_PROVIDERS,
  TERMINATION_REASONS,
} from '@ap/shared-constants';


/**
 * Normalizes Indian mobile number strings into canonical E.164 format: +91XXXXXXXXXX.
 */
export function normalizeIndianMobile(raw: string): string {
  const cleaned = raw.replace(/[\s\-().]/g, '');
  if (/^\+91[6-9]\d{9}$/.test(cleaned)) {
    return cleaned;
  }
  if (/^91[6-9]\d{9}$/.test(cleaned)) {
    return `+${cleaned}`;
  }
  if (/^0[6-9]\d{9}$/.test(cleaned)) {
    return `+91${cleaned.slice(1)}`;
  }
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }
  return cleaned;
}

export const mobileSchema = z
  .string()
  .trim()
  .transform(normalizeIndianMobile)
  .refine((val) => /^\+91[6-9]\d{9}$/.test(val), {
    message: 'Invalid Indian mobile number. Must be a 10-digit number starting with 6-9.',
  });

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email({ message: 'Invalid email address.' });

export const COMMON_PASSWORDS = new Set([
  'password123',
  'password1234',
  '1234567890',
  'qwerty1234',
  'welcome123',
  'admin12345',
  'letmein123',
  'iloveyou12',
  'adminpassword123',
  'demopassword123',
]);

export const passwordSchema = z
  .string()
  .min(10, { message: 'Password must be at least 10 characters long.' })
  .refine((pwd) => /[a-zA-Z]/.test(pwd), {
    message: 'Password must contain at least one letter.',
  })
  .refine((pwd) => /\d/.test(pwd), {
    message: 'Password must contain at least one digit.',
  })
  .refine((pwd) => !COMMON_PASSWORDS.has(pwd.toLowerCase()), {
    message: 'Password is too common or easily guessable.',
  });

export const indianMobilePhoneSchema = mobileSchema;

export const uuidSchema = z.string().uuid({
  message: 'Invalid UUID identifier.',
});

export const idParamSchema = z.object({
  id: uuidSchema,
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(10),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const languageSchema = z.enum(
  SUPPORTED_LANGUAGES as unknown as [string, ...string[]],
);

export const themeSchema = z.enum(
  SUPPORTED_THEMES as unknown as [string, ...string[]],
);

export const SETTING_SCHEMAS = {
  [SETTING_KEYS.COMMISSION_RATE_BPS]: z.coerce.number().int().min(0).max(10000),
  [SETTING_KEYS.GST_RATE_BPS]: z.coerce.number().int().min(0).max(10000),
  [SETTING_KEYS.DEFAULT_PRINTING_ALLOWANCE_PAISE]: z.coerce.number().int().positive(),
  [SETTING_KEYS.DEFAULT_DAILY_RENT_PAISE]: z.coerce.number().int().positive(),
  [SETTING_KEYS.MIN_DAYS]: z.coerce.number().int().positive(),
  [SETTING_KEYS.MAX_DAYS]: z.coerce.number().int().positive(),
  [SETTING_KEYS.DAILY_PHOTO_START_HOUR]: z.coerce.number().int().min(0).max(23),
  [SETTING_KEYS.DAILY_PHOTO_END_HOUR]: z.coerce.number().int().min(0).max(23),
  [SETTING_KEYS.GRACE_PERIOD_HOURS]: z.coerce.number().int().min(0),
  [SETTING_KEYS.MAX_STRIKES_BEFORE_SUSPENSION]: z.coerce.number().int().positive(),
  [SETTING_KEYS.AUTO_APPROVE_INSTALLATION_AFTER_HOURS]: z.coerce.number().int().min(0),
  [SETTING_KEYS.PAYOUT_HOLD_DAYS]: z.coerce.number().int().min(0),
  [SETTING_KEYS.OTP_LENGTH]: z.coerce.number().int().min(4).max(10),
  [SETTING_KEYS.OTP_TTL_SECONDS]: z.coerce.number().int().min(60).max(1800),
  [SETTING_KEYS.OTP_MAX_ATTEMPTS]: z.coerce.number().int().min(1).max(20),
  [SETTING_KEYS.OTP_RESEND_COOLDOWN_SECONDS]: z.coerce.number().int().min(5).max(300),
  [SETTING_KEYS.OTP_DAILY_LIMIT_PER_TARGET]: z.coerce.number().int().min(1).max(100),
  [SETTING_KEYS.LOGIN_MAX_FAILURES]: z.coerce.number().int().min(1).max(50),
  [SETTING_KEYS.LOGIN_LOCK_MINUTES]: z.coerce.number().int().min(1).max(1440),
  [SETTING_KEYS.MAX_SESSIONS_PER_USER]: z.coerce.number().int().min(1).max(20),
  [SETTING_KEYS.TERMS_VERSION]: z.string().min(1),
  [SETTING_KEYS.PRIVACY_VERSION]: z.string().min(1),
  [SETTING_KEYS.POSTER_POLICY_VERSION]: z.string().min(1),
  [SETTING_KEYS.UPLOAD_MAX_BYTES]: z.coerce.number().int().positive(),
  [SETTING_KEYS.SIGNED_URL_TTL_SECONDS]: z.coerce.number().int().positive(),
  [SETTING_KEYS.MAX_SLOTS_PER_CAMPAIGN]: z.coerce.number().int().min(1).max(10000),
  [SETTING_KEYS.MIN_LEAD_DAYS]: z.coerce.number().int().min(0).max(30),
  [SETTING_KEYS.MAX_CAMPAIGN_DAYS]: z.coerce.number().int().min(1).max(365),
  [SETTING_KEYS.MIN_CAMPAIGN_DAYS]: z.coerce.number().int().min(1).max(365),
  [SETTING_KEYS.MIN_RENT_PER_30_DAYS_PAISE]: z.coerce.number().int().min(0),
  [SETTING_KEYS.MAX_RENT_PER_30_DAYS_PAISE]: z.coerce.number().int().min(0),
  [SETTING_KEYS.MAX_PRINTING_ALLOWANCE_PAISE]: z.coerce.number().int().min(0),
  [SETTING_KEYS.CAMPAIGN_REVIEW_SLA_HOURS]: z.coerce.number().int().min(1).max(168),
  [SETTING_KEYS.MIN_PAYMENT_LEAD_DAYS]: z.coerce.number().int().min(0).max(30),
  [SETTING_KEYS.MAX_POSTER_UPLOAD_BYTES]: z.coerce.number().int().positive(),
  [SETTING_KEYS.MIN_POSTER_WIDTH_PX]: z.coerce.number().int().positive(),
  [SETTING_KEYS.PAYMENT_DEADLINE_DAYS]: z.coerce.number().int().min(1).max(30),
  [SETTING_KEYS.ENROLMENT_CLOSE_DAYS_AFTER_START]: z.coerce.number().int().min(0).max(30),
  [SETTING_KEYS.DEFAULT_INSTALL_APPROVER]: z.enum([
    INSTALL_APPROVERS.PLATFORM,
    INSTALL_APPROVERS.COMPANY,
  ]),
  [SETTING_KEYS.COMMISSION_BPS]: z.coerce.number().int().min(0).max(10000),
  [SETTING_KEYS.GST_BPS]: z.coerce.number().int().min(0).max(10000),
  [SETTING_KEYS.RESERVATION_HOLD_HOURS]: z.coerce.number().int().min(1).max(168),
  [SETTING_KEYS.MAX_INSTALL_ATTEMPTS]: z.coerce.number().int().min(1).max(10),
  [SETTING_KEYS.COMPANY_INSTALL_REVIEW_SLA_HOURS]: z.coerce.number().int().min(1).max(168),
  [SETTING_KEYS.PHOTO_MAX_AGE_MINUTES]: z.coerce.number().int().min(1).max(1440),
  [SETTING_KEYS.PHOTO_MAX_DISTANCE_METERS]: z.coerce.number().int().min(10).max(50000),
  [SETTING_KEYS.PHOTO_DHASH_THRESHOLD]: z.coerce.number().int().min(0).max(64),
  [SETTING_KEYS.MAX_DAILY_ATTEMPTS]: z.coerce.number().int().min(1).max(20),
  [SETTING_KEYS.DAILY_PHOTO_LATE_GRACE_HOURS]: z.coerce.number().int().min(0).max(48),
  [SETTING_KEYS.DAILY_GPS_SCOPE]: z.enum(['CITY', 'CAMPAIGN_AREA']),
  [SETTING_KEYS.STATIONARY_DAYS_FLAG]: z.coerce.number().int().min(1).max(30),
  [SETTING_KEYS.STATIONARY_RADIUS_METERS]: z.coerce.number().int().min(1).max(1000),
  [SETTING_KEYS.DAILY_REVIEW_SLA_HOURS]: z.coerce.number().int().min(1).max(168),
  [SETTING_KEYS.COMPANY_FLAGS_PER_DAY_LIMIT]: z.coerce.number().int().min(1).max(100),
  [SETTING_KEYS.SAMPLING_MULTIPLIER_AFTER_REJECT]: z.coerce.number().min(1).max(10),
  [SETTING_KEYS.DAILY_PHOTO_LAST_REMINDER_TIME]: z.string().regex(/^\d{2}:\d{2}$/),
  [SETTING_KEYS.CLOCK_SKEW_FLAG_MINUTES]: z.coerce.number().int().min(1).max(120),
  [SETTING_KEYS.DAILY_PHOTO_HOURS_START]: z.string().regex(/^\d{2}:\d{2}$/),
  [SETTING_KEYS.DAILY_PHOTO_HOURS_END]: z.string().regex(/^\d{2}:\d{2}$/),
  [SETTING_KEYS.PHASH_SAME_ASSIGNMENT_THRESHOLD]: z.coerce.number().int().min(0).max(64),
  [SETTING_KEYS.RISK_AUTO_VERIFY_MAX_SCORE]: z.coerce.number().int().min(0).max(100),
  [SETTING_KEYS.PHOTO_RETENTION_MONTHS]: z.coerce.number().int().min(1).max(60),
  [SETTING_KEYS.RISK_WEIGHTS]: z.record(z.string(), z.number()),
  [SETTING_KEYS.RANDOM_REVIEW_PERCENT]: z.coerce.number().int().min(0).max(100),
  [SETTING_KEYS.DAILY_PHOTO_REMINDER_TIME]: z.string().regex(/^\d{2}:\d{2}$/),
  [SETTING_KEYS.PHASH_DUPLICATE_THRESHOLD]: z.coerce.number().int().min(0).max(64),
  [SETTING_KEYS.GRACE_DAYS]: z.coerce.number().int().min(0).max(30),
  [SETTING_KEYS.LEDGER_ALLOW_NEGATIVE_BALANCE]: z.boolean(),
  [SETTING_KEYS.PAYOUT_AUTO_APPROVE_MAX_PAISE]: z.coerce.number().int().min(0),
  [SETTING_KEYS.PAYOUT_MIN_WITHDRAWAL_PAISE]: z.coerce.number().int().min(0),
  [SETTING_KEYS.PAYOUT_MANUAL_REVIEW_THRESHOLD_PAISE]: z.coerce.number().int().min(0),
  [SETTING_KEYS.PAYOUT_SLA_HOURS]: z.coerce.number().int().min(1).max(720),
  [SETTING_KEYS.SETTLEMENT_GRACE_DAYS_DEFAULT]: z.coerce.number().int().min(0).max(30),
  [SETTING_KEYS.SETTLEMENT_AUTO_APPROVE_DELAY_HOURS]: z.coerce.number().int().min(0).max(168),
  [SETTING_KEYS.FINANCE_PAYMENTS_ENABLED]: z.boolean(),
  [SETTING_KEYS.FINANCE_PAYOUTS_ENABLED]: z.boolean(),
  [SETTING_KEYS.FINANCE_TDS_RATE_BPS]: z.coerce.number().int().min(0).max(10000),
  [SETTING_KEYS.FINANCE_COMPANY_GSTIN]: z.string().min(15).max(15),
  [SETTING_KEYS.FINANCE_STATE_CODE]: z.string().min(2).max(2),
  [SETTING_KEYS.FINANCE_INVOICE_PREFIX]: z.string().min(1).max(10),
  [SETTING_KEYS.FINANCE_CREDIT_NOTE_PREFIX]: z.string().min(1).max(10),
  [SETTING_KEYS.STRIKE_EXPIRY_DAYS]: z.coerce.number().int().positive(),
  [SETTING_KEYS.POSTER_FIX_HOURS]: z.coerce.number().int().positive(),
  [SETTING_KEYS.CONSECUTIVE_MISSED_DAYS_STRIKE]: z.coerce.number().int().min(0),
  [SETTING_KEYS.ABANDON_DAYS_TERMINATE]: z.coerce.number().int().min(0),
  [SETTING_KEYS.APPEAL_WINDOW_DAYS]: z.coerce.number().int().positive(),
  [SETTING_KEYS.SETTLEMENT_DELAY_DAYS]: z.coerce.number().int().min(0),
  [SETTING_KEYS.MAX_OPEN_DISPUTES_PER_USER]: z.coerce.number().int().positive(),
  [SETTING_KEYS.DISPUTE_REOPEN_WINDOW_DAYS]: z.coerce.number().int().positive(),
  [SETTING_KEYS.DISPUTE_EVIDENCE_MAX_FILES]: z.coerce.number().int().positive(),
  [SETTING_KEYS.QUIET_HOURS_DEFAULT_START]: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  [SETTING_KEYS.QUIET_HOURS_DEFAULT_END]: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  [SETTING_KEYS.NOTIFICATION_MAX_PUSH_PER_DAY]: z.coerce.number().int().positive(),
  [SETTING_KEYS.SMS_ENABLED_EVENTS]: z.array(z.string()),
  [SETTING_KEYS.NOTIFICATION_RETENTION_DAYS]: z.coerce.number().int().positive(),
  [SETTING_KEYS.ADMIN_DIGEST_TIME]: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  [SETTING_KEYS.PUSH_PROVIDER]: z.string(),
  [SETTING_KEYS.ANNOUNCEMENT_BATCH_SIZE]: z.coerce.number().int().positive(),
  [SETTING_KEYS.STRIKE_LIMIT]: z.coerce.number().int().positive(),
  [SETTING_KEYS.BAN_DAYS]: z.coerce.number().int().positive(),
  [SETTING_KEYS.DISPUTE_SLA_WORKING_DAYS]: z.coerce.number().int().positive(),
  [SETTING_KEYS.ADMIN_IDLE_TIMEOUT_MINUTES]: z.coerce.number().int().min(5).max(120),
  [SETTING_KEYS.STEP_UP_TTL_MINUTES]: z.coerce.number().int().min(1).max(60),
  [SETTING_KEYS.ADMIN_IP_ALLOWLIST]: z.array(z.string()),
  [SETTING_KEYS.SENSITIVE_SETTING_KEYS]: z.array(z.string()),
  [SETTING_KEYS.EXPORT_MAX_ROWS]: z.coerce.number().int().min(100).max(500000),
  [SETTING_KEYS.EXPORT_LINK_TTL_HOURS]: z.coerce.number().int().min(1).max(168),
  [SETTING_KEYS.SEARCH_MIN_CHARS]: z.coerce.number().int().min(1).max(10),
  [SETTING_KEYS.MAINTENANCE_MODE]: z.boolean(),
  [SETTING_KEYS.MAINTENANCE_MESSAGE]: z.string(),
  [SETTING_KEYS.METRICS_TIMEZONE]: z.string().min(1),
} as const;

export type SettingSchemas = typeof SETTING_SCHEMAS;

export function validateSettingValue<K extends SettingKey>(
  key: K,
  value: unknown,
): z.infer<SettingSchemas[K]> {
  const schema = SETTING_SCHEMAS[key];
  if (!schema) {
    throw new Error(`Unsupported setting key: ${key}`);
  }
  return schema.parse(value);
}

// ---------------------------------------------------------
// AUTH REQUEST & RESPONSE SCHEMAS
// ---------------------------------------------------------

export const deviceMetadataSchema = z.object({
  platform: z.enum(['ANDROID', 'IOS', 'WEB']).default('WEB'),
  userAgent: z.string().optional(),
  appVersion: z.string().optional(),
});
export type DeviceMetadata = z.infer<typeof deviceMetadataSchema>;

export const driverOtpRequestSchema = z.object({
  mobile: mobileSchema,
});
export type DriverOtpRequestInput = z.infer<typeof driverOtpRequestSchema>;

export const driverOtpVerifySchema = z.object({
  mobile: mobileSchema,
  code: z.string().trim().min(4).max(10),
  device: deviceMetadataSchema.optional(),
});
export type DriverOtpVerifyInput = z.infer<typeof driverOtpVerifySchema>;

export const companyRegisterSchema = z.object({
  email: emailSchema,
  mobile: mobileSchema,
  password: passwordSchema,
  language: languageSchema.default('en'),
});
export type CompanyRegisterInput = z.infer<typeof companyRegisterSchema>;

export const companyVerifyMobileSchema = z.object({
  mobile: mobileSchema,
  code: z.string().trim().min(4).max(10),
});
export type CompanyVerifyMobileInput = z.infer<typeof companyVerifyMobileSchema>;

export const companyLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { message: 'Password is required' }),
});
export type CompanyLoginInput = z.infer<typeof companyLoginSchema>;

export const adminLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { message: 'Password is required' }),
});
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

export const adminVerifyOtpSchema = z.object({
  challengeId: uuidSchema,
  code: z.string().trim().min(4).max(10),
});
export type AdminVerifyOtpInput = z.infer<typeof adminVerifyOtpSchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().optional(),
});
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  email: emailSchema,
  code: z.string().trim().min(4).max(10),
  newPassword: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, { message: 'Current password is required' }),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const updatePreferencesSchema = z.object({
  language: languageSchema.optional(),
  theme: themeSchema.optional(),
});
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;

export const createAdminSchema = z.object({
  email: emailSchema,
  mobile: mobileSchema,
  role: z.enum([ROLES.SUPER_ADMIN, ROLES.MODERATOR, ROLES.FINANCE]),
});
export type CreateAdminInput = z.infer<typeof createAdminSchema>;

export const updateAdminRoleSchema = z.object({
  role: z.enum([ROLES.SUPER_ADMIN, ROLES.MODERATOR, ROLES.FINANCE]),
});
export type UpdateAdminRoleInput = z.infer<typeof updateAdminRoleSchema>;

export const updateAdminStatusSchema = z.object({
  status: z.enum([ACCOUNT_STATUS.APPROVED, ACCOUNT_STATUS.SUSPENDED, ACCOUNT_STATUS.BLOCKED]),
});
export type UpdateAdminStatusInput = z.infer<typeof updateAdminStatusSchema>;

// =============================================================================
// PHASE 4: VEHICLE & GSTIN & BANK VALIDATION
// =============================================================================

export function normalizeVehicleNumber(raw: string): string {
  return raw.toUpperCase().replace(/[\s\-]/g, '');
}

export const VEHICLE_NUMBER_STANDARD_REGEX = /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{4}$/;
export const VEHICLE_NUMBER_BH_REGEX = /^\d{2}BH\d{4}[A-Z]{1,2}$/;

export const vehicleNumberSchema = z
  .string()
  .trim()
  .transform(normalizeVehicleNumber)
  .refine(
    (val) => VEHICLE_NUMBER_STANDARD_REGEX.test(val) || VEHICLE_NUMBER_BH_REGEX.test(val),
    { message: 'Invalid Indian vehicle registration number (e.g. GJ01AB1234 or 22BH1234A)' }
  );

export function normalizeGstin(raw: string): string {
  return raw.toUpperCase().trim();
}

export const GSTIN_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const gstinSchema = z
  .string()
  .trim()
  .transform(normalizeGstin)
  .refine((val) => GSTIN_REGEX.test(val), {
    message: 'Invalid Indian GSTIN format (15 characters, e.g. 24AAAAA0000A1Z5)',
  });

export const upiIdSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/, {
    message: 'Invalid UPI ID format (e.g. driver@upi or 9876543210@paytm)',
  });

export const ifscSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, {
    message: 'Invalid IFSC code (e.g. SBIN0001234)',
  });

// =============================================================================
// PHASE 4: UPLOAD PRESIGN & CONFIRM
// =============================================================================

export const presignUploadSchema = z
  .object({
    purpose: z.enum([
      FILE_PURPOSES.KYC_DOCUMENT,
      FILE_PURPOSES.CAMPAIGN_POSTER,
      FILE_PURPOSES.INSTALLATION_PHOTO,
      FILE_PURPOSES.DAILY_PHOTO,
      FILE_PURPOSES.DISPUTE_EVIDENCE,
      FILE_PURPOSES.VEHICLE_PHOTO,
    ]),
    mimeType: z.enum([
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
    ]),
    sizeBytes: z.coerce.number().int().positive().max(8388608), // 8MB limit
  })
  .refine(
    (data) => {
      if (data.mimeType === 'application/pdf') {
        return (
          data.purpose === FILE_PURPOSES.KYC_DOCUMENT ||
          data.purpose === FILE_PURPOSES.DISPUTE_EVIDENCE
        );
      }
      return true;
    },
    {
      message: 'PDF format is only permitted for KYC documents and dispute evidence.',
      path: ['mimeType'],
    }
  );
export type PresignUploadInput = z.infer<typeof presignUploadSchema>;

export const confirmUploadSchema = z.object({
  fileKey: z.string().min(1, { message: 'fileKey is required' }),
});
export type ConfirmUploadInput = z.infer<typeof confirmUploadSchema>;

// =============================================================================
// PHASE 4: LOCATIONS (CITIES & ZONES)
// =============================================================================

export const createCitySchema = z.object({
  name: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  country: z.string().trim().default('IN'),
});
export type CreateCityInput = z.infer<typeof createCitySchema>;

export const updateCitySchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  state: z.string().trim().min(2).max(100).optional(),
  country: z.string().trim().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateCityInput = z.infer<typeof updateCitySchema>;

export const createZoneSchema = z.object({
  cityId: uuidSchema,
  name: z.string().trim().min(2).max(100),
  pinCodes: z.array(z.string().regex(/^\d{6}$/, { message: 'PIN code must be 6 digits' })).default([]),
  centerLat: z.coerce.number().min(-90).max(90),
  centerLng: z.coerce.number().min(-180).max(180),
  radiusMeters: z.coerce.number().positive(),
});
export type CreateZoneInput = z.infer<typeof createZoneSchema>;

export const updateZoneSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  pinCodes: z.array(z.string().regex(/^\d{6}$/, { message: 'PIN code must be 6 digits' })).optional(),
  centerLat: z.coerce.number().min(-90).max(90).optional(),
  centerLng: z.coerce.number().min(-180).max(180).optional(),
  radiusMeters: z.coerce.number().positive().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateZoneInput = z.infer<typeof updateZoneSchema>;

// =============================================================================
// PHASE 4: DRIVER ONBOARDING
// =============================================================================

export const driverProfileInputSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  cityId: uuidSchema,
  primaryZoneId: uuidSchema,
  extraZoneIds: z.array(uuidSchema).default([]),
});
export type DriverProfileInput = z.infer<typeof driverProfileInputSchema>;

export const driverVehicleInputSchema = z
  .object({
    registrationNumber: vehicleNumberSchema,
    isVehicleOwner: z.boolean(),
    ownerName: z.string().trim().min(2).max(100).optional(),
    ownerMobile: mobileSchema.optional(),
  })
  .refine(
    (data) => {
      if (!data.isVehicleOwner) {
        return Boolean(data.ownerName && data.ownerMobile);
      }
      return true;
    },
    {
      message: 'Owner name and mobile are required when driver is not the vehicle owner.',
      path: ['ownerName'],
    }
  );
export type DriverVehicleInput = z.infer<typeof driverVehicleInputSchema>;

export const driverDocumentInputSchema = z.object({
  type: z.enum([
    DOCUMENT_TYPES.DRIVING_LICENCE,
    DOCUMENT_TYPES.VEHICLE_RC,
    DOCUMENT_TYPES.VEHICLE_PHOTO,
    DOCUMENT_TYPES.OWNER_PERMISSION,
    DOCUMENT_TYPES.ID_PROOF,
    DOCUMENT_TYPES.OTHER,
  ]),
  uploadedFileId: uuidSchema,
});
export type DriverDocumentInput = z.infer<typeof driverDocumentInputSchema>;

export const driverPayoutInputSchema = z.discriminatedUnion('method', [
  z.object({
    method: z.literal(PAYOUT_METHODS.UPI),
    upiId: upiIdSchema,
    otpCode: z.string().trim().optional(),
  }),
  z.object({
    method: z.literal(PAYOUT_METHODS.BANK_ACCOUNT),
    bankAccountHolder: z.string().trim().min(2).max(100),
    bankAccountNumber: z
      .string()
      .trim()
      .regex(/^\d{9,18}$/, { message: 'Bank account number must be 9-18 digits' }),
    bankIfsc: ifscSchema,
    otpCode: z.string().trim().optional(),
  }),
]);
export type DriverPayoutInput = z.infer<typeof driverPayoutInputSchema>;

export const singleConsentSchema = z.object({
  type: z.enum([
    CONSENT_TYPES.TERMS,
    CONSENT_TYPES.PRIVACY,
    CONSENT_TYPES.LOCATION,
    CONSENT_TYPES.CAMERA,
    CONSENT_TYPES.POSTER_POLICY,
  ]),
  version: z.string().min(1),
});
export type SingleConsentInput = z.infer<typeof singleConsentSchema>;

export const consentSubmissionSchema = z.object({
  consents: z.array(singleConsentSchema).min(1, { message: 'At least one consent is required' }),
});
export type ConsentSubmissionInput = z.infer<typeof consentSubmissionSchema>;

// =============================================================================
// PHASE 4: COMPANY ONBOARDING
// =============================================================================

export const companyAddressSchema = z.object({
  street: z.string().trim().min(2).max(200),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  postalCode: z.string().trim().regex(/^\d{6}$/, { message: 'PIN code must be 6 digits' }),
});
export type CompanyAddress = z.infer<typeof companyAddressSchema>;

export const companyProfileInputSchema = z.object({
  businessName: z.string().trim().min(2).max(100),
  gstNumber: gstinSchema.optional(),
  address: companyAddressSchema,
  cityId: uuidSchema,
  contactPersonName: z.string().trim().min(2).max(100),
  contactEmail: emailSchema,
  contactMobile: mobileSchema,
  website: z.string().trim().url({ message: 'Invalid website URL' }).optional().or(z.literal('')),
});
export type CompanyProfileInput = z.infer<typeof companyProfileInputSchema>;

export const companyDocumentInputSchema = z.object({
  type: z.enum([
    DOCUMENT_TYPES.GST_CERTIFICATE,
    DOCUMENT_TYPES.BUSINESS_PROOF,
    DOCUMENT_TYPES.ID_PROOF,
    DOCUMENT_TYPES.OTHER,
  ]),
  uploadedFileId: uuidSchema,
});
export type CompanyDocumentInput = z.infer<typeof companyDocumentInputSchema>;

// =============================================================================
// PHASE 4: ADMIN KYC REVIEW & USER MANAGEMENT
// =============================================================================

export const claimNextSchema = z.object({
  role: z.enum([ROLES.DRIVER, ROLES.COMPANY]).optional(),
});
export type ClaimNextInput = z.infer<typeof claimNextSchema>;

export const kycQueueQuerySchema = paginationQuerySchema.extend({
  role: z.enum([ROLES.DRIVER, ROLES.COMPANY]).optional(),
  status: z
    .enum([
      KYC_SUBMISSION_STATUS.SUBMITTED,
      KYC_SUBMISSION_STATUS.APPROVED,
      KYC_SUBMISSION_STATUS.REJECTED,
      KYC_SUBMISSION_STATUS.NEED_MORE_INFO,
    ])
    .optional(),
  cityId: uuidSchema.optional(),
  assignedTo: z.enum(['me', 'unassigned']).optional(),
  search: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export type KycQueueQuery = z.infer<typeof kycQueueQuerySchema>;

export const documentReviewSchema = z
  .object({
    status: z.enum([DOCUMENT_STATUS.APPROVED, DOCUMENT_STATUS.REJECTED]),
    reasonCode: z
      .enum([
        KYC_REASON_CODES.DOCUMENT_UNCLEAR,
        KYC_REASON_CODES.DOCUMENT_EXPIRED,
        KYC_REASON_CODES.DOCUMENT_MISSING,
        KYC_REASON_CODES.NAME_MISMATCH,
        KYC_REASON_CODES.VEHICLE_NUMBER_MISMATCH,
        KYC_REASON_CODES.OWNER_PERMISSION_MISSING,
        KYC_REASON_CODES.DUPLICATE_ACCOUNT,
        KYC_REASON_CODES.INVALID_GST,
        KYC_REASON_CODES.PAYOUT_DETAILS_INVALID,
        KYC_REASON_CODES.OTHER,
      ])
      .optional(),
    note: z.string().trim().optional(),
  })
  .refine(
    (data) => {
      if (data.status === DOCUMENT_STATUS.REJECTED && !data.reasonCode) {
        return false;
      }
      return true;
    },
    {
      message: 'Reason code is required when rejecting a document.',
      path: ['reasonCode'],
    }
  );
export type DocumentReviewInput = z.infer<typeof documentReviewSchema>;

export const kycReasonItemSchema = z.object({
  reasonCode: z.enum([
    KYC_REASON_CODES.DOCUMENT_UNCLEAR,
    KYC_REASON_CODES.DOCUMENT_EXPIRED,
    KYC_REASON_CODES.DOCUMENT_MISSING,
    KYC_REASON_CODES.NAME_MISMATCH,
    KYC_REASON_CODES.VEHICLE_NUMBER_MISMATCH,
    KYC_REASON_CODES.OWNER_PERMISSION_MISSING,
    KYC_REASON_CODES.DUPLICATE_ACCOUNT,
    KYC_REASON_CODES.INVALID_GST,
    KYC_REASON_CODES.PAYOUT_DETAILS_INVALID,
    KYC_REASON_CODES.OTHER,
  ]),
  fieldOrDocType: z.string().optional(),
  note: z.string().optional(),
});
export type KycReasonItem = z.infer<typeof kycReasonItemSchema>;

export const kycDecisionSchema = z
  .object({
    decision: z.enum([
      KYC_SUBMISSION_STATUS.APPROVED,
      KYC_SUBMISSION_STATUS.REJECTED,
      KYC_SUBMISSION_STATUS.NEED_MORE_INFO,
    ]),
    reasons: z.array(kycReasonItemSchema).default([]),
    note: z.string().trim().optional(),
  })
  .refine(
    (data) => {
      if (
        (data.decision === KYC_SUBMISSION_STATUS.REJECTED ||
          data.decision === KYC_SUBMISSION_STATUS.NEED_MORE_INFO) &&
        data.reasons.length === 0
      ) {
        return false;
      }
      return true;
    },
    {
      message: 'At least one reason is required when rejecting or requesting more info.',
      path: ['reasons'],
    }
  );
export type KycDecisionInput = z.infer<typeof kycDecisionSchema>;

export const updateUserStatusSchema = z.object({
  status: z.enum([
    ACCOUNT_STATUS.APPROVED,
    ACCOUNT_STATUS.SUSPENDED,
    ACCOUNT_STATUS.BLOCKED,
  ]),
  reason: z.string().trim().min(3, { message: 'Reason must be at least 3 characters' }),
});
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;

export const listUsersQuerySchema = paginationQuerySchema.extend({
  role: z.enum([ROLES.DRIVER, ROLES.COMPANY]).optional(),
  status: z
    .enum([
      ACCOUNT_STATUS.PENDING,
      ACCOUNT_STATUS.NEED_MORE_INFO,
      ACCOUNT_STATUS.APPROVED,
      ACCOUNT_STATUS.REJECTED,
      ACCOUNT_STATUS.SUSPENDED,
      ACCOUNT_STATUS.BLOCKED,
    ])
    .optional(),
  cityId: uuidSchema.optional(),
  search: z.string().optional(),
});
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

export const listNotificationsQuerySchema = paginationQuerySchema.extend({
  unreadOnly: z.preprocess((val) => {
    if (typeof val === 'string') return val === 'true' || val === '1';
    return val;
  }, z.boolean().optional()),
});
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;

// =============================================================================
// PHASE 5: CAMPAIGNS
// =============================================================================

export const campaignDatesSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD'),
});

export const campaignPricePreviewSchema = campaignDatesSchema.extend({
  slots: z.coerce.number().int().min(1, 'Slots must be at least 1'),
  rentPer30DaysPaise: z.coerce.number().int().min(0, 'Rent cannot be negative'),
  printingAllowancePaise: z.coerce.number().int().min(0, 'Printing allowance cannot be negative'),
});
export type CampaignPricePreviewInput = z.infer<typeof campaignPricePreviewSchema>;

export const createCampaignDraftSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  cityId: uuidSchema,
  zoneIds: z.array(uuidSchema).default([]),
  targetVehicleType: z.enum([VEHICLE_TYPES.AUTO_RICKSHAW]).default(VEHICLE_TYPES.AUTO_RICKSHAW),
  slots: z.coerce.number().int().min(1).max(10000),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD'),
  rentPer30DaysPaise: z.coerce.number().int().min(0),
  printingAllowancePaise: z.coerce.number().int().min(0),
  posterFileId: uuidSchema.optional().nullable(),
  printMaterial: z.enum([
    PRINT_MATERIALS.FLEX,
    PRINT_MATERIALS.VINYL_STICKER,
    PRINT_MATERIALS.OTHER,
  ]).default(PRINT_MATERIALS.VINYL_STICKER),
  printSize: z.string().trim().max(50).optional().nullable(),
  printInstructions: z.string().trim().max(1000).optional().nullable(),
  installApprover: z.enum([
    INSTALL_APPROVERS.PLATFORM,
    INSTALL_APPROVERS.COMPANY,
  ]).default(INSTALL_APPROVERS.PLATFORM),
  enrolmentClosesAt: z.string().datetime().optional().nullable(),
});
export type CreateCampaignDraftInput = z.input<typeof createCampaignDraftSchema>;

export const updateCampaignDraftSchema = createCampaignDraftSchema.partial();
export type UpdateCampaignDraftInput = z.input<typeof updateCampaignDraftSchema>;

export const cancelCampaignSchema = z.object({
  reason: z.string().trim().min(3, 'Cancellation reason must be at least 3 characters').max(500),
});
export type CancelCampaignInput = z.infer<typeof cancelCampaignSchema>;

export const campaignReviewReasonItemSchema = z.object({
  code: z.enum([
    CAMPAIGN_REVIEW_REASONS.POSTER_CONTENT_POLICY,
    CAMPAIGN_REVIEW_REASONS.POSTER_LOW_QUALITY,
    CAMPAIGN_REVIEW_REASONS.POSTER_MISLEADING,
    CAMPAIGN_REVIEW_REASONS.PRICE_TOO_LOW,
    CAMPAIGN_REVIEW_REASONS.DETAILS_UNCLEAR,
    CAMPAIGN_REVIEW_REASONS.UNSUPPORTED_AREA,
    CAMPAIGN_REVIEW_REASONS.START_DATE_TOO_SOON,
    CAMPAIGN_REVIEW_REASONS.OTHER,
  ]),
  customNote: z.string().trim().max(500).optional(),
});
export type CampaignReviewReasonItem = z.infer<typeof campaignReviewReasonItemSchema>;

export const adminCampaignDecisionSchema = z
  .object({
    decision: z.enum([
      CAMPAIGN_REVIEW_DECISIONS.APPROVED,
      CAMPAIGN_REVIEW_DECISIONS.REJECTED,
    ]),
    reasons: z.array(campaignReviewReasonItemSchema).default([]),
    note: z.string().trim().max(1000).optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.decision === CAMPAIGN_REVIEW_DECISIONS.REJECTED && data.reasons.length === 0) {
        return false;
      }
      return true;
    },
    {
      message: 'At least one rejection reason code is required when rejecting a campaign',
      path: ['reasons'],
    },
  );
export type AdminCampaignDecisionInput = z.input<typeof adminCampaignDecisionSchema>;

export const listCompanyCampaignsQuerySchema = paginationQuerySchema.extend({
  status: z.enum([
    CAMPAIGN_STATUS.DRAFT,
    CAMPAIGN_STATUS.SUBMITTED,
    CAMPAIGN_STATUS.UNDER_REVIEW,
    CAMPAIGN_STATUS.APPROVED,
    CAMPAIGN_STATUS.AWAITING_PAYMENT,
    CAMPAIGN_STATUS.LIVE,
    CAMPAIGN_STATUS.RUNNING,
    CAMPAIGN_STATUS.COMPLETED,
    CAMPAIGN_STATUS.SETTLED,
    CAMPAIGN_STATUS.REJECTED,
    CAMPAIGN_STATUS.EXPIRED,
    CAMPAIGN_STATUS.CANCELLED,
  ]).optional(),
  search: z.string().optional(),
});
export type ListCompanyCampaignsQuery = z.input<typeof listCompanyCampaignsQuerySchema>;

export const listAdminCampaignsQuerySchema = listCompanyCampaignsQuerySchema.extend({
  cityId: uuidSchema.optional(),
  companyId: uuidSchema.optional(),
  startDateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startDateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  assignedToMe: z.preprocess((val) => val === 'true' || val === true, z.boolean().optional()),
  unassigned: z.preprocess((val) => val === 'true' || val === true, z.boolean().optional()),
});
export type ListAdminCampaignsQuery = z.input<typeof listAdminCampaignsQuerySchema>;

export const listDriverCampaignsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  zoneId: uuidSchema.optional(),
  minRent: z.coerce.number().int().optional(),
  minDuration: z.coerce.number().int().optional(),
  startDateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startDateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sort: z.enum([
    CAMPAIGN_SORTS.NEWEST,
    CAMPAIGN_SORTS.HIGHEST_RENT,
    CAMPAIGN_SORTS.STARTING_SOON,
  ]).default(CAMPAIGN_SORTS.NEWEST),
});
export type ListDriverCampaignsQuery = z.input<typeof listDriverCampaignsQuerySchema>;

export const driverAvailabilityQuerySchema = z.object({
  cityId: uuidSchema,
  zoneIds: z.union([z.string(), z.array(uuidSchema)]).optional(),
  vehicleType: z.enum([VEHICLE_TYPES.AUTO_RICKSHAW]).default(VEHICLE_TYPES.AUTO_RICKSHAW),
});
export type DriverAvailabilityQuery = z.input<typeof driverAvailabilityQuerySchema>;

// ---------------------------------------------------------
// PHASE 6: ASSIGNMENTS & INSTALLATION SCHEMAS
// ---------------------------------------------------------

export const campaignSelectSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
});
export type CampaignSelectInput = z.infer<typeof campaignSelectSchema>;

export const withdrawAssignmentSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});
export type WithdrawAssignmentInput = z.infer<typeof withdrawAssignmentSchema>;

export const submitInstallationPhotoSchema = z.object({
  uploadedFileId: uuidSchema,
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  accuracyMeters: z.coerce.number().positive(),
  capturedAt: z.string().datetime(),
  isMockLocation: z.boolean().default(false),
  deviceId: z.string().trim().min(3).max(128).optional(),
});
export type SubmitInstallationPhotoInput = z.infer<typeof submitInstallationPhotoSchema>;

export const installRejectReasonItemSchema = z.object({
  code: z.enum([
    INSTALL_REJECT_REASONS.POSTER_WRINKLED_OR_DAMAGED,
    INSTALL_REJECT_REASONS.NUMBER_PLATE_OBSCURED,
    INSTALL_REJECT_REASONS.WRONG_AUTO_OR_PLATE,
    INSTALL_REJECT_REASONS.POOR_LIGHTING_OR_BLURRY,
    INSTALL_REJECT_REASONS.POSTER_CROPPED_OR_INCOMPLETE,
    INSTALL_REJECT_REASONS.SUSPECTED_REUSE_OR_DUPLICATE,
    INSTALL_REJECT_REASONS.OTHER,
  ]),
  note: z.string().trim().max(500).optional(),
});
export type InstallRejectReasonItem = z.infer<typeof installRejectReasonItemSchema>;

export const reviewInstallationSchema = z
  .object({
    decision: z.enum([
      INSTALL_REVIEW_DECISIONS.APPROVED,
      INSTALL_REVIEW_DECISIONS.REJECTED,
      INSTALL_REVIEW_DECISIONS.EXTRA_ATTEMPT_GRANTED,
    ]),
    reasons: z.array(installRejectReasonItemSchema).optional().default([]),
    note: z.string().trim().max(1000).optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.decision === INSTALL_REVIEW_DECISIONS.REJECTED && data.reasons.length === 0) {
        return false;
      }
      return true;
    },
    {
      message: 'At least one rejection reason code is required when rejecting an installation',
      path: ['reasons'],
    },
  );
export type ReviewInstallationInput = z.infer<typeof reviewInstallationSchema>;

export const listAssignmentsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z
    .enum([
      ASSIGNMENT_STATUS.RESERVED,
      ASSIGNMENT_STATUS.INSTALLING,
      ASSIGNMENT_STATUS.INSTALL_SUBMITTED,
      ASSIGNMENT_STATUS.INSTALL_APPROVED,
      ASSIGNMENT_STATUS.INSTALL_REJECTED,
      ASSIGNMENT_STATUS.RUNNING,
      ASSIGNMENT_STATUS.COMPLETED,
      ASSIGNMENT_STATUS.PAID,
      ASSIGNMENT_STATUS.TERMINATED,
      ASSIGNMENT_STATUS.RESERVATION_EXPIRED,
      ASSIGNMENT_STATUS.RELEASED,
    ])
    .optional(),
});
export type ListAssignmentsQuery = z.infer<typeof listAssignmentsQuerySchema>;

// ---------------------------------------------------------------------------
// Phase 7: Daily Photo Proof & Fraud Validation Schemas
// ---------------------------------------------------------------------------

export const submitDailyPhotoSchema = z.object({
  uploadedFileId: z.string().uuid(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().min(0).max(1000),
  capturedAt: z.string().datetime(),
  clientSentAt: z.string().datetime().optional(),
  isMockLocation: z.boolean().default(false),
  deviceInfo: z
    .object({
      platform: z.string().optional(),
      model: z.string().optional(),
      osVersion: z.string().optional(),
      appVersion: z.string().optional(),
      deviceInstallId: z.string().optional(),
    })
    .optional(),
});
export type SubmitDailyPhotoInput = z.infer<typeof submitDailyPhotoSchema>;

export const dailyRejectReasonItemSchema = z.object({
  code: z.enum([
    DAILY_REJECT_REASONS.PLATE_NOT_VISIBLE,
    DAILY_REJECT_REASONS.POSTER_NOT_VISIBLE,
    DAILY_REJECT_REASONS.POSTER_REMOVED_OR_DAMAGED,
    DAILY_REJECT_REASONS.WRONG_AUTO,
    DAILY_REJECT_REASONS.WRONG_POSTER,
    DAILY_REJECT_REASONS.LOCATION_MISMATCH,
    DAILY_REJECT_REASONS.OLD_OR_REUSED_PHOTO,
    DAILY_REJECT_REASONS.SCREEN_OR_EDITED_PHOTO,
    DAILY_REJECT_REASONS.PHOTO_UNCLEAR,
    DAILY_REJECT_REASONS.OTHER,
  ]),
  note: z.string().trim().max(500).optional(),
});
export type DailyRejectReasonItem = z.infer<typeof dailyRejectReasonItemSchema>;

export const reviewDailyPhotoSchema = z
  .object({
    decision: z.enum(['APPROVE', 'REJECT']),
    reasons: z.array(dailyRejectReasonItemSchema).optional().default([]),
    note: z.string().trim().max(1000).optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.decision === 'REJECT' && data.reasons.length === 0) {
        return false;
      }
      return true;
    },
    {
      message: 'At least one rejection reason code is required when rejecting a photo',
      path: ['reasons'],
    },
  );
export type ReviewDailyPhotoInput = z.infer<typeof reviewDailyPhotoSchema>;

export const excuseDaySchema = z.object({
  reason: z.string().trim().min(3).max(500),
});
export type ExcuseDayInput = z.infer<typeof excuseDaySchema>;

export const flagPhotoSchema = z.object({
  reason: z.enum([
    PHOTO_FLAG_REASONS.POSTER_NOT_VISIBLE,
    PHOTO_FLAG_REASONS.WRONG_AUTO,
    PHOTO_FLAG_REASONS.LOOKS_FAKE,
    PHOTO_FLAG_REASONS.OTHER,
  ]),
  note: z.string().trim().max(500).optional(),
});
export type FlagPhotoInput = z.infer<typeof flagPhotoSchema>;

export const listDailyPhotoQueueQuerySchema = z.object({
  source: z
    .enum([
      PHOTO_REVIEW_SOURCES.AUTO_FLAGGED,
      PHOTO_REVIEW_SOURCES.RANDOM_SAMPLE,
      PHOTO_REVIEW_SOURCES.COMPANY_FLAG,
    ])
    .optional(),
  campaignId: z.string().uuid().optional(),
  cityId: z.string().uuid().optional(),
  unassigned: z.coerce.boolean().optional(),
  assignedToMe: z.coerce.boolean().optional(),
  minRiskScore: z.coerce.number().int().min(0).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
});
export type ListDailyPhotoQueueQuery = z.infer<typeof listDailyPhotoQueueQuerySchema>;

// ---------------------------------------------------------------------------
// Phase 8: Financial Ledger, Escrow, Payments and Payouts Schemas
// ---------------------------------------------------------------------------

export const createPaymentOrderSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
});
export type CreatePaymentOrderInput = z.infer<typeof createPaymentOrderSchema>;

export const verifyPaymentSignatureSchema = z.object({
  paymentId: z.string().uuid(),
  gatewayOrderId: z.string().min(1),
  gatewayPaymentId: z.string().min(1),
  gatewaySignature: z.string().min(1),
});
export type VerifyPaymentSignatureInput = z.infer<typeof verifyPaymentSignatureSchema>;

export const refundRequestSchema = z.object({
  campaignId: z.string().uuid(),
  amountPaise: z
    .union([z.string().regex(/^\d+$/), z.number().int().positive()])
    .transform((val) => val.toString()),
  reason: z.enum([
    REFUND_REASONS.CAMPAIGN_CANCELLED,
    REFUND_REASONS.UNFILLED_SLOTS,
    REFUND_REASONS.OVERPAYMENT,
    REFUND_REASONS.DISPUTE_SETTLEMENT,
    REFUND_REASONS.MANUAL_CORRECTION,
  ]),
  notes: z.string().trim().min(3).max(1000).optional(),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
});
export type RefundRequestInput = z.infer<typeof refundRequestSchema>;

export const refundReviewSchema = z
  .object({
    decision: z.enum(['APPROVED', 'REJECTED']),
    rejectionReason: z.string().trim().min(3).max(500).optional(),
  })
  .refine(
    (data) =>
      data.decision !== 'REJECTED' || (data.rejectionReason && data.rejectionReason.length >= 3),
    {
      message: 'Rejection reason is required when rejecting a refund',
      path: ['rejectionReason'],
    },
  );
export type RefundReviewInput = z.infer<typeof refundReviewSchema>;

export const settlementApprovalSchema = z
  .object({
    decision: z.enum(['APPROVE', 'HOLD']),
    holdReason: z.string().trim().min(3).max(500).optional(),
  })
  .refine(
    (data) =>
      data.decision !== 'HOLD' || (data.holdReason && data.holdReason.length >= 3),
    {
      message: 'Hold reason is required when putting a settlement on hold',
      path: ['holdReason'],
    },
  );
export type SettlementApprovalInput = z.infer<typeof settlementApprovalSchema>;

export const driverWithdrawalSchema = z.object({
  amountPaise: z
    .union([z.string().regex(/^\d+$/), z.number().int().positive()])
    .transform((val) => val.toString()),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
});
export type DriverWithdrawalInput = z.infer<typeof driverWithdrawalSchema>;

export const adjustmentRequestSchema = z.object({
  accountId: z.string().uuid(),
  amountPaise: z
    .union([z.string().regex(/^\d+$/), z.number().int().positive()])
    .transform((val) => val.toString()),
  direction: z.enum([LEDGER_DIRECTIONS.DEBIT, LEDGER_DIRECTIONS.CREDIT]),
  reason: z.string().trim().min(5).max(1000),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
});
export type AdjustmentRequestInput = z.infer<typeof adjustmentRequestSchema>;

export const adjustmentReviewSchema = z
  .object({
    decision: z.enum(['APPROVED', 'REJECTED']),
    rejectionReason: z.string().trim().min(3).max(500).optional(),
  })
  .refine(
    (data) =>
      data.decision !== 'REJECTED' || (data.rejectionReason && data.rejectionReason.length >= 3),
    {
      message: 'Rejection reason is required when rejecting an adjustment',
      path: ['rejectionReason'],
    },
  );
export type AdjustmentReviewInput = z.infer<typeof adjustmentReviewSchema>;

export const financePauseSchema = z.object({
  paymentsEnabled: z.boolean().optional(),
  payoutsEnabled: z.boolean().optional(),
  reason: z.string().trim().min(3).max(500),
});
export type FinancePauseInput = z.infer<typeof financePauseSchema>;

export const manualPayoutCsvUploadSchema = z.object({
  fileUrl: z.string().url(),
  provider: z.enum([PAYOUT_PROVIDER_NAMES.MANUAL_CSV, PAYOUT_PROVIDER_NAMES.RAZORPAYX]),
  notes: z.string().trim().max(500).optional(),
});
export type ManualPayoutCsvUploadInput = z.infer<typeof manualPayoutCsvUploadSchema>;

export const payoutBatchProcessSchema = z.object({
  action: z.enum(['CONFIRM_PAID', 'FAIL']),
  failureReason: z.string().trim().max(500).optional(),
});
export type PayoutBatchProcessInput = z.infer<typeof payoutBatchProcessSchema>;

// ---------------------------------------------------------------------------
// Phase 9: Discipline, Disputes & Notifications Validation Schemas
// ---------------------------------------------------------------------------

export const createDriverDisputeSchema = z.object({
  assignmentId: z.string().uuid(),
  reason: z.enum([
    DISPUTE_REASONS.PHOTO_WRONGLY_REJECTED,
    DISPUTE_REASONS.INSTALL_WRONGLY_REJECTED,
    DISPUTE_REASONS.STRIKE_APPEAL,
    DISPUTE_REASONS.SETTLEMENT_AMOUNT,
    DISPUTE_REASONS.WRONGFUL_TERMINATION,
    DISPUTE_REASONS.PAYMENT_ISSUE,
    DISPUTE_REASONS.OTHER,
  ]),
  photoId: z.string().uuid().optional(),
  strikeId: z.string().uuid().optional(),
  settlementId: z.string().uuid().optional(),
  disputedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  claimedAmountPaise: z.string().regex(/^\d+$/).optional(),
  description: z.string().min(5).max(2000),
  evidenceUploadedFileIds: z.array(z.string().uuid()).max(10).optional().default([]),
});
export type CreateDriverDisputeInput = z.infer<typeof createDriverDisputeSchema>;

export const createCompanyDisputeSchema = z
  .object({
    campaignId: z.string().uuid().optional(),
    assignmentId: z.string().uuid().optional(),
    reason: z.enum([
      DISPUTE_REASONS.FLAG_OUTCOME,
      DISPUTE_REASONS.POSTER_MISSING,
      DISPUTE_REASONS.PRINT_QUALITY,
      DISPUTE_REASONS.PAYMENT_ISSUE,
      DISPUTE_REASONS.OTHER,
    ]),
    photoId: z.string().uuid().optional(),
    disputedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    claimedAmountPaise: z.string().regex(/^\d+$/).optional(),
    description: z.string().min(5).max(2000),
    evidenceUploadedFileIds: z.array(z.string().uuid()).max(10).optional().default([]),
  })
  .refine((data) => Boolean(data.campaignId || data.assignmentId), {
    message: 'Either campaignId or assignmentId must be provided',
  });
export type CreateCompanyDisputeInput = z.infer<typeof createCompanyDisputeSchema>;

export const addDisputeMessageSchema = z.object({
  body: z.string().min(1).max(5000),
  visibleTo: z
    .enum([
      DISPUTE_MESSAGE_VISIBILITY.DRIVER,
      DISPUTE_MESSAGE_VISIBILITY.COMPANY,
      DISPUTE_MESSAGE_VISIBILITY.BOTH,
      DISPUTE_MESSAGE_VISIBILITY.INTERNAL,
    ])
    .optional(),
});
export type AddDisputeMessageInput = z.infer<typeof addDisputeMessageSchema>;

export const addDisputeEvidenceSchema = z.object({
  uploadedFileId: z.string().uuid(),
  notes: z.string().max(500).optional(),
  visibleToOtherParty: z.boolean().optional().default(false),
});
export type AddDisputeEvidenceInput = z.infer<typeof addDisputeEvidenceSchema>;

export const setEvidenceVisibilitySchema = z.object({
  visibleToOtherParty: z.boolean(),
});
export type SetEvidenceVisibilityInput = z.infer<typeof setEvidenceVisibilitySchema>;

export const disputeDecisionSchema = z.object({
  resolutionType: z.enum([
    DISPUTE_RESOLUTION_TYPES.UPHELD_FOR_DRIVER,
    DISPUTE_RESOLUTION_TYPES.UPHELD_FOR_COMPANY,
    DISPUTE_RESOLUTION_TYPES.PARTIAL,
    DISPUTE_RESOLUTION_TYPES.NO_ACTION,
  ]),
  decisionText: z.string().min(5).max(5000),
  toDriverPaise: z.string().regex(/^\d+$/).optional(),
  toCompanyPaise: z.string().regex(/^\d+$/).optional(),
  effects: z
    .array(
      z.enum([
        DISPUTE_EFFECTS.OVERTURN_PHOTO_REJECTION,
        DISPUTE_EFFECTS.UPHOLD_REJECTION,
        DISPUTE_EFFECTS.MARK_DAY_MISSED,
        DISPUTE_EFFECTS.EXCUSE_DAY,
        DISPUTE_EFFECTS.REVOKE_STRIKE,
        DISPUTE_EFFECTS.ISSUE_STRIKE,
        DISPUTE_EFFECTS.LIFT_BAN,
        DISPUTE_EFFECTS.TERMINATE_ASSIGNMENT,
        DISPUTE_EFFECTS.REINSTATE_ASSIGNMENT,
        DISPUTE_EFFECTS.RELEASE_HOLD,
        DISPUTE_EFFECTS.REQUEST_ADJUSTMENT,
        DISPUTE_EFFECTS.REQUEST_REFUND,
      ]),
    )
    .default([]),
});
export type DisputeDecisionInput = z.infer<typeof disputeDecisionSchema>;

export const disputeReopenRequestSchema = z.object({
  reason: z.string().min(5).max(2000),
});
export type DisputeReopenRequestInput = z.infer<typeof disputeReopenRequestSchema>;

export const disputeRequestInfoSchema = z.object({
  targetParty: z.enum(['DRIVER', 'COMPANY', 'BOTH']),
  message: z.string().min(5).max(2000),
});
export type DisputeRequestInfoInput = z.infer<typeof disputeRequestInfoSchema>;

export const issueStrikeSchema = z.object({
  driverId: z.string().uuid(),
  assignmentId: z.string().uuid().optional(),
  reason: z.enum([
    STRIKE_REASONS.FAKE_OR_OLD_PHOTO,
    STRIKE_REASONS.POSTER_REMOVED,
    STRIKE_REASONS.POSTER_DAMAGED_NOT_FIXED,
    STRIKE_REASONS.TOO_MANY_MISSED_DAYS,
    STRIKE_REASONS.OTHER,
  ]),
  note: z.string().min(5).max(1000),
  photoId: z.string().uuid().optional(),
  dayDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export type IssueStrikeInput = z.infer<typeof issueStrikeSchema>;

export const revokeStrikeSchema = z.object({
  reason: z.string().min(5).max(1000),
});
export type RevokeStrikeInput = z.infer<typeof revokeStrikeSchema>;

export const liftBanSchema = z.object({
  reason: z.string().min(5).max(1000),
});
export type LiftBanInput = z.infer<typeof liftBanSchema>;

export const terminateAssignmentSchema = z.object({
  reason: z.enum([
    TERMINATION_REASONS.STRIKE_LIMIT,
    TERMINATION_REASONS.ABANDONED,
    TERMINATION_REASONS.ADMIN_DECISION,
    TERMINATION_REASONS.FRAUD,
  ]),
  note: z.string().min(5).max(1000),
});
export type TerminateAssignmentInput = z.infer<typeof terminateAssignmentSchema>;

export const reinstateAssignmentSchema = z.object({
  note: z.string().min(5).max(1000),
});
export type ReinstateAssignmentInput = z.infer<typeof reinstateAssignmentSchema>;

export const updateNotificationPreferencesSchema = z.object({
  preferences: z.array(
    z.object({
      category: z.enum([
        NOTIFICATION_CATEGORIES.ACCOUNT_SECURITY,
        NOTIFICATION_CATEGORIES.VERIFICATION,
        NOTIFICATION_CATEGORIES.CAMPAIGN_UPDATES,
        NOTIFICATION_CATEGORIES.DAILY_REMINDERS,
        NOTIFICATION_CATEGORIES.MONEY,
        NOTIFICATION_CATEGORIES.DISCIPLINE,
        NOTIFICATION_CATEGORIES.DISPUTES,
        NOTIFICATION_CATEGORIES.SYSTEM,
      ]),
      channel: z.enum(['IN_APP', 'PUSH', 'SMS', 'EMAIL']),
      enabled: z.boolean(),
    }),
  ),
});
export type UpdateNotificationPreferencesInput = z.infer<
  typeof updateNotificationPreferencesSchema
>;

export const updateNotificationSettingsSchema = z.object({
  quietHoursStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  quietHoursEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  language: z.enum(['en', 'hi', 'gu']).optional(),
});
export type UpdateNotificationSettingsInput = z.infer<
  typeof updateNotificationSettingsSchema
>;

export const registerDeviceTokenSchema = z.object({
  token: z.string().min(5).max(500),
  platform: z.enum(['ANDROID', 'IOS', 'WEB']),
  provider: z
    .enum([DEVICE_PUSH_PROVIDERS.EXPO, DEVICE_PUSH_PROVIDERS.FCM])
    .default(DEVICE_PUSH_PROVIDERS.EXPO),
  appVersion: z.string().optional(),
});
export type RegisterDeviceTokenInput = z.infer<typeof registerDeviceTokenSchema>;

export const createAnnouncementSchema = z.object({
  titleByLanguage: z.record(z.string().min(1)),
  bodyByLanguage: z.record(z.string().min(1)),
  audience: z.object({
    roles: z.array(z.string()).optional(),
    cityIds: z.array(z.string().uuid()).optional(),
    accountStatuses: z.array(z.string()).optional(),
    activeOnly: z.boolean().optional(),
  }),
  scheduledFor: z.string().datetime().optional(),
  sendNow: z.boolean().optional().default(false),
});
export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;





