import { env } from './env';
import { notificationUsesRegionalRouting } from '../notifications';
import { devNotificationAllowlistEnabled } from '../notifications/devNotificationAllowlist';
import { maskPhone } from '../utils/logger';
const readEnvFile = () => process.env.ENV_FILE || '.env';

const readDatabaseHost = (databaseUrl: string) => {
  try {
    return new URL(databaseUrl).host;
  } catch {
    return 'invalid';
  }
};

const readOptionalUrlHost = (value?: string) => {
  if (!value?.trim()) {
    return null;
  }

  try {
    return new URL(value).host;
  } catch {
    return 'invalid';
  }
};

export const getStartupEnvSummary = () => ({
  envFile: readEnvFile(),
  nodeEnv: env.NODE_ENV,
  logLevel: env.LOG_LEVEL,
  port: env.PORT,
  corsOrigin: env.CORS_ORIGIN,
  trustProxy: env.TRUST_PROXY,
  jwtExpiresIn: env.JWT_EXPIRES_IN,
  databaseHost: readDatabaseHost(env.DATABASE_URL),
  storageDriver: env.STORAGE_DRIVER,
  supabaseUrl: env.SUPABASE_URL ?? null,
  supabaseServiceRoleConfigured: Boolean(env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
  storageBucket: env.SUPABASE_STORAGE_BUCKET,
  notificationDriver: env.NOTIFICATION_DRIVER,
  notificationUsesRegionalRouting,
  surgeAccountId: env.SURGE_ACCOUNT_ID ?? null,
  surgeFromPhone: env.SURGE_FROM_PHONE_NUMBER ? maskPhone(env.SURGE_FROM_PHONE_NUMBER) : null,
  surgeApiKeyConfigured: Boolean(env.SURGE_API_KEY?.trim()),
  arkeselSenderId: env.ARKESEL_SENDER_ID ?? null,
  arkeselApiKeyConfigured: Boolean(env.ARKESEL_API_KEY?.trim()),
  notificationTimeoutMs: env.NOTIFICATION_TIMEOUT_MS,
  devNotificationAllowlistEnabled,
  devNotificationUsaPhone: devNotificationAllowlistEnabled
    ? maskPhone(env.DEV_NOTIFICATION_USA_PHONE!)
    : null,
  devNotificationGhanaPhone: devNotificationAllowlistEnabled
    ? maskPhone(env.DEV_NOTIFICATION_GHANA_PHONE!)
    : null,
  rateLimitStore: env.RATE_LIMIT_STORE,
  cacheStore: env.CACHE_STORE,
  upstashConfigured: Boolean(env.UPSTASH_REDIS_REST_URL?.trim() && env.UPSTASH_REDIS_REST_TOKEN?.trim()),
  uploadScanMode: env.UPLOAD_SCAN_MODE,
  uploadScanUrlHost: readOptionalUrlHost(env.UPLOAD_SCAN_URL)
});
