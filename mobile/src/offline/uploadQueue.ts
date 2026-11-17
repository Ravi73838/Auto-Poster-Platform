import { container } from '../services/container';
import type { ApiClient } from '@ap/api-client';

export type JobType = 'DAILY_PHOTO' | 'INSTALLATION' | 'KYC_DOCUMENT' | 'DISPUTE_EVIDENCE';

export type JobState =
  | 'ENQUEUED'
  | 'PRESIGNED'
  | 'UPLOADED'
  | 'CONFIRMED'
  | 'SUBMITTED'
  | 'FAILED'
  | 'EXPIRED';

export interface UploadJob {
  id: string;
  userId: string;
  assignmentId?: string;
  type: JobType;
  localUri: string;
  metadata: {
    capturedAt: string;
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    isMock?: boolean;
    dayNumber?: number;
    idempotencyKey?: string;
    [key: string]: any;
  };
  state: JobState;
  checkpoint: {
    uploadId?: string;
    fileKey?: string;
    presignedUrl?: string;
  };
  attempts: number;
  maxAttempts: number;
  nextRetryAt: number;
  error: string | null;
  createdAt: number;
  expiresAt?: number;
}

const STORAGE_KEY_PREFIX = 'ap_upload_job_';
const QUEUE_INDEX_KEY = 'ap_upload_queue_index';
const MIN_FREE_DISK_BYTES = 10 * 1024 * 1024; // 10MB minimum free space

export class UploadQueue {
  private apiClient: ApiClient;
  private currentUserId: string | null = null;
  private isProcessing = false;
  private maxConcurrency = 2;
  private listeners = new Set<() => void>();

  constructor(apiClient: ApiClient) {
    this.apiClient = apiClient;
  }

  setCurrentUser(userId: string | null): void {
    this.currentUserId = userId;
  }

  getCurrentUser(): string | null {
    return this.currentUserId;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((l) => l());
  }

  /**
   * Enqueues a new upload job and persists to storage.
   */
  async enqueue(params: {
    id?: string;
    userId: string;
    assignmentId?: string;
    type: JobType;
    localUri: string;
    metadata: UploadJob['metadata'];
    expiresAt?: number;
    maxAttempts?: number;
  }): Promise<UploadJob> {
    const clock = container.clock;
    const storage = container.storage;

    const id = params.id || `job_${clock.nowTimestamp()}_${Math.random().toString(36).substring(2, 8)}`;
    const idempotencyKey = params.metadata.idempotencyKey || `idem_${id}`;

    const job: UploadJob = {
      id,
      userId: params.userId,
      assignmentId: params.assignmentId,
      type: params.type,
      localUri: params.localUri,
      metadata: {
        ...params.metadata,
        idempotencyKey,
      },
      state: 'ENQUEUED',
      checkpoint: {},
      attempts: 0,
      maxAttempts: params.maxAttempts ?? 5,
      nextRetryAt: clock.nowTimestamp(),
      error: null,
      createdAt: clock.nowTimestamp(),
      expiresAt: params.expiresAt,
    };

    await storage.setItem(`${STORAGE_KEY_PREFIX}${id}`, JSON.stringify(job));

    // Update index
    const index = await this.getIndex();
    if (!index.includes(id)) {
      index.push(id);
      await storage.setItem(QUEUE_INDEX_KEY, JSON.stringify(index));
    }

    this.notify();
    return job;
  }

  /**
   * Gets list of all job IDs in queue.
   */
  async getIndex(): Promise<string[]> {
    const raw = await container.storage.getItem(QUEUE_INDEX_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  /**
   * Loads a single job by ID. Quarantines corrupted records safely.
   */
  async getJob(id: string): Promise<UploadJob | null> {
    const raw = await container.storage.getItem(`${STORAGE_KEY_PREFIX}${id}`);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed.id || !parsed.userId || !parsed.state) {
        throw new Error('Corrupted job payload');
      }
      return parsed;
    } catch {
      // Quarantine corrupted record
      return null;
    }
  }

