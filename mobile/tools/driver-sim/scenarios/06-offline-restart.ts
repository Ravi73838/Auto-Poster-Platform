import type { SimulatorContext } from '../harness';
import { UploadQueue } from '../../../src/offline/uploadQueue';

export async function runOfflineRestartScenario(
  ctx: SimulatorContext,
  driverAuth: { driverUserId: string; driverToken: string },
  assignmentId: string,
): Promise<void> {
  const { client, fakes } = ctx;
  (client as any).setTokens({ accessToken: driverAuth.driverToken, refreshToken: null });

  // 1. Simulate Airplane Mode (Network Disconnected)
  fakes.fakeNetwork.setConnected(false);

  const queue1 = new UploadQueue(client);
  queue1.setCurrentUser(driverAuth.driverUserId);

  const offlineJob = await queue1.enqueue({
    userId: driverAuth.driverUserId,
    assignmentId,
    type: 'DAILY_PHOTO',
    localUri: 'file:///simulated/offline_photo.jpg',
    metadata: {
      capturedAt: fakes.clock.nowIso(),
      latitude: 23.0225,
      longitude: 72.5714,
      accuracy: 7.0,
      dayNumber: 5,
    },
  });

  // Processing queue while offline should detect no connection and safely halt
  const offlineProcess = await queue1.processQueue();
  if (offlineProcess.processed > 0) {
    throw new Error('Queue processed jobs while network was disconnected');
  }

  // 2. Reconnect Network
  fakes.fakeNetwork.setConnected(true);

  // 3. Simulate App Kill & Process Restart: instantiate fresh UploadQueue from storage
  const queue2 = new UploadQueue(client);
  queue2.setCurrentUser(driverAuth.driverUserId);

  // Verify the job was persisted across restart
  const persistedJob = await queue2.getJob(offlineJob.id);
  if (!persistedJob || persistedJob.state !== 'ENQUEUED') {
    throw new Error('Offline job was not persisted in storage across app restart');
  }

  // 4. Multi-user Account Scoping Check:
  // If a different driver logs into the device, the previous driver's jobs must be held
  queue2.setCurrentUser('different_driver_user_456');
  const otherUserJobs = await queue2.getJobs();
  if (otherUserJobs.length > 0) {
    throw new Error('Account scoping violated: current driver saw jobs belonging to another user');
  }

  // Switch back to original driver
  queue2.setCurrentUser(driverAuth.driverUserId);
  const activeJobs = await queue2.getJobs();
  if (!activeJobs.some((j) => j.id === offlineJob.id)) {
    throw new Error('Original driver jobs not restored when user switched back');
  }
}
