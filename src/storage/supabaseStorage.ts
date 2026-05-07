import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';
import { AppError } from '../utils/appError';
import { logger } from '../utils/logger';
import { StorageProvider } from './types';

const createStorageClient = () => {
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

export const supabaseStorage: StorageProvider = {
  async uploadEvidenceFile(bucket, filePath, body, contentType) {
    const supabase = createStorageClient();

    const attemptUpload = async () => {
      return supabase.storage.from(bucket).upload(filePath, body, {
        contentType,
        upsert: false
      });
    };

    const { error } = await attemptUpload();

    if (!error) return;

    // In local Supabase, the bucket may not exist yet. In dev/test we auto-create and retry once.
    const msg = (error as unknown as { message?: string }).message ?? '';
    const statusCode = (error as unknown as { statusCode?: number }).statusCode ?? null;
    const bucketMissing =
      statusCode === 404 ||
      msg.toLowerCase().includes('bucket') && msg.toLowerCase().includes('not found');

    logger.error('storage.supabase.upload_failed', {
      bucket,
      filePath,
      statusCode,
      message: msg
    });

    if (bucketMissing && env.NODE_ENV !== 'production') {
      logger.warn('storage.supabase.bucket_missing_auto_create_attempt', {
        bucket
      });

      const created = await supabase.storage.createBucket(bucket, { public: false });
      if (created.error) {
        logger.error('storage.supabase.bucket_create_failed', {
          bucket,
          message: (created.error as unknown as { message?: string }).message ?? ''
        });
        throw new AppError(
          500,
          `Storage bucket "${bucket}" is missing and could not be created`,
          'STORAGE_BUCKET_MISSING'
        );
      }

      const retried = await attemptUpload();
      if (retried.error) {
        logger.error('storage.supabase.upload_failed_after_bucket_create', {
          bucket,
          filePath,
          message: (retried.error as unknown as { message?: string }).message ?? ''
        });
        throw new AppError(500, 'Failed to upload evidence file', 'STORAGE_UPLOAD_FAILED');
      }

      return;
    }

    if (bucketMissing) {
      throw new AppError(500, `Storage bucket "${bucket}" does not exist`, 'STORAGE_BUCKET_MISSING');
    }

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
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(filePath, ttlSeconds);

    if (error || !data?.signedUrl) {
      logger.error('storage.supabase.sign_failed', {
        bucket,
        filePath,
        message: (error as unknown as { message?: string }).message ?? null,
        statusCode: (error as unknown as { statusCode?: number }).statusCode ?? null
      });
      throw new AppError(500, 'Failed to sign evidence URL', 'STORAGE_SIGN_FAILED');
    }

    return {
      url: data.signedUrl,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString()
    };
  }
};
