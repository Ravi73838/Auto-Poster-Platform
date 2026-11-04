import crypto from 'node:crypto';
import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';
import {
  ROLES,
  ACCOUNT_STATUS,
  FILE_PURPOSES,
  FILE_STATUS,
  CAMPAIGN_STATUS,
  SETTING_KEYS,
  ACTOR_TYPES,
  ERROR_CODES,
  type Role,
  type AccountStatus,
} from '@ap/shared-constants';
import type {
  PresignUploadInput,
  ConfirmUploadInput,
} from '@ap/shared-validation';
import type {
  PresignedUploadResponse,
  UploadedFileDto,
  SignedFileUrlResponse,
} from '@ap/shared-types';
import { prisma } from '../../shared/db/index.js';
import { AppError } from '../../shared/errors/index.js';
import { storageProvider, fileVirusScanner } from '../../integrations/storage/index.js';
import { SettingsService } from '../settings/settings.service.js';
import { AuditService } from '../audit/audit.service.js';
import { logger } from '../../shared/logger/index.js';

export interface PresignUserContext {
  userId: string;
  role: Role;
  status: AccountStatus;
}

export class UploadsService {
  /**
   * Generates a presigned S3 upload URL after verifying role permissions and file constraints.
   */
  static async presignUpload(
    userId: string,
    role: Role,
    input: PresignUploadInput,
    status?: AccountStatus,
  ): Promise<PresignedUploadResponse> {
    // 1. Role-based purpose authorization
    if (role === ROLES.DRIVER) {
      if (
        input.purpose !== FILE_PURPOSES.KYC_DOCUMENT &&
        input.purpose !== FILE_PURPOSES.VEHICLE_PHOTO &&
        input.purpose !== FILE_PURPOSES.INSTALLATION_PHOTO &&
        input.purpose !== FILE_PURPOSES.DAILY_PHOTO &&
        input.purpose !== FILE_PURPOSES.DISPUTE_EVIDENCE
      ) {
        throw new AppError(
          ERROR_CODES.FORBIDDEN,
          403,
          'Drivers are not authorized to upload for this purpose',
        );
      }
    } else if (role === ROLES.COMPANY) {
      if (
        input.purpose !== FILE_PURPOSES.KYC_DOCUMENT &&
        input.purpose !== FILE_PURPOSES.CAMPAIGN_POSTER &&
        input.purpose !== FILE_PURPOSES.DISPUTE_EVIDENCE
      ) {
        throw new AppError(
          ERROR_CODES.FORBIDDEN,
          403,
          'Companies are not authorized to upload for this purpose',
        );
      }

      if (input.purpose === FILE_PURPOSES.CAMPAIGN_POSTER) {
        if (status && status !== ACCOUNT_STATUS.APPROVED) {
          throw new AppError(
            ERROR_CODES.ACCOUNT_NOT_APPROVED,
            403,
            'Only approved companies can upload campaign posters',
          );
        }
        if (input.mimeType === 'application/pdf') {
          throw new AppError(
            ERROR_CODES.FILE_TYPE_NOT_ALLOWED,
            400,
            'PDF format is not permitted for campaign posters (JPEG, PNG, WEBP only)',
          );
        }
      }
    } else if (role === ROLES.FINANCE) {
      throw new AppError(
        ERROR_CODES.FORBIDDEN,
        403,
        'Finance role is not authorized to upload files',
      );
    }

    // 2. Validate max upload size against platform setting
    let maxBytes = 8388608; // 8 MB default
    try {
      if (input.purpose === FILE_PURPOSES.CAMPAIGN_POSTER) {
        maxBytes = await SettingsService.get(SETTING_KEYS.MAX_POSTER_UPLOAD_BYTES);
      } else {
        maxBytes = await SettingsService.get(SETTING_KEYS.UPLOAD_MAX_BYTES);
      }
    } catch {
      maxBytes = input.purpose === FILE_PURPOSES.CAMPAIGN_POSTER ? 26214400 : 8388608;
    }

    if (input.sizeBytes > maxBytes) {
      throw new AppError(
        ERROR_CODES.FILE_TOO_LARGE,
        400,
        `File size (${input.sizeBytes} bytes) exceeds the allowed limit of ${maxBytes} bytes`,
      );
    }

    // 3. Determine file extension
    const extMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'application/pdf': '.pdf',
    };
    const ext = extMap[input.mimeType] ?? '.bin';

