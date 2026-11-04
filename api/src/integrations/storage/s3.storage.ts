import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type {
  StorageProvider,
  PresignedUploadResult,
  StorageObjectMetadata,
} from './types.js';
import { env } from '../../config/env.js';
import { logger } from '../../shared/logger/index.js';

export interface S3Config {
  endpoint: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  forcePathStyle: boolean;
}

export class S3StorageProvider implements StorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;
  private bucketChecked = false;

  constructor(config?: Partial<S3Config>) {
    const finalConfig: S3Config = {
      endpoint: config?.endpoint ?? env.S3_ENDPOINT,
      region: config?.region ?? env.S3_REGION,
      bucket: config?.bucket ?? env.S3_BUCKET,
      accessKey: config?.accessKey ?? env.S3_ACCESS_KEY,
      secretKey: config?.secretKey ?? env.S3_SECRET_KEY,
      forcePathStyle: config?.forcePathStyle ?? env.S3_FORCE_PATH_STYLE,
    };

    this.bucket = finalConfig.bucket;

    this.client = new S3Client({
      endpoint: finalConfig.endpoint,
      region: finalConfig.region,
      credentials: {
        accessKeyId: finalConfig.accessKey,
        secretAccessKey: finalConfig.secretKey,
      },
      forcePathStyle: finalConfig.forcePathStyle,
    });
  }

  public async ensureBucket(): Promise<void> {
    if (this.bucketChecked) return;

    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.bucketChecked = true;
    } catch {
      try {
        logger.info(`Bucket "${this.bucket}" does not exist, creating it...`);
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.bucketChecked = true;
        logger.info(`Bucket "${this.bucket}" created successfully.`);
      } catch (createErr) {
        logger.warn(
          { error: createErr, bucket: this.bucket },
          'Could not verify/create storage bucket (will proceed if pre-configured)',
        );
      }
    }
  }

  public async createUploadUrl(
    key: string,
    mimeType: string,
    sizeBytes: number,
    ttlSeconds = 300,
  ): Promise<PresignedUploadResult> {
    await this.ensureBucket();

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimeType,
      ContentLength: sizeBytes,
    });

    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: ttlSeconds,
    });

    return {
      uploadUrl,
      fileKey: key,
      requiredHeaders: {
        'Content-Type': mimeType,
      },
      expiresInSeconds: ttlSeconds,
    };
  }

  public async getSignedReadUrl(key: string, ttlSeconds = 300): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.client, command, {
      expiresIn: ttlSeconds,
    });
  }

  public async head(key: string): Promise<StorageObjectMetadata | null> {
    try {
      const response = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );

      return {
        sizeBytes: response.ContentLength ?? 0,
        mimeType: response.ContentType,
        eTag: response.ETag,
      };
    } catch {
      return null;
    }
  }

  public async getObject(key: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    if (!response.Body) {
      throw new Error(`Empty body returned for object key: ${key}`);
    }

    const byteArray = await response.Body.transformToByteArray();
    return Buffer.from(byteArray);
  }

  public async putObject(
    key: string,
    data: Buffer,
    mimeType: string,
  ): Promise<void> {
    await this.ensureBucket();

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: mimeType,
        ContentLength: data.length,
      }),
    );
  }

  public async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }
}

export const storageProvider = new S3StorageProvider();

