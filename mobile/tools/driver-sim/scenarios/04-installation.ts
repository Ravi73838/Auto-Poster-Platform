import type { SimulatorContext } from '../harness';
import { generateDriverPhoto, generateExactDuplicate } from '../fixtures/imageGenerator';
import { UploadQueue } from '../../../src/offline/uploadQueue';
import { ASSIGNMENT_STATUS } from '../../../src/shared/constants/index';

export async function runInstallationScenario(
  ctx: SimulatorContext,
  driverAuth: { driverUserId: string; driverToken: string },
  assignmentId: string,
): Promise<void> {
  const { client, testPrisma, fakes } = ctx;
  (client as any).setTokens({ accessToken: driverAuth.driverToken, refreshToken: null });

  // 1. Fetch print guide and specifications
  const printGuide = await client.getPrintGuide(assignmentId);
  if (!printGuide.material || !printGuide.checklist) {
    throw new Error('Print guide missing required specifications');
  }

  // 2. Transition assignment to INSTALLING
  await client.startInstalling(assignmentId);

  // 3. Generate synthetic installation proof JPEG with number plate
  const photoFixture = await generateDriverPhoto({
    plateNumber: 'GJ01XY9999',
    posterText: 'TEST INSTALLATION POSTER',
  });

  // Presign upload for installation photo
  const presign = await client.presignUpload({
    purpose: 'INSTALLATION_PHOTO',
    mimeType: 'image/jpeg',
    sizeBytes: photoFixture.sizeBytes,
    fileName: 'installation_proof.jpg',
  });

  // 4. Submit installation photo proof
  const submitRes = await client.submitInstallationPhoto(assignmentId, {
    uploadedFileId: presign.fileId || presign.fileKey,
    latitude: 23.0225,
    longitude: 72.5714,
    accuracyMeters: 8.0,
    capturedAt: fakes.clock.nowIso(),
    isMockLocation: false,
  });

  if (!submitRes || !submitRes.photo) {
    throw new Error('Installation photo submission did not return photo record');
  }

  // 5. Duplicate submission check (assignment is now INSTALL_SUBMITTED)
  let secondSubmitBlocked = false;
  try {
    await client.submitInstallationPhoto(assignmentId, {
      uploadedFileId: presign.fileId || presign.fileKey,
      latitude: 23.0225,
      longitude: 72.5714,
      accuracyMeters: 8.0,
      capturedAt: fakes.clock.nowIso(),
      isMockLocation: false,
    });
  } catch (err: any) {
    if (err?.code === 'ASSIGNMENT_NOT_INSTALLING' || err?.status === 400) {
      secondSubmitBlocked = true;
    }
  }
  if (!secondSubmitBlocked) {
    throw new Error('Submitting multiple installation photos concurrently was not blocked');
  }

  // 6. Admin approval of installation photo (moves assignment to RUNNING)
  await testPrisma.assignment.update({
    where: { id: assignmentId },
    data: {
      status: ASSIGNMENT_STATUS.RUNNING,
      startedAt: fakes.clock.now(),
      totalDays: 30,
      verifiedDays: 0,
    },
  });

  // Create AssignmentSettlement record for financial settlement tracking
  const assignmentRecord = await testPrisma.assignment.findUnique({ where: { id: assignmentId } });
  await testPrisma.assignmentSettlement.upsert({
    where: { assignmentId },
    update: {},
    create: {
      assignmentId,
      campaignId: assignmentRecord!.campaignId,
      driverId: assignmentRecord!.driverId,
      status: 'PENDING',
      totalDays: 30,
      verifiedDays: 0,
      missedDays: 0,
      graceDaysUsed: 0,
      payableDays: 0,
      dailyRentPaise: 25000n,
      rentPayablePaise: 0n,
      printingAllowancePaise: 50000n,
      companyRefundPaise: 0n,
      commissionPaise: 0n,
      gstPaise: 0n,
      totalAmountPaise: 50000n,
    },
  });
}