    // 4. Generate partitioned S3 key: <purpose_lower>/<userId>/<uuid>.<ext>
    const subFolder = input.purpose.toLowerCase();
    const fileId = crypto.randomUUID();
    const fileKey = `${subFolder}/${userId}/${fileId}${ext}`;

    // 5. Create pending record in database
    const uploadedFile = await prisma.uploadedFile.create({
      data: {
        id: fileId,
        ownerUserId: userId,
        fileKey,
        purpose: input.purpose,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        status: FILE_STATUS.PENDING,
      },
    });

    // 6. Request presigned upload URL from S3/MinIO
    const presigned = await storageProvider.createUploadUrl(
      fileKey,
      input.mimeType,
      input.sizeBytes,
      300,
    );

    const expiresAt = new Date(Date.now() + 300 * 1000).toISOString();

    return {
      uploadUrl: presigned.uploadUrl,
      fileKey,
      fileId: uploadedFile.id,
      requiredHeaders: presigned.requiredHeaders,
      expiresAt,
    };
  }

  /**
   * Confirms upload: validates magic bytes, processes images with sharp,
   * generates thumbnails and previews, computes SHA-256, and marks record as CONFIRMED.
   */
  static async confirmUpload(
    userId: string,
    input: ConfirmUploadInput,
  ): Promise<UploadedFileDto> {
    const file = await prisma.uploadedFile.findUnique({
      where: { fileKey: input.fileKey },
    });

    if (!file) {
      throw new AppError(ERROR_CODES.FILE_NOT_FOUND, 404, 'Uploaded file record not found');
    }

    if (file.ownerUserId !== userId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 403, 'You do not own this uploaded file');
    }

    if (file.status === FILE_STATUS.CONFIRMED) {
      return {
        id: file.id,
        fileKey: file.fileKey,
        purpose: file.purpose,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        status: file.status,
        sha256: file.sha256,
        width: file.width,
        height: file.height,
        createdAt: file.createdAt.toISOString(),
        confirmedAt: file.confirmedAt?.toISOString() ?? null,
      };
    }

    // 1. Download buffer from storage
    let rawBuffer: Buffer;
    try {
      rawBuffer = await storageProvider.getObject(file.fileKey);
    } catch (err) {
      logger.error({ err, fileKey: file.fileKey }, 'Failed to fetch object from storage for confirmation');
      throw new AppError(
        ERROR_CODES.UPLOAD_NOT_CONFIRMED,
        400,
        'File has not been uploaded to the presigned destination yet',
      );
    }

    // 2. Validate real file type by magic bytes
    let detectedMime: string | undefined;
    const detected = await fileTypeFromBuffer(rawBuffer);

    if (detected) {
      detectedMime = detected.mime;
    } else if (rawBuffer.subarray(0, 5).toString() === '%PDF-') {
      detectedMime = 'application/pdf';
    }

    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!detectedMime || !allowedMimes.includes(detectedMime) || (file.mimeType !== detectedMime && !(file.mimeType === 'image/jpeg' && detectedMime === 'image/jpeg'))) {
      logger.warn(
        { declared: file.mimeType, detected: detectedMime, fileKey: file.fileKey },
        'MIME type mismatch or unsupported file detected',
      );
      await storageProvider.delete(file.fileKey).catch(() => {});
      await prisma.uploadedFile.update({
        where: { id: file.id },
        data: { status: FILE_STATUS.REJECTED },
      });
      throw new AppError(
        ERROR_CODES.FILE_TYPE_NOT_ALLOWED,
        400,
        `File content does not match allowed MIME type. Detected: ${detectedMime ?? 'unknown'}`,
      );
    }

    // 3. Virus scanning check
    const scanResult = await fileVirusScanner.scan(rawBuffer, file.fileKey);
    if (!scanResult.isClean) {
      await storageProvider.delete(file.fileKey).catch(() => {});
      await prisma.uploadedFile.update({
        where: { id: file.id },
        data: { status: FILE_STATUS.REJECTED },
      });
      throw new AppError(
        ERROR_CODES.FILE_TYPE_NOT_ALLOWED,
        400,
        `File failed security check: ${scanResult.threatName ?? 'Malware detected'}`,
      );
    }

    let finalBuffer = rawBuffer;
    let width: number | null = null;
    let height: number | null = null;
    let previewKey: string | null = null;
    let thumbnailKey: string | null = null;

    // 4. Processing based on purpose
    if (file.purpose === FILE_PURPOSES.CAMPAIGN_POSTER) {
      if (detectedMime === 'application/pdf') {
        await storageProvider.delete(file.fileKey).catch(() => {});
        await prisma.uploadedFile.update({
          where: { id: file.id },
          data: { status: FILE_STATUS.REJECTED },
        });
        throw new AppError(
          ERROR_CODES.FILE_TYPE_NOT_ALLOWED,
          400,
          'PDF format is not permitted for campaign posters',
        );
      }

      try {
        const metadata = await sharp(rawBuffer).metadata();
        width = metadata.width ?? null;
        height = metadata.height ?? null;

        let minPosterWidth = 1200;
        try {
          minPosterWidth = await SettingsService.get(SETTING_KEYS.MIN_POSTER_WIDTH_PX);
        } catch {
          minPosterWidth = 1200;
        }

        if (!width || width < minPosterWidth) {
          await storageProvider.delete(file.fileKey).catch(() => {});
          await prisma.uploadedFile.update({
            where: { id: file.id },
            data: { status: FILE_STATUS.REJECTED },
          });
          throw new AppError(
            ERROR_CODES.CAMPAIGN_POSTER_TOO_SMALL,
            400,
            `Poster width (${width ?? 0}px) is less than required minimum of ${minPosterWidth}px`,
          );
        }

        // Do NOT downscale original. Auto-rotate based on EXIF then strip EXIF.
        finalBuffer = await sharp(rawBuffer).rotate().toBuffer();
        await storageProvider.putObject(file.fileKey, finalBuffer, detectedMime);

        // Generate Preview (longest side 1600 px)
        const previewBuffer = await sharp(rawBuffer)
          .rotate()
          .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
          .toBuffer();
        previewKey = `${file.fileKey}.preview`;
        await storageProvider.putObject(previewKey, previewBuffer, detectedMime);

        // Generate Thumbnail (400 px)
        const thumbBuffer = await sharp(rawBuffer)
          .rotate()
          .resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
          .toBuffer();
        thumbnailKey = `${file.fileKey}.thumb`;
        await storageProvider.putObject(thumbnailKey, thumbBuffer, detectedMime);
      } catch (err: unknown) {
        if (err instanceof AppError) throw err;
        logger.error({ err, fileKey: file.fileKey }, 'Failed to process campaign poster image');
        await storageProvider.delete(file.fileKey).catch(() => {});
        await prisma.uploadedFile.update({
          where: { id: file.id },
          data: { status: FILE_STATUS.REJECTED },
        });
        throw new AppError(ERROR_CODES.FILE_TYPE_NOT_ALLOWED, 400, 'Corrupted or malformed image');
      }
    } else if (detectedMime.startsWith('image/')) {
      // General image normalization (strip EXIF, auto-rotate, limit 2400px, create 320px thumbnail)
      try {
        const processed = await sharp(rawBuffer)
          .rotate()
          .resize({
            width: 2400,
            height: 2400,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .toBuffer({ resolveWithObject: true });

        finalBuffer = processed.data;
        width = processed.info.width;
        height = processed.info.height;

        const thumbBuffer = await sharp(finalBuffer)
          .resize({
            width: 320,
            height: 320,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .toBuffer();

        thumbnailKey = `${file.fileKey}.thumb`;
        await storageProvider.putObject(thumbnailKey, thumbBuffer, detectedMime);
        await storageProvider.putObject(file.fileKey, finalBuffer, detectedMime);
      } catch (sharpErr) {
        logger.error({ sharpErr, fileKey: file.fileKey }, 'Sharp failed to process image');
        await storageProvider.delete(file.fileKey).catch(() => {});
        await prisma.uploadedFile.update({
          where: { id: file.id },
          data: { status: FILE_STATUS.REJECTED },
        });
        throw new AppError(
          ERROR_CODES.FILE_TYPE_NOT_ALLOWED,
          400,
          'Corrupted or malformed image file',
        );
      }
    } else if (detectedMime === 'application/pdf') {
      if (rawBuffer.length > 5 * 1024 * 1024) {
        await storageProvider.delete(file.fileKey).catch(() => {});
        await prisma.uploadedFile.update({
          where: { id: file.id },
          data: { status: FILE_STATUS.REJECTED },
        });
        throw new AppError(
          ERROR_CODES.FILE_TOO_LARGE,
          400,
          'PDF documents must not exceed 5 MB in size',
        );
      }
    }

    // 5. Compute SHA-256 checksum
    const sha256 = crypto.createHash('sha256').update(finalBuffer).digest('hex');

    // 6. Mark confirmed in DB
    const confirmedFile = await prisma.uploadedFile.update({
      where: { id: file.id },
      data: {
        status: FILE_STATUS.CONFIRMED,
        sizeBytes: finalBuffer.length,
        sha256,
        width,
        height,
        previewKey,
        thumbnailKey,
        confirmedAt: new Date(),
      },
    });

    return {
      id: confirmedFile.id,
      fileKey: confirmedFile.fileKey,
      purpose: confirmedFile.purpose,
      mimeType: confirmedFile.mimeType,
      sizeBytes: confirmedFile.sizeBytes,
      status: confirmedFile.status,
      sha256: confirmedFile.sha256,
      width: confirmedFile.width,
      height: confirmedFile.height,
      createdAt: confirmedFile.createdAt.toISOString(),
      confirmedAt: confirmedFile.confirmedAt?.toISOString() ?? null,
    };
  }
}

export interface GetSignedUrlOptions {
  variant?: 'original' | 'preview' | 'thumbnail';
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class FileAccessService {
  /**
   * Generates a signed read URL for authorized roles and records an audit log entry.
   * Access Matrix:
   * - KYC_DOCUMENT: Only owner, and admins with kyc.review or SUPER_ADMIN. FINANCE role is strictly forbidden.
   * - CAMPAIGN_POSTER:
   *   - Company owner: can read original, preview, thumbnail.
   *   - Admins with campaign.view or campaign.review: can read all 3. Audited.
   *   - Approved drivers: can read preview and thumbnail ONLY for LIVE or RUNNING campaigns in their city.
   */
  static async getSignedUrl(
    fileId: string,
    requester: { id: string; role: Role; status?: AccountStatus; permissions: string[] },
    options: GetSignedUrlOptions = {},
  ): Promise<SignedFileUrlResponse> {
    const file = await prisma.uploadedFile.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new AppError(ERROR_CODES.FILE_NOT_FOUND, 404, 'File not found');
    }

    const variant = options.variant ?? 'original';
    const isOwner = file.ownerUserId === requester.id;

    if (file.purpose === FILE_PURPOSES.KYC_DOCUMENT) {
      if (requester.role === ROLES.FINANCE) {
        throw new AppError(
          ERROR_CODES.FORBIDDEN,
          403,
          'Finance role is not authorized to view KYC documents',
        );
      }

      const hasReviewPermission =
        requester.permissions.includes('kyc.review') ||
        requester.permissions.includes('users:read') ||
        requester.permissions.includes('users:approve') ||
        requester.role === ROLES.SUPER_ADMIN;

      if (!isOwner && !hasReviewPermission) {
        throw new AppError(
          ERROR_CODES.FORBIDDEN,
          403,
          'You are not authorized to view this document',
        );
      }
    } else if (file.purpose === FILE_PURPOSES.CAMPAIGN_POSTER) {
      if (isOwner) {
        // Owner company can read all variants
      } else if (
        requester.permissions.includes('campaign.view') ||
        requester.permissions.includes('campaign.review') ||
        requester.permissions.includes('campaigns:read') ||
        requester.role === ROLES.SUPER_ADMIN
      ) {
        // Admins can read all variants
      } else if (requester.role === ROLES.DRIVER) {
        if (requester.status !== ACCOUNT_STATUS.APPROVED) {
          throw new AppError(
            ERROR_CODES.ACCOUNT_NOT_APPROVED,
            403,
            'Only approved drivers can view campaign posters',
          );
        }

        if (variant === 'original') {
          throw new AppError(
            ERROR_CODES.FORBIDDEN,
            403,
            'Original print file is only released after campaign selection',
          );
        }

        // Must belong to a LIVE or RUNNING campaign in driver's city
        const campaign = await prisma.campaign.findFirst({
          where: {
            posterFileId: file.id,
            status: { in: [CAMPAIGN_STATUS.LIVE, CAMPAIGN_STATUS.RUNNING] },
          },
        });

        if (!campaign) {
          throw new AppError(
            ERROR_CODES.FORBIDDEN,
            403,
            'Campaign poster is not currently available for viewing',
          );
        }

        const driverProfile = await prisma.driverProfile.findUnique({
          where: { userId: requester.id },
        });

        if (!driverProfile || driverProfile.cityId !== campaign.cityId) {
          throw new AppError(
            ERROR_CODES.FORBIDDEN,
            403,
            'This campaign is not available in your city',
          );
        }
      } else {
        throw new AppError(
          ERROR_CODES.FORBIDDEN,
          403,
          'You are not authorized to view this campaign poster',
        );
      }
    } else {
      // General files
      if (!isOwner && requester.role !== ROLES.SUPER_ADMIN) {
        throw new AppError(ERROR_CODES.FORBIDDEN, 403, 'Access denied');
      }
    }

    // Determine target S3 key
    let targetKey = file.fileKey;
    if (variant === 'preview') {
      targetKey = file.previewKey ?? `${file.fileKey}.preview`;
    } else if (variant === 'thumbnail') {
      targetKey = file.thumbnailKey ?? `${file.fileKey}.thumb`;
    }

    let ttlSeconds = 300;
    try {
      ttlSeconds = await SettingsService.get(SETTING_KEYS.SIGNED_URL_TTL_SECONDS);
    } catch {
      ttlSeconds = 300;
    }

    const url = await storageProvider.getSignedReadUrl(targetKey, ttlSeconds);
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    // Audit log admin views
    if (
      requester.role === ROLES.SUPER_ADMIN ||
      requester.role === ROLES.MODERATOR ||
      requester.role === ROLES.FINANCE
    ) {
      await AuditService.log({
        actorId: requester.id,
        actorType: ACTOR_TYPES.USER,
        action: 'document.view',
        entityType: 'UploadedFile',
        entityId: file.id,
        newValues: {
          fileKey: targetKey,
          purpose: file.purpose,
          variant,
          reason: options.reason ?? 'DOCUMENT_VIEW',
        },
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
      });
    }

    return {
      fileId: file.id,
      url,
      expiresAt,
    };
  }
}
