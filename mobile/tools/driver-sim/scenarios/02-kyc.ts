import type { SimulatorContext } from '../harness';
import { UploadQueue } from '../../../src/offline/uploadQueue';
import { resolveEntryRoute } from '../../../src/navigation/resolveEntryRoute';
import { ACCOUNT_STATUS } from '../../../src/shared/constants/index';

export async function runKycScenario(ctx: SimulatorContext): Promise<{ driverUserId: string; driverToken: string }> {
  const { client, testPrisma, testCityId, testZoneId } = ctx;

  const mobile = `+9196${Math.floor(10000000 + Math.random() * 90000000)}`;
  const password = 'KycDriverPassword@123';
  const reg = await client.driverPasswordRegister({ mobile, password });

  const driverUserId = reg.user.id;
  const driverToken = reg.accessToken;
  (client as any).setTokens({ accessToken: driverToken, refreshToken: reg.refreshToken });

  // 1. Update personal details
  await client.updateDriverProfile({
    fullName: 'Jigneshbhai Auto Rickshaw',
    cityId: testCityId,
    primaryZoneId: testZoneId,
    extraZoneIds: [],
  });

  // 2. Update vehicle details
  const plate = `GJ01XY${Math.floor(1000 + Math.random() * 9000)}`;
  await client.updateDriverVehicle({
    registrationNumber: plate,
    isVehicleOwner: true,
  });

  // 3. Document upload through the real offline UploadQueue
  const queue = new UploadQueue(client);
  queue.setCurrentUser(driverUserId);

  // Enqueue KYC document upload job
  const job = await queue.enqueue({
    userId: driverUserId,
    type: 'KYC_DOCUMENT',
    localUri: 'file:///simulated/cache/license_front.jpg',
    metadata: {
      docType: 'DRIVING_LICENCE',
      capturedAt: new Date().toISOString(),
    },
  });

  // Process queue - will presign, upload, and confirm
  const processRes = await queue.processQueue();
  if (processRes.processed < 1) {
    const jobStatus = await queue.getJob(job.id);
    throw new Error(`Offline queue failed to process KYC document job. Job state: ${jobStatus?.state}, error: ${jobStatus?.error}, attempts: ${jobStatus?.attempts}`);
  }

  const updatedJob = await queue.getJob(job.id);
  const fileId = updatedJob?.checkpoint.uploadId;
  if (fileId) {
    await client.addDriverDocument({
      type: 'DRIVING_LICENCE',
      uploadedFileId: fileId,
    });
    await client.addDriverDocument({
      type: 'VEHICLE_RC',
      uploadedFileId: fileId,
    });
    await client.addDriverDocument({
      type: 'VEHICLE_PHOTO',
      uploadedFileId: fileId,
    });
  }

  // 4. Update payout details (UPI)
  await client.updateDriverPayoutDetails({
    method: 'UPI',
    upiId: 'jignesh.auto@oksbi',
  });

  // 5. Submit mandatory legal consents
  await client.submitDriverConsents({
    consents: [
      { type: 'TERMS', version: '1.0' },
      { type: 'PRIVACY', version: '1.0' },
      { type: 'LOCATION', version: '1.0' },
      { type: 'CAMERA', version: '1.0' },
    ],
  });

  // 6. Submit KYC for admin review
  await client.submitDriverKyc();

  // Status check: after submit, entry route resolves to /(onboarding)/status
  const submittedRoute = resolveEntryRoute({
    isAuthenticated: true,
    me: { user: { role: 'DRIVER', status: ACCOUNT_STATUS.PENDING } } as any,
    kycStatus: 'SUBMITTED',
  });
  if (submittedRoute !== '/(onboarding)/status') {
    throw new Error(`Expected /(onboarding)/status after KYC submit, got: ${submittedRoute}`);
  }

  // 7. Admin approval simulation in test schema
  await testPrisma.user.update({
    where: { id: driverUserId },
    data: { status: ACCOUNT_STATUS.APPROVED },
  });

  // After approval, entry route resolves directly to /(tabs)
  const approvedRoute = resolveEntryRoute({
    isAuthenticated: true,
    me: { user: { role: 'DRIVER', status: ACCOUNT_STATUS.APPROVED } } as any,
    kycStatus: 'APPROVED',
  });
  if (approvedRoute !== '/(tabs)') {
    throw new Error(`Expected /(tabs) after KYC approval, got: ${approvedRoute}`);
  }

  return { driverUserId, driverToken };
}
