import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: process.env.ENV_FILE || '.env' });

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
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']),
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']),
  PORT: z.coerce.number().int().min(1).max(65535),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_EXPIRES_IN: z.string().trim().min(1, 'JWT_EXPIRES_IN is required'),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().trim().min(1, 'SUPABASE_STORAGE_BUCKET is required'),
  SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive(),
  CORS_ORIGIN: z.string().trim().min(1, 'CORS_ORIGIN is required'),
  STORAGE_DRIVER: z.enum(['supabase', 'mock']),
  TRUST_PROXY: booleanFromEnv,
  SHUTDOWN_GRACE_PERIOD_MS: z.coerce.number().int().positive(),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive(),
  KEEP_ALIVE_TIMEOUT_MS: z.coerce.number().int().positive(),
  HEADERS_TIMEOUT_MS: z.coerce.number().int().positive(),
  AUTH_LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive(),
  AUTH_LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive(),
  AUTH_SIGNUP_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive(),
  AUTH_SIGNUP_RATE_LIMIT_MAX: z.coerce.number().int().positive(),
  RATE_LIMIT_STORE: z.enum(['memory', 'redis', 'upstash']),
  RATE_LIMIT_REDIS_URL: z.string().optional(),
  RATE_LIMIT_REDIS_TIMEOUT_MS: z.coerce.number().int().positive(),
  RATE_LIMIT_REDIS_KEY_PREFIX: z.string().trim().min(1),
  SHARE_LOOKUP_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive(),
  SHARE_LOOKUP_RATE_LIMIT_MAX: z.coerce.number().int().positive(),
  EVIDENCE_UPLOAD_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive(),
  EVIDENCE_UPLOAD_RATE_LIMIT_MAX: z.coerce.number().int().positive(),
  CACHE_STORE: z.enum(['memory', 'redis', 'upstash']),
  CACHE_REDIS_URL: z.string().optional(),
  CACHE_REDIS_TIMEOUT_MS: z.coerce.number().int().positive(),
  CACHE_REDIS_KEY_PREFIX: z.string().trim().min(1),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  CACHE_SHARE_LOOKUP_TTL_SECONDS: z.coerce.number().int().positive(),
  CACHE_DOSSIER_PAYLOAD_TTL_SECONDS: z.coerce.number().int().positive(),
  AUTH_ACCOUNT_LOCK_THRESHOLD: z.coerce.number().int().positive(),
  AUTH_ACCOUNT_LOCK_DURATION_MS: z.coerce.number().int().positive(),
  UPLOAD_MAX_FILES: z.coerce.number().int().positive(),
  UPLOAD_MAX_FILE_SIZE_MB: z.coerce.number().positive(),
  UPLOAD_SCAN_MODE: z.enum(['off', 'http']),
  UPLOAD_SCAN_URL: z.string().optional(),
  UPLOAD_SCAN_TIMEOUT_MS: z.coerce.number().int().positive(),
  UPLOAD_SCAN_API_KEY: z.string().optional(),
  PROJECT_SHARE_LINK_TTL_HOURS: z.coerce.number().positive(),
  SNAPSHOT_SHARE_LINK_TTL_HOURS: z.coerce.number().positive(),
  PAGINATION_DEFAULT_LIMIT: z.coerce.number().int().positive(),
  PAGINATION_MAX_LIMIT: z.coerce.number().int().positive(),
  SIGNED_URL_CACHE_TTL_MINUTES: z.coerce.number().int().nonnegative(),
  SEED_PROJECT_COUNT: z.coerce.number().int().positive().optional(),
  SEED_MIN_MILESTONES: z.coerce.number().int().positive().optional(),
  SEED_MAX_MILESTONES: z.coerce.number().int().positive().optional(),
  SEED_MIN_IMAGES_PER_MILESTONE: z.coerce.number().int().positive().optional(),
  SEED_MAX_IMAGES_PER_MILESTONE: z.coerce.number().int().positive().optional()
});

