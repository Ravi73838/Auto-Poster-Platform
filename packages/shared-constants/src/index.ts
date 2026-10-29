export const ROLES = {
  DRIVER: 'DRIVER',
  COMPANY: 'COMPANY',
  SUPER_ADMIN: 'SUPER_ADMIN',
  MODERATOR: 'MODERATOR',
  FINANCE: 'FINANCE',
} as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ACCOUNT_STATUS = {
  PENDING: 'PENDING',
  NEED_MORE_INFO: 'NEED_MORE_INFO',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  SUSPENDED: 'SUSPENDED',
  BLOCKED: 'BLOCKED',
} as const;
export type AccountStatus = (typeof ACCOUNT_STATUS)[keyof typeof ACCOUNT_STATUS];

export const CAMPAIGN_STATUS = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  AWAITING_PAYMENT: 'AWAITING_PAYMENT',
  LIVE: 'LIVE',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  SETTLED: 'SETTLED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
} as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUS)[keyof typeof CAMPAIGN_STATUS];

export const ASSIGNMENT_STATUS = {
  RESERVED: 'RESERVED',
  INSTALLING: 'INSTALLING',
  INSTALL_SUBMITTED: 'INSTALL_SUBMITTED',
  INSTALL_APPROVED: 'INSTALL_APPROVED',
  INSTALL_REJECTED: 'INSTALL_REJECTED',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  PAID: 'PAID',
  TERMINATED: 'TERMINATED',
  RESERVATION_EXPIRED: 'RESERVATION_EXPIRED',
} as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUS)[keyof typeof ASSIGNMENT_STATUS];

export const DAILY_PHOTO_STATUS = {
  PENDING_CHECK: 'PENDING_CHECK',
  VERIFIED: 'VERIFIED',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
  REJECTED: 'REJECTED',
} as const;
export type DailyPhotoStatus = (typeof DAILY_PHOTO_STATUS)[keyof typeof DAILY_PHOTO_STATUS];

export const LANGUAGES = {
  EN: 'en',
  HI: 'hi',
  GU: 'gu',
} as const;
export type Language = (typeof LANGUAGES)[keyof typeof LANGUAGES];
export const SUPPORTED_LANGUAGES: readonly Language[] = [
  LANGUAGES.EN,
  LANGUAGES.HI,
  LANGUAGES.GU,
] as const;
export const DEFAULT_LANGUAGE: Language = LANGUAGES.EN;

export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system',
} as const;
export type Theme = (typeof THEMES)[keyof typeof THEMES];
export const SUPPORTED_THEMES: readonly Theme[] = [
  THEMES.LIGHT,
  THEMES.DARK,
  THEMES.SYSTEM,
] as const;
export const DEFAULT_THEME: Theme = THEMES.SYSTEM;

export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export const VEHICLE_TYPES = {
  AUTO_RICKSHAW: 'AUTO_RICKSHAW',
} as const;
export type VehicleType = (typeof VEHICLE_TYPES)[keyof typeof VEHICLE_TYPES];
export const SUPPORTED_VEHICLE_TYPES: readonly VehicleType[] = [
  VEHICLE_TYPES.AUTO_RICKSHAW,
] as const;
