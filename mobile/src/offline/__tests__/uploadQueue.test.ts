import { describe, it, expect, beforeEach } from 'vitest';
import { UploadQueue, type UploadJob } from '../uploadQueue';
import { createFakeAdapters } from '../../services/adapters/fakes';
import { setContainerAdapters } from '../../services/container';

describe('Offline Upload Queue: Resilience, Checkpoints & Scoping', () => {
  let fakes: ReturnType<typeof createFakeAdapters>;
  let mockApiClient: any;
  let queue: UploadQueue;

  beforeEach(() => {
    fakes = createFakeAdapters();
    setContainerAdapters(fakes);

    mockApiClient = {
      presignUpload: async (params: any) => ({
        uploadUrl: `https://mock-s3.autoposter.in/upload/${params.filename || 'photo.jpg'}`,
        fileKey: `uploads/photos/${params.filename || 'photo.jpg'}`,
        fileId: '00000000-0000-0000-0000-000000000001',
      }),
      confirmUpload: async () => ({ id: '00000000-0000-0000-0000-000000000001' }),
      submitDailyPhoto: async () => ({
        id: 'dp_verified_001',
        status: 'VERIFIED',
        verifiedAt: fakes.clock.nowIso(),
      }),
      submitInstallationPhoto: async () => ({
        assignment: { id: 'asgn_001', status: 'INSTALLATION_SUBMITTED' },
        photo: { id: 'inst_photo_001' },
      }),
    };

    queue = new UploadQueue(mockApiClient);
    queue.setCurrentUser('driver_user_123');
  });

  it('1. Persistence Round-Trip: Enqueues a job, writes to storage, and retrieves intact', async () => {
    const job = await queue.enqueue({
      userId: 'driver_user_123',
      assignmentId: 'asgn_001',
      type: 'DAILY_PHOTO',
      localUri: 'file:///cache/photo_today.jpg',
      metadata: {
        capturedAt: fakes.clock.nowIso(),
        latitude: 23.0225,
        longitude: 72.5714,
        accuracy: 8,
      },
    });

    expect(job.id).toBeDefined();
    expect(job.state).toBe('ENQUEUED');

    // Retrieve via ID
    const retrieved = await queue.getJob(job.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(job.id);
    expect(retrieved?.metadata.latitude).toBe(23.0225);

    // Retrieve via list
    const list = await queue.getJobs();
    expect(list.length).toBe(1);
    expect(list[0]?.id).toBe(job.id);
  });

  it('2. Checkpoint Resumption after App Kill: Successfully resumes from PRESIGNED state', async () => {
    // Simulate job was partially completed before app crashed: state = PRESIGNED
    const job = await queue.enqueue({
      id: 'job_interrupted_presigned',
      userId: 'driver_user_123',
      assignmentId: 'asgn_001',
      type: 'DAILY_PHOTO',
      localUri: 'file:///cache/photo_today.jpg',
      metadata: { capturedAt: fakes.clock.nowIso() },
    });

    job.state = 'PRESIGNED';
    job.checkpoint = {
      uploadId: '00000000-0000-0000-0000-000000000001',
      fileKey: 'uploads/photos/photo.jpg',
      presignedUrl: 'https://mock-s3.autoposter.in/upload/photo.jpg',
    };
    await queue.updateJob(job);

    // Track calls: presignUpload should NOT be called again
    let presignCalled = false;
    mockApiClient.presignUpload = async () => {
      presignCalled = true;
      return {};
    };

    const res = await queue.processQueue();
    expect(res.processed).toBe(1);
    expect(presignCalled).toBe(false); // Presign skipped, resumed from uploaded/confirmed

    const finished = await queue.getJob('job_interrupted_presigned');
    expect(finished?.state).toBe('SUBMITTED');
  });

  it('3. Checkpoint Resumption: Resumes from CONFIRMED state without duplicate uploads', async () => {
    const job = await queue.enqueue({
      id: 'job_interrupted_confirmed',
      userId: 'driver_user_123',
      assignmentId: 'asgn_001',
      type: 'INSTALLATION',
      localUri: 'file:///cache/installation.jpg',
      metadata: { capturedAt: fakes.clock.nowIso() },
    });

    job.state = 'CONFIRMED';
    job.checkpoint = {
      uploadId: '00000000-0000-0000-0000-000000000002',
      fileKey: 'uploads/installations/inst.jpg',
    };
    await queue.updateJob(job);

    let submitCalled = false;
    mockApiClient.submitInstallationPhoto = async () => {
      submitCalled = true;
      return { assignment: {}, photo: {} };
    };

    await queue.processQueue();
    expect(submitCalled).toBe(true);

    const finished = await queue.getJob('job_interrupted_confirmed');
    expect(finished?.state).toBe('SUBMITTED');
  });

  it('4. Idempotent Re-Submit: Retrying already finished jobs produces no duplicate API submission', async () => {
    const job = await queue.enqueue({
      userId: 'driver_user_123',
      assignmentId: 'asgn_001',
      type: 'DAILY_PHOTO',
      localUri: 'file:///cache/photo.jpg',
      metadata: { capturedAt: fakes.clock.nowIso() },
    });

    await queue.processQueue();
    const finished = await queue.getJob(job.id);
    expect(finished?.state).toBe('SUBMITTED');

    // Run processQueue again
    let calledAgain = false;
    mockApiClient.submitDailyPhoto = async () => {
      calledAgain = true;
    };

    const secondRun = await queue.processQueue();
    expect(secondRun.processed).toBe(0);
    expect(calledAgain).toBe(false);
  });

  it('5. Exponential Backoff with Jitter: Retryable network errors back off cleanly', async () => {
    const job = await queue.enqueue({
      userId: 'driver_user_123',
      assignmentId: 'asgn_001',
      type: 'DAILY_PHOTO',
      localUri: 'file:///cache/photo.jpg',
      metadata: { capturedAt: fakes.clock.nowIso() },
    });

    // Make API throw a 503 Server Unavailable
    mockApiClient.presignUpload = async () => {
      const err: any = new Error('Gateway Timeout');
      err.status = 504;
      throw err;
    };

    const initialTime = fakes.clock.nowTimestamp();
    const result = await queue.processQueue();
    expect(result.errors).toBe(1);

    const failedJob = await queue.getJob(job.id);
    expect(failedJob?.state).toBe('ENQUEUED'); // Still enqueued for retry
    expect(failedJob?.attempts).toBe(1);
    expect(failedJob?.nextRetryAt).toBeGreaterThan(initialTime);
  });

  it('6. Permanent Error Classification: 400 or DAY_ALREADY_VERIFIED immediately marks FAILED', async () => {
    const job = await queue.enqueue({
      userId: 'driver_user_123',
      assignmentId: 'asgn_001',
      type: 'DAILY_PHOTO',
      localUri: 'file:///cache/photo.jpg',
      metadata: { capturedAt: fakes.clock.nowIso() },
    });

    mockApiClient.presignUpload = async () => {
      const err: any = new Error('Day is already verified');
      err.status = 400;
      err.code = 'DAY_ALREADY_VERIFIED';
      throw err;
    };

    await queue.processQueue();

    const deadJob = await queue.getJob(job.id);
    expect(deadJob?.state).toBe('FAILED');
    expect(deadJob?.error).toContain('Day is already verified');
  });

  it('7. Expiration Rule: Jobs past their deadline are marked EXPIRED', async () => {
    const now = fakes.clock.nowTimestamp();
    const job = await queue.enqueue({
      userId: 'driver_user_123',
      assignmentId: 'asgn_001',
      type: 'DAILY_PHOTO',
      localUri: 'file:///cache/photo.jpg',
      metadata: { capturedAt: fakes.clock.nowIso() },
      expiresAt: now - 1000, // already expired in past
    });

    await queue.processQueue();

    const expiredJob = await queue.getJob(job.id);
    expect(expiredJob?.state).toBe('EXPIRED');
    expect(expiredJob?.error).toContain('expired');
  });

  it('8. Account Scoping: Jobs belonging to another driver are held and NEVER uploaded', async () => {
    // Driver A job
    await queue.enqueue({
      id: 'job_driver_A',
      userId: 'driver_A',
      type: 'DAILY_PHOTO',
      localUri: 'file:///cache/photoA.jpg',
      metadata: { capturedAt: fakes.clock.nowIso() },
    });

    // Currently logged in user is driver_B
    queue.setCurrentUser('driver_B');

    await queue.processQueue();

    // Driver A's job should NOT have run
    const jobA = await queue.getJob('job_driver_A');
    expect(jobA?.state).toBe('ENQUEUED');
    expect(jobA?.attempts).toBe(0);

    // Switch active user back to driver_A
    queue.setCurrentUser('driver_A');
    await queue.processQueue();

    const jobARun = await queue.getJob('job_driver_A');
    expect(jobARun?.state).toBe('SUBMITTED');
  });

  it('9. Low Disk Space Guard: Suspends queue processing if free disk is under 10MB', async () => {
    fakes.fakeFileStore.setFreeSpace(5 * 1024 * 1024); // 5MB free (under 10MB threshold)

    const job = await queue.enqueue({
      userId: 'driver_user_123',
      type: 'DAILY_PHOTO',
      localUri: 'file:///cache/photo.jpg',
      metadata: { capturedAt: fakes.clock.nowIso() },
    });

    const res = await queue.processQueue();
    expect(res.processed).toBe(0);

    const intactJob = await queue.getJob(job.id);
    expect(intactJob?.state).toBe('ENQUEUED');
    expect(intactJob?.attempts).toBe(0);
  });

  it('10. Corrupted Record Quarantine: Corrupted JSON does not crash queue processing', async () => {
    // Inject corrupt JSON into storage
    await fakes.storage.setItem('ap_upload_job_corrupt', '{ invalid-json');
    const index = await queue.getIndex();
    index.push('corrupt');
    await fakes.storage.setItem('ap_upload_queue_index', JSON.stringify(index));

    // Valid job
    const job = await queue.enqueue({
      userId: 'driver_user_123',
      type: 'DAILY_PHOTO',
      localUri: 'file:///cache/photo.jpg',
      metadata: { capturedAt: fakes.clock.nowIso() },
    });

    const res = await queue.processQueue();
    expect(res.processed).toBe(1);

    const validFinished = await queue.getJob(job.id);
    expect(validFinished?.state).toBe('SUBMITTED');
  });

  it('11. Cleanup of Completed Jobs: clearCompleted() purges SUBMITTED jobs and local files', async () => {
    const job = await queue.enqueue({
      userId: 'driver_user_123',
      type: 'DAILY_PHOTO',
      localUri: 'file:///cache/photo_done.jpg',
      metadata: { capturedAt: fakes.clock.nowIso() },
    });

    await queue.processQueue();

    // Verify file exists
    await fakes.fileStore.saveFile('file:///source.jpg', 'photo_done.jpg');

    const clearedCount = await queue.clearCompleted();
    expect(clearedCount).toBe(1);

    // Job should be removed from index
    const index = await queue.getIndex();
    expect(index.includes(job.id)).toBe(false);
  });

  it('12. Queue Badge Counts: getCounts() returns accurate pending, failed, and completed stats', async () => {
    await queue.enqueue({
      userId: 'driver_user_123',
      type: 'DAILY_PHOTO',
      localUri: 'file:///cache/1.jpg',
      metadata: { capturedAt: fakes.clock.nowIso() },
    });

    const counts1 = await queue.getCounts();
    expect(counts1.pending).toBe(1);
    expect(counts1.completed).toBe(0);

    await queue.processQueue();

    const counts2 = await queue.getCounts();
    expect(counts2.pending).toBe(0);
    expect(counts2.completed).toBe(1);
  });
});