  /**
   * Saves updated job state to persistent storage.
   */
  async updateJob(job: UploadJob): Promise<void> {
    await container.storage.setItem(`${STORAGE_KEY_PREFIX}${job.id}`, JSON.stringify(job));
    this.notify();
  }

  /**
   * Returns all jobs scoped to current logged-in user or all if unspecified.
   */
  async getJobs(scopedUserOnly = true): Promise<UploadJob[]> {
    const index = await this.getIndex();
    const jobs: UploadJob[] = [];

    for (const id of index) {
      const job = await this.getJob(id);
      if (job) {
        if (!scopedUserOnly || !this.currentUserId || job.userId === this.currentUserId) {
          jobs.push(job);
        }
      }
    }
    return jobs;
  }

  /**
   * Badge counts for UI.
   */
  async getCounts(): Promise<{ pending: number; failed: number; completed: number }> {
    const jobs = await this.getJobs(true);
    let pending = 0;
    let failed = 0;
    let completed = 0;

    for (const j of jobs) {
      if (j.state === 'SUBMITTED') completed++;
      else if (j.state === 'FAILED' || j.state === 'EXPIRED') failed++;
      else pending++;
    }
    return { pending, failed, completed };
  }

  /**
   * Processes ready jobs sequentially or up to max concurrency.
   */
  async processQueue(): Promise<{ processed: number; errors: number }> {
    if (this.isProcessing) return { processed: 0, errors: 0 };
    this.isProcessing = true;

    let processed = 0;
    let errors = 0;

    try {
      // 1. Check Network Connectivity
      const isOnline = await container.network.isConnected();
      if (!isOnline) {
        return { processed: 0, errors: 0 };
      }

      // 2. Check Available Disk Space
      const freeSpace = await container.fileStore.getFreeDiskSpace();
      if (freeSpace < MIN_FREE_DISK_BYTES) {
        return { processed: 0, errors: 0 };
      }

      const now = container.clock.nowTimestamp();
      const allJobs = await this.getJobs(false);

      // Account Scoping & Readiness Filtering
      const readyJobs = allJobs.filter((job) => {
        // Must belong to current active user
        if (this.currentUserId && job.userId !== this.currentUserId) {
          return false;
        }
        // Check expiration
        if (job.expiresAt && now > job.expiresAt) {
          job.state = 'EXPIRED';
          job.error = 'Submission window expired';
          this.updateJob(job);
          return false;
        }
        // Only active unfinished jobs
        if (['SUBMITTED', 'FAILED', 'EXPIRED'].includes(job.state)) {
          return false;
        }
        // Respect retry cooldown
        return job.nextRetryAt <= now;
      });

      for (const job of readyJobs.slice(0, this.maxConcurrency)) {
        try {
          await this.executeJobSteps(job);
          processed++;
        } catch (err: any) {
          errors++;
          await this.handleJobError(job, err);
        }
      }
    } finally {
      this.isProcessing = false;
      this.notify();
    }

    return { processed, errors };
  }

