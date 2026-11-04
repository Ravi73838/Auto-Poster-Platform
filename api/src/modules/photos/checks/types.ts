export type CheckSeverity = 'HARD' | 'SOFT';
export type CheckStatus = 'PASS' | 'WARN' | 'FAIL';

export interface IndividualCheckResult {
  name: string;
  status: CheckStatus;
  severity: CheckSeverity;
  score: number;
  details?: Record<string, unknown>;
  failureReason?: string;
  errorCode?: string;
}

export interface PhotoCheckInput {
  imageBuffer: Buffer;
  mimeType: string;
  sizeBytes: number;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  capturedAt: Date;
  isMockLocation?: boolean;
  deviceId?: string;
  campaignCityId?: string | null;
  campaignZoneIds?: string[];
  campaignId: string;
  driverId: string;
  vehicleId: string;
}

export interface PhotoCheckResult {
  passed: boolean;
  dhash: string;
  flags: {
    fileSanity: boolean;
    captureTime: boolean;
    gpsAccuracy: boolean;
    gpsInArea: boolean;
    mockLocation: boolean;
    duplicateCheck: boolean;
    deviceCorrelation: boolean;
  };
  duplicateMatch?: {
    photoId: string;
    distance: number;
  } | null;
  failureReasons: string[];
}

export interface DailyPhotoCheckInput {
  imageBuffer: Buffer;
  mimeType: string;
  sizeBytes: number;
  fileSha256: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  capturedAt: Date;
  clientSentAt?: Date;
  isMockLocation?: boolean;
  deviceInfo?: {
    platform?: string;
    model?: string;
    osVersion?: string;
    appVersion?: string;
    deviceInstallId?: string;
  };
  assignmentId: string;
  campaignId: string;
  driverId: string;
  vehicleId: string;
  nowUtc?: Date;
}

export interface DailyPhotoCheckSummary {
  hardFailures: Array<{ errorCode: string; message: string }>;
  softFlags: Record<string, IndividualCheckResult>;
  riskScore: number;
  dhash: string;
  fileSha256: string;
  autoVerifyEligible: boolean;
  duplicateMatch?: {
    photoId: string;
    distance: number;
    matchType: 'EXACT' | 'NEAR_SAME_ASSIGNMENT' | 'NEAR_OTHER_DRIVER';
  } | null;
}

// Extensible AI Verification Interfaces
export interface PlateReader {
  readPlate(imageBuffer: Buffer): Promise<{ status: CheckStatus; text?: string; confidence?: number }>;
}

export class NoopPlateReader implements PlateReader {
  async readPlate(_imageBuffer?: Buffer): Promise<{ status: CheckStatus; text?: string }> {
    return { status: 'WARN', text: 'UNKNOWN' };
  }
}

export interface PosterMatcher {
  matchPoster(imageBuffer?: Buffer, posterPreviewUrl?: string): Promise<{ status: CheckStatus; similarity?: number }>;
}

export class NoopPosterMatcher implements PosterMatcher {
  async matchPoster(_imageBuffer?: Buffer, _posterPreviewUrl?: string): Promise<{ status: CheckStatus; similarity?: number }> {
    return { status: 'WARN', similarity: 0 };
  }
}
