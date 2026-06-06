import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';
import { AppError } from '../utils/appError';
import { logger } from '../utils/logger';
import { StorageBucketInfo, StorageProvider } from './types';

export const createStorageClient = () => {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new AppError(500, 'Supabase storage is not configured', 'STORAGE_NOT_CONFIGURED');
  }

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
};

const sleep = async (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeStatusCode = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const isNotFoundError = (statusCode: number | null, message: string | null) => {
  return statusCode === 404 || message?.toLowerCase().includes('not found') === true;
};

const isRetryableStorageFailure = (statusCode: number | null, message: string | null) => {
  const normalizedMessage = message?.toLowerCase() ?? '';

  return (
    statusCode === null ||
    statusCode === 408 ||
    statusCode === 425 ||
    statusCode === 429 ||
    statusCode >= 500 ||
    normalizedMessage.includes('fetch failed') ||
    normalizedMessage.includes('network') ||
    normalizedMessage.includes('timed out') ||
    normalizedMessage.includes('timeout') ||
    normalizedMessage.includes('socket')
  );
};

type EnsureBucketOptions = {
  allowCreate: boolean;
};

export const ensureSupabaseBucket = async (
  supabase: ReturnType<typeof createStorageClient>,
  bucket: string,
  options: EnsureBucketOptions
): Promise<StorageBucketInfo> => {
  const existing = await supabase.storage.getBucket(bucket);

  if (!existing.error) {
    return {
      name: existing.data.name,
      public: Boolean(existing.data.public)
    };
  }

  const existingMessage = (existing.error as unknown as { message?: string }).message ?? null;
  const existingStatusCode = normalizeStatusCode(
    (existing.error as unknown as { statusCode?: number | string }).statusCode ?? null
  );

  if (!isNotFoundError(existingStatusCode, existingMessage)) {
    logger.error('storage.supabase.bucket_lookup_failed', {
      bucket,
      message: existingMessage,
      statusCode: existingStatusCode
    });
    throw new AppError(500, `Failed to verify storage bucket "${bucket}"`, 'STORAGE_BUCKET_LOOKUP_FAILED');
  }

  if (!options.allowCreate) {
    throw new AppError(500, `Storage bucket "${bucket}" does not exist`, 'STORAGE_BUCKET_MISSING');
  }

  logger.warn('storage.supabase.bucket_missing_auto_create_attempt', {
    bucket
  });

  const created = await supabase.storage.createBucket(bucket, { public: false });
  if (created.error) {
    const message = (created.error as unknown as { message?: string }).message ?? '';
    const alreadyExists =
      message.toLowerCase().includes('already exists') || message.toLowerCase().includes('duplicate');

    if (!alreadyExists) {
      logger.error('storage.supabase.bucket_create_failed', {
        bucket,
        message
      });
      throw new AppError(
        500,
        `Storage bucket "${bucket}" is missing and could not be created`,
        'STORAGE_BUCKET_MISSING'
      );
    }
  }

  await sleep(250);
  return {
    name: bucket,
    public: false
  };
};

export const supabaseStorage: StorageProvider = {
    async uploadEvidenceFile(bucket, filePath, body, contentType) {
    const supabase = createStorageClient();

    if (env.NODE_ENV !== 'production') {
      await ensureSupabaseBucket(supabase, bucket, { allowCreate: true });
    }

    const attemptUpload = async () => {
      return supabase.storage.from(bucket).upload(filePath, body, {
        contentType,
        upsert: false
      });
    };

    // Start of change
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      let uploadResult: Awaited<ReturnType<typeof attemptUpload>>;

      try {
        uploadResult = await attemptUpload();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('storage.supabase.upload_error_caught', {
          bucket,
          filePath,
          message,
          attempt
        });

        if (attempt < 3 && isRetryableStorageFailure(null, message)) {
          await sleep(attempt * 500);
          continue;
        }

        throw new AppError(500, `Failed to connect to storage: ${message}`, 'STORAGE_UPLOAD_FAILED');
      }

      const { error } = uploadResult;

      if (!error) {
        return;
      }

      const message = (error as unknown as { message?: string }).message ?? null;
      const statusCode = normalizeStatusCode(
        (error as unknown as { statusCode?: number | string }).statusCode ?? null
      );

      logger.error('storage.supabase.upload_failed', {
        bucket,
        filePath,
        statusCode,
        message,
        attempt
      });

      if (attempt < 3 && env.NODE_ENV !== 'production' && isNotFoundError(statusCode, message)) {
        await ensureSupabaseBucket(supabase, bucket, { allowCreate: true });
        await sleep(attempt * 250);
        continue;
      }

      if (attempt < 3 && isRetryableStorageFailure(statusCode, message)) {
        await sleep(attempt * 500);
        continue;
      }

      if (isNotFoundError(statusCode, message)) {
        throw new AppError(500, `Storage bucket "${bucket}" does not exist`, 'STORAGE_BUCKET_MISSING');
      }

      throw new AppError(500, 'Failed to upload evidence file to the bucket', 'STORAGE_UPLOAD_FAILED');
    }
    // End of change

    throw new AppError(500, 'Failed to upload evidence file', 'STORAGE_UPLOAD_FAILED');
  },

  async deleteEvidenceFile(bucket, filePath) {
    const supabase = createStorageClient();
    const { error } = await supabase.storage.from(bucket).remove([filePath]);

    if (error) {
      throw new AppError(500, 'Failed to delete evidence file', 'STORAGE_DELETE_FAILED');
    }
  },

  async signEvidenceUrl(bucket, filePath, ttlSeconds) {
    const supabase = createStorageClient();

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(filePath, ttlSeconds);

      if (!error && data?.signedUrl) {
        return {
          url: data.signedUrl,
          expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString()
        };
      }

      const message = (error as unknown as { message?: string }).message ?? null;
      const statusCode = normalizeStatusCode(
        (error as unknown as { statusCode?: number | string }).statusCode ?? null
      );
      const notFound = isNotFoundError(statusCode, message);

      if (attempt < 3 && notFound) {
        logger.warn('storage.supabase.sign_retrying_after_not_found', {
          bucket,
          filePath,
          attempt,
          statusCode,
          message
        });
        await sleep(attempt * 250);
        continue;
      }

      logger.error('storage.supabase.sign_failed', {
        bucket,
        filePath,
        message,
        statusCode
      });
      throw new AppError(500, 'Failed to sign evidence URL', 'STORAGE_SIGN_FAILED');
    }

    throw new AppError(500, 'Failed to sign evidence URL', 'STORAGE_SIGN_FAILED');
  }
};
