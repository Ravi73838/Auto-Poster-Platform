export interface PresignedUploadResult {
  uploadUrl: string;
  fileKey: string;
  requiredHeaders: Record<string, string>;
  expiresInSeconds: number;
}

export interface StorageObjectMetadata {
  sizeBytes: number;
  mimeType?: string;
  eTag?: string;
}

export interface StorageProvider {
  createUploadUrl(
    key: string,
    mimeType: string,
    sizeBytes: number,
    ttlSeconds?: number,
  ): Promise<PresignedUploadResult>;

  getSignedReadUrl(key: string, ttlSeconds?: number): Promise<string>;

  head(key: string): Promise<StorageObjectMetadata | null>;

  getObject(key: string): Promise<Buffer>;

  putObject(key: string, data: Buffer, mimeType: string): Promise<void>;

  delete(key: string): Promise<void>;

  ensureBucket(): Promise<void>;
}

