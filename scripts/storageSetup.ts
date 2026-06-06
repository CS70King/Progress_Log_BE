#!/usr/bin/env tsx

import { env } from '../src/config/env';
import { createStorageClient, ensureSupabaseBucket } from '../src/storage/supabaseStorage';
import { storageDriver } from '../src/storage';
import { allowedUploadMimeTypes } from '../src/utils/fileValidation';

async function main() {
  if (storageDriver !== 'supabase') {
    throw new Error(`storage:setup requires STORAGE_DRIVER=supabase. Current driver: ${storageDriver}`);
  }

  const supabase = createStorageClient();
  const bucket = await ensureSupabaseBucket(supabase, env.SUPABASE_STORAGE_BUCKET, {
    allowCreate: true
  });

  const { error: updateError } = await supabase.storage.updateBucket(env.SUPABASE_STORAGE_BUCKET, {
    public: false,
    fileSizeLimit: `${Math.ceil(env.UPLOAD_MAX_FILE_SIZE_MB)}MB`,
    allowedMimeTypes: Array.from(allowedUploadMimeTypes)
  });

  if (updateError) {
    throw new Error(`Failed to update storage bucket settings: ${updateError.message}`);
  }

  const verifiedBucket = await ensureSupabaseBucket(supabase, env.SUPABASE_STORAGE_BUCKET, {
    allowCreate: false
  });

  if (verifiedBucket.public) {
    throw new Error(`Bucket ${verifiedBucket.name} is public. Expected a private bucket.`);
  }

  console.log('Storage bucket is ready.');
  console.log(`Bucket: ${verifiedBucket.name}`);
  console.log(`Public: ${verifiedBucket.public}`);
  console.log(`File size limit: ${Math.ceil(env.UPLOAD_MAX_FILE_SIZE_MB)}MB`);
  console.log(`Allowed MIME types: ${Array.from(allowedUploadMimeTypes).join(', ')}`);
  if (bucket.name !== verifiedBucket.name) {
    console.log(`Bucket created: ${bucket.name}`);
  }
}

main().catch((error) => {
  console.error('Storage setup failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
