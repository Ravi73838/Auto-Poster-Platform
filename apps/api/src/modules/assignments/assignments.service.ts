import { prisma } from '../../shared/db/index.js';
import {
  ROLES,
  ACCOUNT_STATUS,
  CAMPAIGN_STATUS,
  ASSIGNMENT_STATUS,
  ASSIGNMENT_RELEASE_REASONS,
  ACTOR_TYPES,
  SETTING_KEYS,
  ERROR_CODES,
  NEXT_ACTIONS,
  type AssignmentStatus,
  type NextAction,
} from '@ap/shared-constants';
import { AppError } from '../../shared/errors/index.js';
import { assignmentStateMachine } from './assignments.state-machine.js';
import { SlotsService } from '../campaigns/slots.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { AuditService } from '../audit/audit.service.js';
import { eventBus } from '../../events/index.js';
import { storageProvider } from '../../integrations/storage/index.js';
import { PhotoChecksRunner } from '../photos/checks/checks-runner.js';
import { toISTDate, diffDaysIST, TimeService } from '../../shared/time/index.js';
import type {
  CampaignSelectInput,
  SubmitInstallationPhotoInput,
  ListAssignmentsQuery,
} from '@ap/shared-validation';
import type {
  AssignmentDto,
  AssignmentDetailDto,
  InstallationPhotoDto,
} from '@ap/shared-types';

export class AssignmentsService {
  /**
   * Helper to calculate driver's next action based on current assignment lifecycle state.
   */
  static computeNextAction(assignment: {
    status: AssignmentStatus;
    expiresAt: Date;
    installAttempts: number;
    extraAttemptsGranted: number;
  }): { nextAction: NextAction; nextActionDeadline?: string | null } {
    switch (assignment.status) {
      case ASSIGNMENT_STATUS.RESERVED:
        return {
          nextAction: NEXT_ACTIONS.START_INSTALLING,
          nextActionDeadline: assignment.expiresAt.toISOString(),
        };
      case ASSIGNMENT_STATUS.INSTALLING:
        return {
          nextAction: NEXT_ACTIONS.SUBMIT_PHOTO,
          nextActionDeadline: assignment.expiresAt.toISOString(),
        };
      case ASSIGNMENT_STATUS.INSTALL_SUBMITTED:
        return {
          nextAction: NEXT_ACTIONS.WAIT_FOR_REVIEW,
          nextActionDeadline: null,
        };
      case ASSIGNMENT_STATUS.INSTALL_REJECTED:
        return {
          nextAction: NEXT_ACTIONS.FIX_INSTALLATION,
          nextActionDeadline: null,
        };
      case ASSIGNMENT_STATUS.INSTALL_APPROVED:
        return {
          nextAction: NEXT_ACTIONS.READY_TO_RUN,
          nextActionDeadline: null,
        };
      case ASSIGNMENT_STATUS.RUNNING:
        return {
          nextAction: NEXT_ACTIONS.RUNNING_DAILY_PHOTOS,
          nextActionDeadline: null,
        };
      case ASSIGNMENT_STATUS.COMPLETED:
      case ASSIGNMENT_STATUS.PAID:
        return {
          nextAction: NEXT_ACTIONS.CAMPAIGN_ENDED,
          nextActionDeadline: null,
        };
      default:
        return {
          nextAction: NEXT_ACTIONS.NONE,
          nextActionDeadline: null,
        };
    }
  }