const envSchema = baseEnvSchema.superRefine((value, ctx) => {
  if (value.KEEP_ALIVE_TIMEOUT_MS >= value.HEADERS_TIMEOUT_MS) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['KEEP_ALIVE_TIMEOUT_MS'],
      message: 'KEEP_ALIVE_TIMEOUT_MS must be less than HEADERS_TIMEOUT_MS'
    });
  }

  if (value.PAGINATION_DEFAULT_LIMIT > value.PAGINATION_MAX_LIMIT) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['PAGINATION_DEFAULT_LIMIT'],
      message: 'PAGINATION_DEFAULT_LIMIT cannot exceed PAGINATION_MAX_LIMIT'
    });
  }

  if (
    value.SEED_MIN_MILESTONES !== undefined &&
    value.SEED_MAX_MILESTONES !== undefined &&
    value.SEED_MIN_MILESTONES > value.SEED_MAX_MILESTONES
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['SEED_MIN_MILESTONES'],
      message: 'SEED_MIN_MILESTONES cannot exceed SEED_MAX_MILESTONES'
    });
  }

  if (
    value.SEED_MIN_IMAGES_PER_MILESTONE !== undefined &&
    value.SEED_MAX_IMAGES_PER_MILESTONE !== undefined &&
    value.SEED_MIN_IMAGES_PER_MILESTONE > value.SEED_MAX_IMAGES_PER_MILESTONE
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['SEED_MIN_IMAGES_PER_MILESTONE'],
      message: 'SEED_MIN_IMAGES_PER_MILESTONE cannot exceed SEED_MAX_IMAGES_PER_MILESTONE'
    });
  }

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

  if (value.RATE_LIMIT_STORE === 'upstash') {
    if (!value.UPSTASH_REDIS_REST_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['UPSTASH_REDIS_REST_URL'],
        message: 'UPSTASH_REDIS_REST_URL is required when RATE_LIMIT_STORE=upstash'
      });
    } else if (!isValidUrl(value.UPSTASH_REDIS_REST_URL)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['UPSTASH_REDIS_REST_URL'],
        message: 'UPSTASH_REDIS_REST_URL must be a valid URL'
      });
    }

    if (!value.UPSTASH_REDIS_REST_TOKEN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['UPSTASH_REDIS_REST_TOKEN'],
        message: 'UPSTASH_REDIS_REST_TOKEN is required when RATE_LIMIT_STORE=upstash'
      });
    }
  }

  if (value.CACHE_STORE === 'redis') {
    const cacheRedisUrl = value.CACHE_REDIS_URL ?? value.RATE_LIMIT_REDIS_URL;
    if (!cacheRedisUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CACHE_REDIS_URL'],
        message: 'CACHE_REDIS_URL is required when CACHE_STORE=redis unless RATE_LIMIT_REDIS_URL is set'
      });
    } else if (!isValidRedisUrl(cacheRedisUrl)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CACHE_REDIS_URL'],
        message: 'CACHE_REDIS_URL must start with redis:// or rediss://'
      });
    }
  }

  if (value.CACHE_STORE === 'upstash') {
    if (!value.UPSTASH_REDIS_REST_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['UPSTASH_REDIS_REST_URL'],
        message: 'UPSTASH_REDIS_REST_URL is required when CACHE_STORE=upstash'
      });
    } else if (!isValidUrl(value.UPSTASH_REDIS_REST_URL)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['UPSTASH_REDIS_REST_URL'],
        message: 'UPSTASH_REDIS_REST_URL must be a valid URL'
      });
    }

    if (!value.UPSTASH_REDIS_REST_TOKEN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['UPSTASH_REDIS_REST_TOKEN'],
        message: 'UPSTASH_REDIS_REST_TOKEN is required when CACHE_STORE=upstash'
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
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
  throw new Error(`Invalid environment configuration: ${issues.join(', ')}`);
}

export const env = parsed.data;
