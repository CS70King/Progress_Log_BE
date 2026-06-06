# Deployment Guide

## Overview

This backend is ready to deploy to Google Cloud Run using:

- Cloud Run
- Cloud Build continuous deployment from GitHub
- Google Cloud buildpacks for Node.js
- Supabase Postgres and Supabase Storage
- Upstash Redis REST for cache and rate limiting

This repo does not need a `Dockerfile` for the MVP deploy path. Cloud Run can build it directly from the GitHub repository with Node.js buildpacks. The runtime starts with `npm start`, which runs `dist/server.js`.

## Runtime Facts For This Repo

- Entry point: `src/server.ts`
- Production start command: `npm start`
- Build command: `npm run build`
- Health endpoints:
  - `GET /health`
  - `GET /health/ready`
  - `GET /health/db`
- Port handling: Cloud Run injects `PORT`, and the server already reads `env.PORT`
- Required env validation is fail-hard in `src/config/env.ts`

## Recommended Cloud Run Shape

For MVP, use:

- Service name: `progress-log-backend`
- Region: pick one and keep it consistent for all environments
  - Example: `us-central1`
- Authentication:
  - `Allow unauthenticated invocations`: enabled
  - Reason: browser clients need to reach the API directly
- CPU: `1`
- Memory: `1 GiB`
- Minimum instances:
  - staging: `0`
  - production: `0` or `1`
- Maximum instances:
  - staging: `2`
  - production: `5`
- Concurrency: `20`
- Request timeout: `300` seconds max in Cloud Run, but keep the app timeout aligned with your env values

## Do Not Deploy With Repo Env Files

Do not use the repo `.env.*` files directly in Cloud Run.

Use:

- Cloud Run environment variables for non-secret values
- Secret Manager for sensitive values

At minimum, treat these as secrets:

- `DATABASE_URL`
- `JWT_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`
- `UPSTASH_REDIS_REST_TOKEN`
- `UPLOAD_SCAN_API_KEY` if scanning is enabled

## Required Runtime Variables

These must be set in Cloud Run for staging or production:

- `LOG_LEVEL`
- `NODE_ENV`
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `SIGNED_URL_TTL_SECONDS`
- `CORS_ORIGIN`
- `STORAGE_DRIVER`
- `TRUST_PROXY`
- `SHUTDOWN_GRACE_PERIOD_MS`
- `REQUEST_TIMEOUT_MS`
- `KEEP_ALIVE_TIMEOUT_MS`
- `HEADERS_TIMEOUT_MS`
- `AUTH_LOGIN_RATE_LIMIT_WINDOW_MS`
- `AUTH_LOGIN_RATE_LIMIT_MAX`
- `AUTH_SIGNUP_RATE_LIMIT_WINDOW_MS`
- `AUTH_SIGNUP_RATE_LIMIT_MAX`
- `RATE_LIMIT_STORE`
- `RATE_LIMIT_REDIS_TIMEOUT_MS`
- `RATE_LIMIT_REDIS_KEY_PREFIX`
- `SHARE_LOOKUP_RATE_LIMIT_WINDOW_MS`
- `SHARE_LOOKUP_RATE_LIMIT_MAX`
- `EVIDENCE_UPLOAD_RATE_LIMIT_WINDOW_MS`
- `EVIDENCE_UPLOAD_RATE_LIMIT_MAX`
- `CACHE_STORE`
- `CACHE_REDIS_TIMEOUT_MS`
- `CACHE_REDIS_KEY_PREFIX`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `CACHE_SHARE_LOOKUP_TTL_SECONDS`
- `CACHE_DOSSIER_PAYLOAD_TTL_SECONDS`
- `AUTH_ACCOUNT_LOCK_THRESHOLD`
- `AUTH_ACCOUNT_LOCK_DURATION_MS`
- `UPLOAD_MAX_FILES`
- `UPLOAD_MAX_FILE_SIZE_MB`
- `UPLOAD_SCAN_MODE`
- `UPLOAD_SCAN_TIMEOUT_MS`
- `PROJECT_SHARE_LINK_TTL_HOURS`
- `SNAPSHOT_SHARE_LINK_TTL_HOURS`
- `PAGINATION_DEFAULT_LIMIT`
- `PAGINATION_MAX_LIMIT`
- `SIGNED_URL_CACHE_TTL_MINUTES`

Conditionally required:

- `UPLOAD_SCAN_URL` when `UPLOAD_SCAN_MODE=http`
- `UPLOAD_SCAN_API_KEY` when your scanner requires it

Not needed for Cloud Run staging/production in the current design:

- `RATE_LIMIT_REDIS_URL`
- `CACHE_REDIS_URL`

Because staging and production use:

- `RATE_LIMIT_STORE=upstash`
- `CACHE_STORE=upstash`

## Suggested Staging Values

Use this shape for staging:

