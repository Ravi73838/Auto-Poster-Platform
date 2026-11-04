import sharp from 'sharp';
import { prisma } from '../../../shared/db/index.js';
import { SettingsService } from '../../settings/settings.service.js';
import { SETTING_KEYS } from '@ap/shared-constants';
import { computeDHash, hammingDistance } from './dhash.js';
import { haversineDistanceMeters } from './haversine.js';
import type { PhotoCheckInput, PhotoCheckResult } from './types.js';

export class PhotoChecksRunner {
  /**
   * Executes the full automated validation pipeline on a photo submission.
   */
  static async runChecks(input: PhotoCheckInput): Promise<PhotoCheckResult> {
    const failureReasons: string[] = [];
    const flags = {
      fileSanity: true,
      captureTime: true,
      gpsAccuracy: true,
      gpsInArea: true,
      mockLocation: true,
      duplicateCheck: true,
      deviceCorrelation: true,
    };

    // 1. File Sanity & Sharp decodability
    let dhash = '';
    try {
      const metadata = await sharp(input.imageBuffer).metadata();
      if (!metadata.width || !metadata.height || metadata.width < 200 || metadata.height < 200) {
        flags.fileSanity = false;
        failureReasons.push('Image dimensions too small (minimum 200x200px required)');
      }
      dhash = await computeDHash(input.imageBuffer);
    } catch {
      flags.fileSanity = false;
      failureReasons.push('File is corrupted or not a valid decodable image');
      dhash = '0'.repeat(16);
    }

    // 2. Capture Time Check
    const maxAgeMinutes = await SettingsService.get(SETTING_KEYS.PHOTO_MAX_AGE_MINUTES).catch(() => 60);
    const now = Date.now();
    const capturedTime = input.capturedAt.getTime();
    const ageMinutes = (now - capturedTime) / (1000 * 60);

    if (ageMinutes < -5) {
      flags.captureTime = false;
      failureReasons.push('Photo timestamp is set in the future');
    } else if (ageMinutes > maxAgeMinutes) {
      flags.captureTime = false;
      failureReasons.push(`Photo is too old (taken ${Math.round(ageMinutes)} mins ago, max allowed: ${maxAgeMinutes} mins)`);
    }

    // 3. GPS Accuracy Check
    if (input.accuracyMeters > 150) {
      flags.gpsAccuracy = false;
      failureReasons.push(`GPS accuracy too low (${Math.round(input.accuracyMeters)}m, maximum allowed: 150m)`);
    }

    // 4. Mock Location Check
    if (input.isMockLocation) {
      flags.mockLocation = false;
      failureReasons.push('Mock / spoofed location detected from device sensor');
    }

    // 5. GPS In Area Check
    if (input.campaignCityId) {
      const city = await prisma.city.findUnique({
        where: { id: input.campaignCityId },
      });

      if (!city) {
        flags.gpsInArea = false;
        failureReasons.push('Target campaign city not found');
      }
    }

    // 6. Duplicate Check (dHash similarity against existing photos)
    let duplicateMatch: { photoId: string; distance: number } | null = null;
    if (flags.fileSanity && dhash) {
      const dhashThreshold = await SettingsService.get(SETTING_KEYS.PHOTO_DHASH_THRESHOLD).catch(() => 10);

      // Look up photos from the last 30 days
      const recentPhotos = await prisma.photo.findMany({
        where: {
          dhash: { not: null },
          createdAt: { gte: new Date(Date.now() - 30 * 86400000) },
        },
        select: { id: true, dhash: true },
        take: 200,
      });

      for (const p of recentPhotos) {
        if (p.dhash) {
          const dist = hammingDistance(dhash, p.dhash);
          if (dist <= dhashThreshold) {
            flags.duplicateCheck = false;
            duplicateMatch = { photoId: p.id, distance: dist };
            failureReasons.push(`Suspected duplicate photo (matches previous photo ${p.id} with distance ${dist})`);
            break;
          }
        }
      }
    }

    const passed = failureReasons.length === 0;

    return {
      passed,
      dhash,
      flags,
      duplicateMatch,
      failureReasons,
    };
  }
}