  /**
   * Selects a campaign and reserves a slot for 48 hours with row locking.
   */
  static async selectCampaign(
    driverUserId: string,
    campaignId: string,
    input: CampaignSelectInput = {},
  ): Promise<AssignmentDto> {
    // 1. Verify Driver profile and status
    const driver = await prisma.user.findUnique({
      where: { id: driverUserId },
      include: { driverProfile: true },
    });

    if (!driver || driver.role !== ROLES.DRIVER) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 403, 'Only drivers can select campaigns');
    }

    if (driver.status !== ACCOUNT_STATUS.APPROVED) {
      throw new AppError(
        ERROR_CODES.ACCOUNT_NOT_APPROVED,
        403,
        'Your driver account must be approved before selecting campaigns',
      );
    }

    if (!driver.driverProfile?.currentVehicleId) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'You must have an active vehicle registered to select campaigns',
      );
    }

    const vehicleId = driver.driverProfile.currentVehicleId;

    // 2. Idempotency Check
    if (input.idempotencyKey) {
      const existing = await prisma.assignment.findUnique({
        where: { reservedIdempotencyKey: input.idempotencyKey },
        include: { campaign: true, vehicle: true },
      });
      if (existing) {
        return this.mapToDto(existing);
      }
    }

    // 3. Check for existing active assignment on driver
    const activeDriverAssignment = await prisma.assignment.findFirst({
      where: {
        driverId: driverUserId,
        status: {
          notIn: [
            ASSIGNMENT_STATUS.RESERVATION_EXPIRED,
            ASSIGNMENT_STATUS.TERMINATED,
            ASSIGNMENT_STATUS.COMPLETED,
            ASSIGNMENT_STATUS.PAID,
            ASSIGNMENT_STATUS.RELEASED,
          ],
        },
      },
    });

    if (activeDriverAssignment) {
      throw new AppError(
        ERROR_CODES.ASSIGNMENT_ALREADY_ACTIVE,
        409,
        'You already have an active campaign assignment. Complete or withdraw it before selecting a new one.',
      );
    }

    // 4. Check for existing active assignment on vehicle
    const activeVehicleAssignment = await prisma.assignment.findFirst({
      where: {
        vehicleId,
        status: {
          notIn: [
            ASSIGNMENT_STATUS.RESERVATION_EXPIRED,
            ASSIGNMENT_STATUS.TERMINATED,
            ASSIGNMENT_STATUS.COMPLETED,
            ASSIGNMENT_STATUS.PAID,
            ASSIGNMENT_STATUS.RELEASED,
          ],
        },
      },
    });

    if (activeVehicleAssignment) {
      throw new AppError(
        ERROR_CODES.ASSIGNMENT_VEHICLE_BUSY,
        409,
        'This vehicle is already enrolled in an active campaign.',
      );
    }

    // 5. Atomic Slot Lock & Creation in Transaction
    const reservationHoldHours = await SettingsService.get(SETTING_KEYS.RESERVATION_HOLD_HOURS).catch(() => 48);
    const now = TimeService.now();
    const expiresAt = new Date(now.getTime() + reservationHoldHours * 3600 * 1000);

    const assignment = await prisma.$transaction(
      async (tx) => {
        // Lock campaign and verify slots
        const usage = await SlotsService.lockCampaignForSlotChange(tx, campaignId);
        if (usage.available <= 0) {
          throw new AppError(ERROR_CODES.CAMPAIGN_SLOTS_FULL, 400, 'Campaign slots are currently full');
        }

        const campaign = await tx.campaign.findUnique({
          where: { id: campaignId },
        });

        if (!campaign) {
          throw new AppError(ERROR_CODES.CAMPAIGN_NOT_FOUND, 404, 'Campaign not found');
        }

        if (campaign.status !== CAMPAIGN_STATUS.LIVE && campaign.status !== CAMPAIGN_STATUS.RUNNING) {
          throw new AppError(
            ERROR_CODES.VALIDATION_ERROR,
            400,
            `Campaign is not open for driver enrolment (status: ${campaign.status})`,
          );
        }

        const startDateStr = toISTDate(campaign.startDate);
        const endDateStr = toISTDate(campaign.endDate);
        const totalDays = diffDaysIST(startDateStr, endDateStr);

        const created = await tx.assignment.create({
          data: {
            campaignId,
            driverId: driverUserId,
            vehicleId,
            status: ASSIGNMENT_STATUS.RESERVED,
            reservedAt: now,
            expiresAt,
            totalDays,
            reservedIdempotencyKey: input.idempotencyKey ?? null,
            reviewOwner: campaign.installApprover,
          },
          include: {
            campaign: true,
            vehicle: true,
          },
        });

        return created;
      },
      { timeout: 15000 },
    );

    // Audit log
    await AuditService.log({
      actorId: driverUserId,
      actorType: ACTOR_TYPES.USER,
      action: 'assignment.reserved',
      entityType: 'Assignment',
      entityId: assignment.id,
      newValues: {
        campaignId,
        driverId: driverUserId,
        vehicleId,
        expiresAt: expiresAt.toISOString(),
      },
    });

    eventBus.emit('assignment.reserved', {
      assignmentId: assignment.id,
      campaignId,
      driverId: driverUserId,
      expiresAt,
    });

    return this.mapToDto(assignment);
  }

  /**
   * Lists assignments belonging to the driver.
   */
  static async listDriverAssignments(
    driverUserId: string,
    query: ListAssignmentsQuery,
  ): Promise<{ items: AssignmentDto[] }> {
    const where: any = { driverId: driverUserId };
    if (query.status) {
      where.status = query.status;
    }

    const assignments = await prisma.assignment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: query.limit,
      include: {
        campaign: true,
        vehicle: true,
      },
    });

    return {
      items: assignments.map((a) => this.mapToDto(a)),
    };
  }

  /**
   * Retrieves full details, timeline, print guide and photos for an assignment.
   */
  static async getDriverAssignmentDetail(
    driverUserId: string,
    assignmentId: string,
  ): Promise<AssignmentDetailDto> {
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        campaign: {
          include: {
            city: true,
            company: { include: { companyProfile: true } },
            posterFile: true,
          },
        },
        vehicle: true,
        photos: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!assignment) {
      throw new AppError(ERROR_CODES.ASSIGNMENT_NOT_FOUND, 404, 'Assignment not found');
    }

    if (assignment.driverId !== driverUserId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 403, 'You do not own this assignment');
    }

    const campaign = assignment.campaign;
    const startDateStr = toISTDate(campaign.startDate);
    const endDateStr = toISTDate(campaign.endDate);
    const durationDays = diffDaysIST(startDateStr, endDateStr);

    let posterDownloadUrl: string | null = null;
    let posterThumbnailUrl: string | null = null;

    if (campaign.posterFile?.fileKey) {
      if (
        assignment.status !== ASSIGNMENT_STATUS.RELEASED &&
        assignment.status !== ASSIGNMENT_STATUS.RESERVATION_EXPIRED &&
        assignment.status !== ASSIGNMENT_STATUS.TERMINATED
      ) {
        posterDownloadUrl = await storageProvider.getSignedReadUrl(campaign.posterFile.fileKey, 3600);
      }
      if (campaign.posterFile.thumbnailKey) {
        posterThumbnailUrl = await storageProvider.getSignedReadUrl(campaign.posterFile.thumbnailKey, 3600);
      }
    }

    // Build timeline
    const timeline = [
      {
        step: 'Campaign Reserved',
        status: 'COMPLETED' as const,
        timestamp: assignment.reservedAt.toISOString(),
      },
      {
        step: 'Poster Installation',
        status: (assignment.installedAt
          ? 'COMPLETED'
          : assignment.status === ASSIGNMENT_STATUS.RESERVED || assignment.status === ASSIGNMENT_STATUS.INSTALLING
          ? 'CURRENT'
          : 'UPCOMING') as any,
        timestamp: assignment.installedAt?.toISOString() ?? null,
      },
      {
        step: 'Installation Review',
        status: (assignment.installApprovedAt
          ? 'COMPLETED'
          : assignment.status === ASSIGNMENT_STATUS.INSTALL_SUBMITTED
          ? 'CURRENT'
          : 'UPCOMING') as any,
        timestamp: assignment.installApprovedAt?.toISOString() ?? null,
      },
      {
        step: 'Active Daily Driving',
        status: (assignment.status === ASSIGNMENT_STATUS.RUNNING
          ? 'CURRENT'
          : assignment.status === ASSIGNMENT_STATUS.COMPLETED || assignment.status === ASSIGNMENT_STATUS.PAID
          ? 'COMPLETED'
          : 'UPCOMING') as any,
        timestamp: assignment.startedAt?.toISOString() ?? null,
      },
      {
        step: 'Settlement & Payout',
        status: (assignment.status === ASSIGNMENT_STATUS.PAID
          ? 'COMPLETED'
          : assignment.status === ASSIGNMENT_STATUS.COMPLETED
          ? 'CURRENT'
          : 'UPCOMING') as any,
        timestamp: assignment.endedAt?.toISOString() ?? null,
      },
    ];

    return {
      assignment: this.mapToDto(assignment),
      campaign: {
        id: campaign.id,
        title: campaign.title,
        companyName: campaign.company.companyProfile?.companyName ?? 'Company',
        startDate: startDateStr,
        endDate: endDateStr,
        durationDays,
        cityName: campaign.city?.name ?? 'City',
        printMaterial: campaign.printMaterial,
        printSize: campaign.printSize,
        printInstructions: campaign.printInstructions,
        posterDownloadUrl,
        posterThumbnailUrl,
      },
      installationPhotos: assignment.photos.map((p) => ({
        id: p.id,
        assignmentId: p.assignmentId,
        attemptNo: p.attemptNo,
        fileKey: p.photoUrl,
        status: p.status,
        latitude: p.lat,
        longitude: p.lng,
        accuracyMeters: p.accuracyMeters,
        capturedAt: p.capturedAt.toISOString(),
        reviewReasonCodes: (p.reviewReasonCodes as any) ?? null,
        duplicateFlags: (p.duplicateFlags as any) ?? null,
        rejectionReason: p.failureReason,
        verifiedAt: p.reviewedAt?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
      })),
      printGuide: {
        dimensions: campaign.printSize ?? 'Standard 24" x 12"',
        material: campaign.printMaterial,
        instructions: campaign.printInstructions ?? 'Ensure poster is securely affixed to the designated auto rear area without obscuring the vehicle license plate.',
        checklist: [
          { key: 'plateVisible', labelKey: 'install.checklist.plateVisible' },
          { key: 'noWrinkles', labelKey: 'install.checklist.noWrinkles' },
          { key: 'goodLighting', labelKey: 'install.checklist.goodLighting' },
          { key: 'fullPoster', labelKey: 'install.checklist.fullPoster' },
        ],
      },
      timeline,
    };
  }

  /**
   * Driver begins installation process (RESERVED -> INSTALLING).
   */
  static async startInstalling(driverUserId: string, assignmentId: string): Promise<AssignmentDto> {
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: { campaign: true, vehicle: true },
    });

    if (!assignment) {
      throw new AppError(ERROR_CODES.ASSIGNMENT_NOT_FOUND, 404, 'Assignment not found');
    }

    if (assignment.driverId !== driverUserId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 403, 'You do not own this assignment');
    }

    if (assignment.status !== ASSIGNMENT_STATUS.RESERVED) {
      throw new AppError(
        ERROR_CODES.ASSIGNMENT_NOT_RESERVED,
        400,
        `Assignment cannot transition to INSTALLING from status ${assignment.status}`,
      );
    }

    await assignmentStateMachine.assertTransition(ASSIGNMENT_STATUS.RESERVED, ASSIGNMENT_STATUS.INSTALLING);

    const updated = await prisma.assignment.update({
      where: { id: assignmentId },
      data: { status: ASSIGNMENT_STATUS.INSTALLING },
      include: { campaign: true, vehicle: true },
    });

    await AuditService.log({
      actorId: driverUserId,
      actorType: ACTOR_TYPES.USER,
      action: 'assignment.installing_started',
      entityType: 'Assignment',
      entityId: assignmentId,
      newValues: { status: ASSIGNMENT_STATUS.INSTALLING },
    });

    return this.mapToDto(updated);
  }

  /**
   * Driver voluntarily releases the reserved/installing slot.
   */
  static async withdraw(
    driverUserId: string,
    assignmentId: string,
    reason?: string,
  ): Promise<AssignmentDto> {
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: { campaign: true, vehicle: true },
    });

    if (!assignment) {
      throw new AppError(ERROR_CODES.ASSIGNMENT_NOT_FOUND, 404, 'Assignment not found');
    }

    if (assignment.driverId !== driverUserId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 403, 'You do not own this assignment');
    }

    if (
      assignment.status !== ASSIGNMENT_STATUS.RESERVED &&
      assignment.status !== ASSIGNMENT_STATUS.INSTALLING
    ) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        `Cannot withdraw assignment in status ${assignment.status}. Only RESERVED or INSTALLING slots can be released.`,
      );
    }

    await assignmentStateMachine.assertTransition(assignment.status, ASSIGNMENT_STATUS.RELEASED);

    const now = TimeService.now();
    const updated = await prisma.assignment.update({
      where: { id: assignmentId },
      data: {
        status: ASSIGNMENT_STATUS.RELEASED,
        releaseReason: ASSIGNMENT_RELEASE_REASONS.DRIVER_CANCELLED,
        releasedAt: now,
      },
      include: { campaign: true, vehicle: true },
    });

    await AuditService.log({
      actorId: driverUserId,
      actorType: ACTOR_TYPES.USER,
      action: 'assignment.withdrawn',
      entityType: 'Assignment',
      entityId: assignmentId,
      newValues: {
        status: ASSIGNMENT_STATUS.RELEASED,
        releaseReason: ASSIGNMENT_RELEASE_REASONS.DRIVER_CANCELLED,
        driverReason: reason ?? null,
      },
    });

    eventBus.emit('assignment.released', {
      assignmentId,
      campaignId: assignment.campaignId,
      driverId: driverUserId,
      reason: ASSIGNMENT_RELEASE_REASONS.DRIVER_CANCELLED,
    });

    return this.mapToDto(updated);
  }

  /**
   * Generates a signed download URL for the campaign poster creative.
   */
  static async getPosterDownloadUrl(
    driverUserId: string,
    assignmentId: string,
  ): Promise<{ downloadUrl: string; filename: string }> {
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        campaign: { include: { posterFile: true } },
      },
    });

    if (!assignment) {
      throw new AppError(ERROR_CODES.ASSIGNMENT_NOT_FOUND, 404, 'Assignment not found');
    }

    if (assignment.driverId !== driverUserId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 403, 'You do not own this assignment');
    }

    if (
      assignment.status === ASSIGNMENT_STATUS.RELEASED ||
      assignment.status === ASSIGNMENT_STATUS.RESERVATION_EXPIRED ||
      assignment.status === ASSIGNMENT_STATUS.TERMINATED
    ) {
      throw new AppError(
        ERROR_CODES.POSTER_DOWNLOAD_REVOKED,
        403,
        'Poster download is no longer accessible because the assignment is not active',
      );
    }

    const posterFile = assignment.campaign.posterFile;
    if (!posterFile) {
      throw new AppError(ERROR_CODES.FILE_NOT_FOUND, 404, 'Campaign poster file not found');
    }

    const downloadUrl = await storageProvider.getSignedReadUrl(posterFile.fileKey, 3600);

    await AuditService.log({
      actorId: driverUserId,
      actorType: ACTOR_TYPES.USER,
      action: 'poster.downloaded',
      entityType: 'Assignment',
      entityId: assignmentId,
      newValues: { campaignId: assignment.campaignId, fileKey: posterFile.fileKey },
    });

    return {
      downloadUrl,
      filename: `campaign-${assignment.campaign.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-poster.pdf`,
    };
  }

  /**
   * Submits a live installation photo, executes the photo checks pipeline,
   * records the attempt, and transitions assignment to INSTALL_SUBMITTED.
   */
  static async submitInstallationPhoto(
    driverUserId: string,
    assignmentId: string,
    input: SubmitInstallationPhotoInput,
  ): Promise<{ assignment: AssignmentDto; photo: InstallationPhotoDto }> {
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        campaign: true,
        vehicle: true,
      },
    });

    if (!assignment) {
      throw new AppError(ERROR_CODES.ASSIGNMENT_NOT_FOUND, 404, 'Assignment not found');
    }

    if (assignment.driverId !== driverUserId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 403, 'You do not own this assignment');
    }

    if (
      assignment.status !== ASSIGNMENT_STATUS.INSTALLING &&
      assignment.status !== ASSIGNMENT_STATUS.INSTALL_REJECTED
    ) {
      throw new AppError(
        ERROR_CODES.ASSIGNMENT_NOT_INSTALLING,
        400,
        `Cannot submit installation photo when assignment is in status ${assignment.status}`,
      );
    }

    // Check attempt limits
    const maxAttempts = await SettingsService.get(SETTING_KEYS.MAX_INSTALL_ATTEMPTS).catch(() => 3);
    const totalAllowedAttempts = maxAttempts + assignment.extraAttemptsGranted;
    if (assignment.installAttempts >= totalAllowedAttempts) {
      throw new AppError(
        ERROR_CODES.MAX_INSTALL_ATTEMPTS_EXCEEDED,
        400,
        `Maximum installation attempts (${totalAllowedAttempts}) exceeded for this assignment`,
      );
    }

    // Verify uploaded file
    const upload = await prisma.uploadedFile.findUnique({
      where: { id: input.uploadedFileId },
    });

    if (!upload) {
      throw new AppError(ERROR_CODES.FILE_NOT_FOUND, 404, 'Uploaded photo file record not found');
    }

    if (upload.ownerUserId !== driverUserId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 403, 'You do not own the uploaded photo file');
    }

    // Download buffer to perform automated photo integrity checks
    const buffer = await storageProvider.getObject(upload.fileKey);

    const checkResult = await PhotoChecksRunner.runChecks({
      imageBuffer: buffer,
      mimeType: upload.mimeType,
      sizeBytes: upload.sizeBytes,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracyMeters: input.accuracyMeters,
      capturedAt: new Date(input.capturedAt),
      isMockLocation: input.isMockLocation,
      deviceId: input.deviceId,
      campaignCityId: assignment.campaign.cityId,
      campaignId: assignment.campaignId,
      driverId: driverUserId,
      vehicleId: assignment.vehicleId,
    });

    const now = TimeService.now();
    const attemptNo = assignment.installAttempts + 1;

    // Create Photo record
    const photo = await prisma.photo.create({
      data: {
        assignmentId,
        driverId: driverUserId,
        kind: 'INSTALLATION',
        photoUrl: upload.fileKey,
        thumbnailUrl: upload.thumbnailKey,
        lat: input.latitude,
        lng: input.longitude,
        accuracyMeters: input.accuracyMeters,
        capturedAt: new Date(input.capturedAt),
        uploadedAt: now,
        isInsideAllowedZone: checkResult.flags.gpsInArea,
        autoCheckFlags: checkResult.flags as any,
        duplicateFlags: checkResult.duplicateMatch as any,
        dhash: checkResult.dhash,
        attemptNo,
        status: 'PENDING_CHECK',
      },
    });

    // Transition Assignment to INSTALL_SUBMITTED
    await assignmentStateMachine.assertTransition(assignment.status, ASSIGNMENT_STATUS.INSTALL_SUBMITTED);

    const updatedAssignment = await prisma.assignment.update({
      where: { id: assignmentId },
      data: {
        status: ASSIGNMENT_STATUS.INSTALL_SUBMITTED,
        installedAt: now,
        installAttempts: { increment: 1 },
      },
      include: {
        campaign: true,
        vehicle: true,
      },
    });

    await AuditService.log({
      actorId: driverUserId,
      actorType: ACTOR_TYPES.USER,
      action: 'assignment.install_submitted',
      entityType: 'Assignment',
      entityId: assignmentId,
      newValues: {
        attemptNo,
        photoId: photo.id,
        autoChecksPassed: checkResult.passed,
      },
    });

    eventBus.emit('assignment.install_submitted', {
      assignmentId,
      campaignId: assignment.campaignId,
      driverId: driverUserId,
      photoId: photo.id,
      attemptNo,
    });

    return {
      assignment: this.mapToDto(updatedAssignment),
      photo: {
        id: photo.id,
        assignmentId: photo.assignmentId,
        attemptNo: photo.attemptNo,
        fileKey: photo.photoUrl,
        status: photo.status,
        latitude: photo.lat,
        longitude: photo.lng,
        accuracyMeters: photo.accuracyMeters,
        capturedAt: photo.capturedAt.toISOString(),
        reviewReasonCodes: null,
        duplicateFlags: checkResult.duplicateMatch
          ? {
              isDuplicate: true,
              distance: checkResult.duplicateMatch.distance,
              matchedPhotoId: checkResult.duplicateMatch.photoId,
            }
          : null,
        rejectionReason: null,
        verifiedAt: null,
        createdAt: photo.createdAt.toISOString(),
      },
    };
  }

  /**
   * Maps Prisma Assignment model to AssignmentDto.
   */
  public static mapToDto(assignment: any): AssignmentDto {
    const { nextAction, nextActionDeadline } = this.computeNextAction(assignment);
    const maxInstallAttempts = 3;

    return {
      id: assignment.id,
      campaignId: assignment.campaignId,
      campaignTitle: assignment.campaign?.title ?? undefined,
      driverId: assignment.driverId,
      vehicleId: assignment.vehicleId,
      vehicleRegistrationNumber: assignment.vehicle?.registrationNumber ?? undefined,
      status: assignment.status,
      expiresAt: assignment.expiresAt.toISOString(),
      startedAt: assignment.startedAt?.toISOString() ?? null,
      completedAt: assignment.endedAt?.toISOString() ?? null,
      totalDays: assignment.totalDays,
      windowDays: assignment.windowDays ?? null,
      dailyRentPaise: assignment.campaign?.dailyRentPaise ?? 0,
      printingAllowancePaise: assignment.campaign?.printingAllowancePaise ?? 0,
      releaseReason: assignment.releaseReason ?? null,
      releasedAt: assignment.releasedAt?.toISOString() ?? null,
      installAttempts: assignment.installAttempts,
      extraAttemptsGranted: assignment.extraAttemptsGranted,
      maxInstallAttempts: maxInstallAttempts + assignment.extraAttemptsGranted,
      reviewOwner: assignment.reviewOwner,
      escalatedAt: assignment.escalatedAt?.toISOString() ?? null,
      reviewClaimedById: assignment.reviewClaimedById ?? null,
      reviewClaimedByName: assignment.reviewClaimedBy?.email ?? null,
      reviewClaimedAt: assignment.reviewClaimedAt?.toISOString() ?? null,
      nextAction,
      nextActionDeadline,
      createdAt: assignment.createdAt.toISOString(),
      updatedAt: assignment.updatedAt.toISOString(),
    };
  }
}
