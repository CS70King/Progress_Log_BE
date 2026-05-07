import { app } from './app';
import { env } from './config/env';
import { storageDriver } from './storage';
import { logger } from './utils/logger';

app.listen(env.PORT, () => {
  console.log(`Progress Log backend listening on port ${env.PORT}`);
  logger.info('app.start', {
    nodeEnv: env.NODE_ENV,
    storageDriver,
    supabaseUrl: env.SUPABASE_URL ?? null,
    storageBucket: env.SUPABASE_STORAGE_BUCKET
  });
});
