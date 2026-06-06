#!/usr/bin/env tsx

import crypto from 'node:crypto';
import { env } from '../src/config/env';
import { storage, storageDriver } from '../src/storage';
import { createStorageClient, ensureSupabaseBucket } from '../src/storage/supabaseStorage';

const testPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z4w0AAAAASUVORK5CYII=',
  'base64'
);

async function main() {
  if (storageDriver !== 'supabase') {
    console.log(`Storage driver is ${storageDriver}. This verifies only the configured provider, not a real Supabase bucket.`);
  } else {
    await ensureSupabaseBucket(createStorageClient(), env.SUPABASE_STORAGE_BUCKET, {
      allowCreate: false
    });
  }

  const filePath = `healthchecks/storage-test-${crypto.randomUUID()}.png`;
  await storage.uploadEvidenceFile(env.SUPABASE_STORAGE_BUCKET, filePath, testPng, 'image/png');

  try {
    const signed = await storage.signEvidenceUrl(env.SUPABASE_STORAGE_BUCKET, filePath, 60);
    console.log('Storage verification passed.');
    console.log(`Bucket: ${env.SUPABASE_STORAGE_BUCKET}`);
    console.log(`File path: ${filePath}`);
    console.log(`Signed URL expires at: ${signed.expiresAt}`);
  } finally {
    await storage.deleteEvidenceFile(env.SUPABASE_STORAGE_BUCKET, filePath).catch(() => undefined);
  }
}

main().catch((error) => {
  console.error('Storage verification failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
