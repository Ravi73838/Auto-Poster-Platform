import crypto from 'node:crypto';
import sharp from 'sharp';
import { prisma } from '../../../shared/db/index.js';
import { ERROR_CODES, SETTING_KEYS } from '@ap/shared-constants';
import { SettingsService } from '../../settings/settings.service.js';
import { computeDHash, hammingDistance } from './dhash.js';
import { haversineDistanceMeters } from './haversine.js';
import {
  getDayCutoffUtc,
  isDayCutoffPassed,
} from '../../assignment-days/assignment-days.math.js';
import {
  toISTDate,
  TimeService,
} from '../../../shared/time/index.js';
import {
  NoopPlateReader,
  NoopPosterMatcher,
  type DailyPhotoCheckInput,
  type DailyPhotoCheckSummary,
  type IndividualCheckResult,
} from './types.js';

export class DailyPhotoChecksRunner {
  static plateReader = new NoopPlateReader();
  static posterMatcher = new NoopPosterMatcher();

  /**
   * Helper to compute SHA-256 hash of image buffer.
   */
  static computeFileSha256(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Runs the complete suite of daily photo checks.
   */
  static async runChecks(input: DailyPhotoCheckInput): Promise<DailyPhotoCheckSummary> {
    const nowUtc = input.nowUtc ?? TimeService.now();
    const hardFailures: Array<{ errorCode: string; message: string }> = [];
    const softFlags: Record<string, IndividualCheckResult> = {};
    let totalRiskScore = 0;

    // 0. File Sanity & Sharp decodability + dHash
    let dhash = '';
    try {
      const meta = await sharp(input.imageBuffer).metadata();
      if (!meta.width || !meta.height || meta.width < 300 || meta.height < 300) {
        hardFailures.push({
          errorCode: ERROR_CODES.PHOTO_INTEGRITY_FAILED,
          message: 'Image resolution too small. Minimum 300x300 pixels required.',
        });
      }
      dhash = await computeDHash(input.imageBuffer);
    } catch {
      hardFailures.push({
        errorCode: ERROR_CODES.PHOTO_INTEGRITY_FAILED,
        message: 'Corrupted image file. Unable to decode image buffer.',
      });
      dhash = '0'.repeat(16);
    }

    // Load assignment & campaign metadata
    const assignment = await prisma.assignment.findUnique({
      where: { id: input.assignmentId },
      include: {
        campaign: {
          include: {
            city: true,
            campaignZones: { include: { zone: true } },
          },
        },
      },
    });

    if (!assignment) {
      hardFailures.push({
        errorCode: ERROR_CODES.ASSIGNMENT_NOT_FOUND,
        message: 'Assignment not found',
      });
      return {
        hardFailures,
        softFlags,
        riskScore: 100,
        dhash,
        fileSha256: input.fileSha256,
        autoVerifyEligible: false,
      };
    }

    // 1. Capture Date Check (HARD)
    const lateGraceHours = await SettingsService.get(SETTING_KEYS.DAILY_PHOTO_LATE_GRACE_HOURS).catch(() => 12);
    const photoDateIST = toISTDate(input.capturedAt);
    const campaignStartDateIST = toISTDate(assignment.campaign.startDate);
    const campaignEndDateIST = toISTDate(assignment.campaign.endDate);

    // Run start date is max(campaign.startDate, installApprovalDate)
    let approvalDateIST = campaignStartDateIST;
    if (assignment.installApprovedAt) {
      approvalDateIST = toISTDate(assignment.installApprovedAt);
    }
    const runStartDateIST = approvalDateIST > campaignStartDateIST ? approvalDateIST : campaignStartDateIST;
    const runEndDateIST = campaignEndDateIST;

    // Check future capture time (2 minute tolerance)
    const twoMinFuture = nowUtc.getTime() + 120 * 1000;
    if (input.capturedAt.getTime() > twoMinFuture) {
      hardFailures.push({
        errorCode: ERROR_CODES.DAILY_PHOTO_DATE_INVALID,
        message: 'Photo capture timestamp is in the future.',
      });
    }

    // Check inside run window
    if (photoDateIST < runStartDateIST || photoDateIST > runEndDateIST) {
      hardFailures.push({
        errorCode: ERROR_CODES.DAILY_PHOTO_DATE_INVALID,
        message: `Photo date (${photoDateIST}) is outside the campaign active run window [${runStartDateIST} to ${runEndDateIST}].`,
      });
    }

    // Check if cutoff has already passed for this photo's date
    if (isDayCutoffPassed(photoDateIST, nowUtc, lateGraceHours)) {
      hardFailures.push({
        errorCode: ERROR_CODES.DAILY_PHOTO_DATE_INVALID,
        message: `Submission deadline for date ${photoDateIST} has already passed.`,
      });
    }

    // 2. GPS Accuracy & Mock Location (HARD)
    if (input.isMockLocation) {
      hardFailures.push({
        errorCode: ERROR_CODES.PHOTO_MOCK_LOCATION_DETECTED,
        message: 'Mock location or hardware GPS spoofing detected.',
      });
    }

    if (input.accuracyMeters > 150) {
      hardFailures.push({
        errorCode: ERROR_CODES.PHOTO_INTEGRITY_FAILED,
        message: `GPS accuracy too low (${Math.round(input.accuracyMeters)}m, max allowed: 150m).`,
      });
    }

    // 3. Exact Duplicate File (HARD)
    const existingExactFile = await prisma.photo.findFirst({
      where: {
        fileSha256: input.fileSha256,
      },
      select: { id: true },
    });

    if (existingExactFile) {
      hardFailures.push({
        errorCode: ERROR_CODES.DUPLICATE_PHOTO,
        message: 'Exact duplicate photo file detected. Please capture a new live photo.',
      });
    }

    // If hard failures occurred, return immediately without calculating soft flags
    if (hardFailures.length > 0) {
      return {
        hardFailures,
        softFlags,
        riskScore: 100,
        dhash,
        fileSha256: input.fileSha256,
        autoVerifyEligible: false,
      };
    }

    // 4. GPS In Area Check (SOFT)
    const zones = assignment.campaign.campaignZones.map((cz) => cz.zone);
    let isInCampaignZone = false;
    let closestZoneDist = Infinity;

    for (const z of zones) {
      const dist = haversineDistanceMeters(input.latitude, input.longitude, z.centerLat, z.centerLng);
      if (dist <= z.radiusMeters + input.accuracyMeters) {
        isInCampaignZone = true;
        break;
      }
      if (dist < closestZoneDist) closestZoneDist = dist;
    }

    if (isInCampaignZone) {
      softFlags['gps-in-area'] = {
        name: 'gps-in-area',
        status: 'PASS',
        severity: 'SOFT',
        score: 0,
        details: { zoneMatch: true },
      };
    } else {
      // Check city scope
      const city = assignment.campaign.city;
      // If city coordinates or zones exist, check city proximity
      if (zones.length > 0) {
        const cityCenterLat = zones[0]!.centerLat;
        const cityCenterLng = zones[0]!.centerLng;
        const distFromCity = haversineDistanceMeters(input.latitude, input.longitude, cityCenterLat, cityCenterLng);

        if (distFromCity <= 25000) {
          // Inside city but outside campaign zone
          softFlags['gps-in-area'] = {
            name: 'gps-in-area',
            status: 'WARN',
            severity: 'SOFT',
            score: 15,
            details: { inCity: true, outsideZone: true, distMeters: Math.round(closestZoneDist) },
          };
          totalRiskScore += 15;
        } else {
          // Outside city
          softFlags['gps-in-area'] = {
            name: 'gps-in-area',
            status: 'FAIL',
            severity: 'SOFT',
            score: 35,
            details: { outsideCity: true, distMeters: Math.round(distFromCity) },
          };
          totalRiskScore += 35;
        }
      } else {
        softFlags['gps-in-area'] = {
          name: 'gps-in-area',
          status: 'PASS',
          severity: 'SOFT',
          score: 0,
        };
      }
    }

    // 5. Near Duplicate Check (dHash similarity against same assignment and other drivers)
    const sameThreshold = await SettingsService.get(SETTING_KEYS.PHASH_SAME_ASSIGNMENT_THRESHOLD).catch(() => 2);
    const otherThreshold = await SettingsService.get(SETTING_KEYS.PHASH_DUPLICATE_THRESHOLD).catch(() => 6);

    let duplicateMatch: DailyPhotoCheckSummary['duplicateMatch'] = null;

    // Check same assignment recent photos
    const ownRecentPhotos = await prisma.photo.findMany({
      where: {
        assignmentId: input.assignmentId,
        dhash: { not: null },
      },
      select: { id: true, dhash: true },
      take: 30,
    });

    for (const p of ownRecentPhotos) {
      if (p.dhash) {
        const dist = hammingDistance(dhash, p.dhash);
        if (dist <= sameThreshold) {
          duplicateMatch = {
            photoId: p.id,
            distance: dist,
            matchType: 'NEAR_SAME_ASSIGNMENT',
          };
          break;
        }
      }
    }

    if (!duplicateMatch) {
      // Check other drivers' recent photos in the last 14 days
      const otherPhotos = await prisma.photo.findMany({
        where: {
          assignmentId: { not: input.assignmentId },
          dhash: { not: null },
          createdAt: { gte: new Date(nowUtc.getTime() - 14 * 86400000) },
        },
        select: { id: true, dhash: true },
        take: 200,
      });

      for (const p of otherPhotos) {
        if (p.dhash) {
          const dist = hammingDistance(dhash, p.dhash);
          if (dist <= otherThreshold) {
            duplicateMatch = {
              photoId: p.id,
              distance: dist,
              matchType: 'NEAR_OTHER_DRIVER',
            };
            break;
          }
        }
      }
    }

    if (duplicateMatch) {
      const score = duplicateMatch.matchType === 'NEAR_SAME_ASSIGNMENT' ? 50 : 40;
      softFlags['near-duplicate'] = {
        name: 'near-duplicate',
        status: 'FAIL',
        severity: 'SOFT',
        score,
        details: duplicateMatch,
      };
      totalRiskScore += score;
    } else {
      softFlags['near-duplicate'] = {
        name: 'near-duplicate',
        status: 'PASS',
        severity: 'SOFT',
        score: 0,
      };
    }

    // 6. Stationary Location Check (SOFT)
    const stationaryRadiusMeters = await SettingsService.get(SETTING_KEYS.STATIONARY_RADIUS_METERS).catch(() => 30);
    const stationaryDaysThreshold = await SettingsService.get(SETTING_KEYS.STATIONARY_DAYS_FLAG).catch(() => 3);

    const pastVerifiedPhotos = await prisma.photo.findMany({
      where: {
        assignmentId: input.assignmentId,
        status: 'VERIFIED',
      },
      orderBy: { capturedAt: 'desc' },
      take: stationaryDaysThreshold,
    });

    if (pastVerifiedPhotos.length >= stationaryDaysThreshold) {
      let isStationary = true;
      for (const p of pastVerifiedPhotos) {
        const dist = haversineDistanceMeters(input.latitude, input.longitude, p.lat, p.lng);
        if (dist > stationaryRadiusMeters) {
          isStationary = false;
          break;
        }
      }

      if (isStationary) {
        softFlags['stationary'] = {
          name: 'stationary',
          status: 'WARN',
          severity: 'SOFT',
          score: 25,
          details: { consecutiveDays: pastVerifiedPhotos.length, stationaryRadiusMeters },
        };
        totalRiskScore += 25;
      } else {
        softFlags['stationary'] = {
          name: 'stationary',
          status: 'PASS',
          severity: 'SOFT',
          score: 0,
        };
      }
    } else {
      softFlags['stationary'] = {
        name: 'stationary',
        status: 'PASS',
        severity: 'SOFT',
        score: 0,
      };
    }

    // 7. Clock Skew & Offline Late Upload Check (SOFT)
    const clockSkewThresholdMinutes = await SettingsService.get(SETTING_KEYS.CLOCK_SKEW_FLAG_MINUTES).catch(() => 10);
    if (input.clientSentAt) {
      const skewMs = Math.abs(nowUtc.getTime() - input.clientSentAt.getTime());
      const skewMinutes = skewMs / 60000;
      if (skewMinutes > clockSkewThresholdMinutes) {
        softFlags['clock-skew'] = {
          name: 'clock-skew',
          status: 'WARN',
          severity: 'SOFT',
          score: 15,
          details: { skewMinutes: Math.round(skewMinutes) },
        };
        totalRiskScore += 15;
      } else {
        softFlags['clock-skew'] = {
          name: 'clock-skew',
          status: 'PASS',
          severity: 'SOFT',
          score: 0,
        };
      }
    } else {
      softFlags['clock-skew'] = {
        name: 'clock-skew',
        status: 'PASS',
        severity: 'SOFT',
        score: 0,
      };
    }

    // 8. Time of Day Check (SOFT)
    const hoursStartStr = await SettingsService.get(SETTING_KEYS.DAILY_PHOTO_HOURS_START).catch(() => '05:00');
    const hoursEndStr = await SettingsService.get(SETTING_KEYS.DAILY_PHOTO_HOURS_END).catch(() => '23:00');

    // Extract IST hour and minute
    const istTimeStr = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(input.capturedAt);

    if (istTimeStr < hoursStartStr || istTimeStr > hoursEndStr) {
      softFlags['time-of-day'] = {
        name: 'time-of-day',
        status: 'WARN',
        severity: 'SOFT',
        score: 15,
        details: { istTime: istTimeStr, allowedWindow: `${hoursStartStr} - ${hoursEndStr}` },
      };
      totalRiskScore += 15;
    } else {
      softFlags['time-of-day'] = {
        name: 'time-of-day',
        status: 'PASS',
        severity: 'SOFT',
        score: 0,
      };
    }

    // 9. Device Correlation Check (SOFT)
    const deviceInstallId = input.deviceInfo?.deviceInstallId;
    if (deviceInstallId) {
      const otherDevicePhotos = await prisma.photo.findFirst({
        where: {
          driverId: { not: input.driverId },
          autoCheckFlags: {
            path: ['deviceInstallId'],
            equals: deviceInstallId,
          },
        },
        select: { driverId: true },
      });

      if (otherDevicePhotos) {
        softFlags['device-correlation'] = {
          name: 'device-correlation',
          status: 'WARN',
          severity: 'SOFT',
          score: 25,
          details: { sharedWithDriverId: otherDevicePhotos.driverId },
        };
        totalRiskScore += 25;
      } else {
        softFlags['device-correlation'] = {
          name: 'device-correlation',
          status: 'PASS',
          severity: 'SOFT',
          score: 0,
        };
      }
    } else {
      softFlags['device-correlation'] = {
        name: 'device-correlation',
        status: 'PASS',
        severity: 'SOFT',
        score: 0,
      };
    }

    // 10. Plate Reader and Poster Matcher (AI plugin points, NO-OP default)
    const plateResult = await this.plateReader.readPlate(input.imageBuffer);
    softFlags['plate-visible'] = {
      name: 'plate-visible',
      status: plateResult.status,
      severity: 'SOFT',
      score: 0, // NO-OP doesn't penalize
      details: { text: plateResult.text },
    };

    const posterResult = await this.posterMatcher.matchPoster(input.imageBuffer);
    softFlags['poster-visible'] = {
      name: 'poster-visible',
      status: posterResult.status,
      severity: 'SOFT',
      score: 0,
      details: { similarity: posterResult.similarity },
    };

    // Cap total risk score at 100
    const finalRiskScore = Math.min(100, totalRiskScore);

    // Auto-verify criteria:
    // 1. No hard failures
    // 2. No soft check with status 'FAIL'
    // 3. finalRiskScore <= risk_auto_verify_max_score (default 20)
    const maxAutoScore = await SettingsService.get(SETTING_KEYS.RISK_AUTO_VERIFY_MAX_SCORE).catch(() => 20);
    const hasSoftFail = Object.values(softFlags).some((f) => f.status === 'FAIL');
    const autoVerifyEligible = !hasSoftFail && finalRiskScore <= maxAutoScore;

    return {
      hardFailures,
      softFlags,
      riskScore: finalRiskScore,
      dhash,
      fileSha256: input.fileSha256,
      autoVerifyEligible,
      duplicateMatch,
    };
  }
}