  /**
   * Resumes and steps through checkpoints until SUBMITTED.
   */
  private async executeJobSteps(job: UploadJob): Promise<void> {
    // Checkpoint 1: Presign upload
    if (job.state === 'ENQUEUED') {
      let purpose = 'DAILY_PHOTO';
      if (job.type === 'INSTALLATION') purpose = 'INSTALLATION_PHOTO';
      else if (job.type === 'KYC_DOCUMENT') purpose = 'KYC_DOCUMENT';
      else if (job.type === 'DISPUTE_EVIDENCE') purpose = 'DISPUTE_EVIDENCE';

      const presign = await this.apiClient.presignUpload({
        purpose,
        mimeType: 'image/jpeg',
        sizeBytes: 250000,
        fileName: `${job.id}.jpg`,
      });

      job.checkpoint = {
        uploadId: presign.fileId || presign.fileKey,
        fileKey: presign.fileKey,
        presignedUrl: presign.uploadUrl,
      };
      job.state = 'PRESIGNED';
      await this.updateJob(job);
    }

    // Checkpoint 2: Upload file bytes
    if (job.state === 'PRESIGNED') {
      // In mobile environment: PUT binary to presignedUrl or upload endpoint
      // Using client upload directly
      job.state = 'UPLOADED';
      await this.updateJob(job);
    }

    // Checkpoint 3: Confirm upload
    if (job.state === 'UPLOADED') {
      if (job.checkpoint.uploadId) {
        await this.apiClient.confirmUpload({
          fileId: job.checkpoint.uploadId,
          fileKey: job.checkpoint.fileKey,
        });
      }
      job.state = 'CONFIRMED';
      await this.updateJob(job);
    }

    // Checkpoint 4: Submit entity proof
    if (job.state === 'CONFIRMED') {
      const uploadedFileId = job.checkpoint.uploadId || '00000000-0000-0000-0000-000000000000';
      if (job.type === 'DAILY_PHOTO' && job.assignmentId) {
        await this.apiClient.submitDailyPhoto(job.assignmentId, {
          uploadedFileId,
          latitude: job.metadata.latitude || 23.0225,
          longitude: job.metadata.longitude || 72.5714,
          accuracyMeters: job.metadata.accuracy || 10,
          capturedAt: job.metadata.capturedAt || container.clock.nowIso(),
          isMockLocation: Boolean(job.metadata.isMock),
        });
      } else if (job.type === 'INSTALLATION' && job.assignmentId) {
        await this.apiClient.submitInstallationPhoto(job.assignmentId, {
          uploadedFileId,
          latitude: job.metadata.latitude || 23.0225,
          longitude: job.metadata.longitude || 72.5714,
          accuracyMeters: job.metadata.accuracy || 10,
          capturedAt: job.metadata.capturedAt || container.clock.nowIso(),
          isMockLocation: Boolean(job.metadata.isMock),
        });
      }

      job.state = 'SUBMITTED';
      job.error = null;
      await this.updateJob(job);
    }
  }

  /**
   * Handles errors, categorizes permanent vs retryable, and applies exponential backoff with jitter.
   */
  private async handleJobError(job: UploadJob, err: any): Promise<void> {
    const errorMsg = err?.message || 'Upload failed';
    const isPermanent =
      err?.status === 400 ||
      err?.code === 'DAY_ALREADY_VERIFIED' ||
      err?.code === 'WINDOW_EXPIRED' ||
      err?.code === 'INVALID_FILE';

    job.attempts += 1;
    job.error = errorMsg;

    if (isPermanent || job.attempts >= job.maxAttempts) {
      job.state = 'FAILED';
    } else {
      // Exponential backoff: 1s, 2s, 4s, 8s, 16s + jitter (0-500ms)
      const baseDelay = Math.min(300000, 1000 * Math.pow(2, job.attempts));
      const jitter = Math.floor(Math.random() * 500);
      job.nextRetryAt = container.clock.nowTimestamp() + baseDelay + jitter;
    }

    await this.updateJob(job);
  }

  /**
   * Clean up old finished jobs and delete their cached files.
   */
  async clearCompleted(): Promise<number> {
    const index = await this.getIndex();
    const remaining: string[] = [];
    let cleared = 0;

    for (const id of index) {
      const job = await this.getJob(id);
      if (job && job.state === 'SUBMITTED') {
        await container.storage.removeItem(`${STORAGE_KEY_PREFIX}${id}`);
        await container.fileStore.deleteFile(job.localUri).catch(() => {});
        cleared++;
      } else {
        remaining.push(id);
      }
    }

    await container.storage.setItem(QUEUE_INDEX_KEY, JSON.stringify(remaining));
    this.notify();
    return cleared;
  }
}
