import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: process.env.ENV_FILE || '.env' });

const placeholderSecrets = new Set([
  'change-me',
  'local-dev-secret',
  'replace-with-strong-staging-secret',
  'replace-with-strong-production-secret'
]);

const parseOrigins = (value: string) => {
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const isValidUrl = (value: string) => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }

    if (['false', '0', 'no', 'off', ''].includes(normalized)) {
      return false;
    }
  }

  return value;
}, z.boolean());

const isValidRedisUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'redis:' || parsed.protocol === 'rediss:';
  } catch {
    return false;
  }
};

const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_EXPIRES_IN: z.string().default('12h'),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default('progress-evidence'),
  SIGNED_URL_TTL_SECONDS: z.coerce.number().default(3600),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  STORAGE_DRIVER: z.enum(['supabase', 'mock']).default('supabase'),
  TRUST_PROXY: booleanFromEnv.default(false),
  SHUTDOWN_GRACE_PERIOD_MS: z.coerce.number().int().positive().default(10000),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  KEEP_ALIVE_TIMEOUT_MS: z.coerce.number().int().positive().default(65000),
  HEADERS_TIMEOUT_MS: z.coerce.number().int().positive().default(66000),
  AUTH_LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  AUTH_LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
  AUTH_SIGNUP_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60 * 60 * 1000),
  AUTH_SIGNUP_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_STORE: z.enum(['memory', 'redis']).default('memory'),
  RATE_LIMIT_REDIS_URL: z.string().optional(),
  RATE_LIMIT_REDIS_TIMEOUT_MS: z.coerce.number().int().positive().default(1500),
  RATE_LIMIT_REDIS_KEY_PREFIX: z.string().trim().min(1).default('progress-log:rate-limit'),
  AUTH_ACCOUNT_LOCK_THRESHOLD: z.coerce.number().int().positive().default(5),
  AUTH_ACCOUNT_LOCK_DURATION_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  UPLOAD_MAX_FILES: z.coerce.number().int().positive().default(20),
  UPLOAD_MAX_FILE_SIZE_MB: z.coerce.number().positive().default(25),
  UPLOAD_SCAN_MODE: z.enum(['off', 'http']).default('off'),
  UPLOAD_SCAN_URL: z.string().optional(),
  UPLOAD_SCAN_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  UPLOAD_SCAN_API_KEY: z.string().optional(),
  PROJECT_SHARE_LINK_TTL_HOURS: z.coerce.number().positive().default(168),
  SNAPSHOT_SHARE_LINK_TTL_HOURS: z.coerce.number().positive().default(72),
  PAGINATION_DEFAULT_LIMIT: z.coerce.number().int().positive().default(20),
  PAGINATION_MAX_LIMIT: z.coerce.number().int().positive().default(100),
  SIGNED_URL_CACHE_TTL_MINUTES: z.coerce.number().int().nonnegative().default(45),
  SEED_PROJECT_COUNT: z.coerce.number().int().positive().optional(),
  SEED_MIN_MILESTONES: z.coerce.number().int().positive().optional(),
  SEED_MAX_MILESTONES: z.coerce.number().int().positive().optional(),
  SEED_MIN_IMAGES_PER_MILESTONE: z.coerce.number().int().positive().optional(),
  SEED_MAX_IMAGES_PER_MILESTONE: z.coerce.number().int().positive().optional()
});

const envSchema = baseEnvSchema.superRefine((value, ctx) => {
  if (value.STORAGE_DRIVER === 'supabase') {
    if (!value.SUPABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SUPABASE_URL'],
        message: 'SUPABASE_URL is required when STORAGE_DRIVER=supabase'
      });
    } else if (!isValidUrl(value.SUPABASE_URL)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SUPABASE_URL'],
        message: 'SUPABASE_URL must be a valid URL'
      });
    }

    if (!value.SUPABASE_SERVICE_ROLE_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SUPABASE_SERVICE_ROLE_KEY'],
        message: 'SUPABASE_SERVICE_ROLE_KEY is required when STORAGE_DRIVER=supabase'
      });
    }
  }

  if (value.RATE_LIMIT_STORE === 'redis') {
    if (!value.RATE_LIMIT_REDIS_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['RATE_LIMIT_REDIS_URL'],
        message: 'RATE_LIMIT_REDIS_URL is required when RATE_LIMIT_STORE=redis'
      });
    } else if (!isValidRedisUrl(value.RATE_LIMIT_REDIS_URL)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['RATE_LIMIT_REDIS_URL'],
        message: 'RATE_LIMIT_REDIS_URL must start with redis:// or rediss://'
      });
    }
  }

  if (value.UPLOAD_SCAN_MODE === 'http') {
    if (!value.UPLOAD_SCAN_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['UPLOAD_SCAN_URL'],
        message: 'UPLOAD_SCAN_URL is required when UPLOAD_SCAN_MODE=http'
      });
    } else if (!isValidUrl(value.UPLOAD_SCAN_URL)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['UPLOAD_SCAN_URL'],
        message: 'UPLOAD_SCAN_URL must be a valid URL'
      });
    }
  }

  const isHardenedEnvironment = value.NODE_ENV === 'staging' || value.NODE_ENV === 'production';

  if (isHardenedEnvironment) {
    if (value.JWT_SECRET.length < 32 || placeholderSecrets.has(value.JWT_SECRET)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET must be at least 32 characters and not use a placeholder value'
      });
    }

    const origins = parseOrigins(value.CORS_ORIGIN);
    if (!origins.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CORS_ORIGIN'],
        message: 'CORS_ORIGIN must contain at least one allowed frontend origin'
      });
    }

    for (const origin of origins) {
      if (!isValidUrl(origin)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['CORS_ORIGIN'],
          message: `Invalid CORS origin: ${origin}`
        });
        continue;
      }

      const parsedOrigin = new URL(origin);
      if (parsedOrigin.protocol !== 'https:') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['CORS_ORIGIN'],
          message: 'Production and staging CORS origins must use https'
        });
      }

      if (parsedOrigin.hostname === 'localhost' || parsedOrigin.hostname === '127.0.0.1') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['CORS_ORIGIN'],
          message: 'Production and staging CORS origins cannot point to localhost'
        });
      }
    }
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
  throw new Error(`Invalid environment configuration: ${issues.join(', ')}`);
}

export const env = parsed.data;