```env
LOG_LEVEL=info
NODE_ENV=staging
JWT_EXPIRES_IN=12h
SIGNED_URL_TTL_SECONDS=3600
STORAGE_DRIVER=supabase
TRUST_PROXY=true
SHUTDOWN_GRACE_PERIOD_MS=10000
REQUEST_TIMEOUT_MS=30000
KEEP_ALIVE_TIMEOUT_MS=65000
HEADERS_TIMEOUT_MS=66000
AUTH_LOGIN_RATE_LIMIT_WINDOW_MS=900000
AUTH_LOGIN_RATE_LIMIT_MAX=5
AUTH_SIGNUP_RATE_LIMIT_WINDOW_MS=3600000
AUTH_SIGNUP_RATE_LIMIT_MAX=10
SHARE_LOOKUP_RATE_LIMIT_WINDOW_MS=60000
SHARE_LOOKUP_RATE_LIMIT_MAX=60
EVIDENCE_UPLOAD_RATE_LIMIT_WINDOW_MS=60000
EVIDENCE_UPLOAD_RATE_LIMIT_MAX=20
AUTH_ACCOUNT_LOCK_THRESHOLD=5
AUTH_ACCOUNT_LOCK_DURATION_MS=900000
RATE_LIMIT_STORE=upstash
RATE_LIMIT_REDIS_TIMEOUT_MS=1500
RATE_LIMIT_REDIS_KEY_PREFIX=progress-log:staging:rate-limit
CACHE_STORE=upstash
CACHE_REDIS_TIMEOUT_MS=1500
CACHE_REDIS_KEY_PREFIX=progress-log:staging:cache
CACHE_SHARE_LOOKUP_TTL_SECONDS=60
CACHE_DOSSIER_PAYLOAD_TTL_SECONDS=300
UPLOAD_MAX_FILES=20
UPLOAD_MAX_FILE_SIZE_MB=25
UPLOAD_SCAN_MODE=off
UPLOAD_SCAN_TIMEOUT_MS=8000
PROJECT_SHARE_LINK_TTL_HOURS=168
SNAPSHOT_SHARE_LINK_TTL_HOURS=72
PAGINATION_DEFAULT_LIMIT=20
PAGINATION_MAX_LIMIT=100
SIGNED_URL_CACHE_TTL_MINUTES=45
```

Secrets and project-specific values should come from Secret Manager or direct Cloud Run env settings:

- `DATABASE_URL`
- `JWT_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `CORS_ORIGIN`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

## Suggested Production Differences

Use the same structure as staging, with these main differences:

- `LOG_LEVEL=warn`
- `NODE_ENV=production`
- `CORS_ORIGIN` should not include localhost
- `RATE_LIMIT_REDIS_KEY_PREFIX=progress-log:production:rate-limit`
- `CACHE_REDIS_KEY_PREFIX=progress-log:production:cache`
- production DB URL
- production Supabase project and bucket
- production Upstash token

## Manual One-Time Tasks Before First Deploy

Do these before the first real deploy:

1. Run database migrations against the target database.
2. Run storage bucket setup for the target environment.
3. Run storage smoke test for the target environment.

Suggested commands from a trusted machine:

```bash
npm run db:migrate:staging
npm run storage:setup:staging
npm run storage:test:staging
```

For production:

```bash
npm run db:migrate:production
npm run storage:setup:production
npm run storage:test:production
```

Optional:

- `npm run db:seed:staging`
- `npm run db:seed:production`

## Cloud Run Continuous Deployment From GitHub

Use Cloud Run console + Cloud Build, not a handwritten GitHub Actions pipeline.

What Cloud Run will do:

1. connect to the GitHub repo through the Cloud Build GitHub app
2. build the service from source using Node.js buildpacks
3. deploy a new revision on pushes to the selected branch

### Build Settings

Use these settings in the Cloud Run repo connection flow:

- Repository provider: `GitHub`
- Build system: `Cloud Build`
- Build type: `Node.js via Google Cloud buildpacks`
- Build context directory: `.`
- Entrypoint: leave blank

Leave the entrypoint blank because this repo already has a valid `start` script:

```json
"start": "node dist/server.js"
```

## Post-Deploy Verification

After deploy, verify:

```bash
curl https://YOUR_SERVICE_URL/health
curl https://YOUR_SERVICE_URL/health/ready
curl https://YOUR_SERVICE_URL/health/db
```

Then verify one real authenticated flow:

1. login
2. create project
3. create milestone
4. upload evidence
5. fetch dossier

## Rollback

If a deploy is bad:

1. open Cloud Run
2. open the service
3. open `Revisions`
4. route traffic back to the previous healthy revision

## Known Constraints

- There is no Dockerfile in this repo, so the deploy path assumes buildpack support.
- Staging and production depend on correct external configuration:
  - Supabase DB
  - Supabase Storage bucket
  - Upstash Redis REST
- Migrations are not run automatically by the app on startup. Run them separately before or during release.
- Do not add `PORT` manually in Cloud Run. Cloud Run injects it automatically.
