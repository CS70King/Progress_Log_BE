# Progress Log Backend

Progress Log is a milestone-based backend for recording project progress, uploading evidence, reviewing milestones, freezing snapshots, and sharing dossier JSON through signed evidence URLs.

## Stack

- Node.js + TypeScript
- Express
- Prisma + Postgres
- Supabase Storage for private evidence files
- JWT authentication
- Zod validation
- Multer multipart uploads

## Implemented MVP

- `POST /auth/signup`
- `POST /auth/login`
- `GET /me`
- `POST /projects`
- `GET /projects`
- `GET /projects/:projectId`
- `POST /projects/:projectId/invite-reviewer`
- `POST /projects/:projectId/milestones`
- `POST /projects/:projectId/milestones/with-evidence`
- `GET /projects/:projectId/milestones`
- `GET /milestones/:milestoneId`
- `PATCH /milestones/:milestoneId`
- `POST /milestones/:milestoneId/submit`
- `POST /milestones/:milestoneId/evidence`
- `DELETE /evidence/:evidenceId`
- `POST /milestones/:milestoneId/review`
- `POST /projects/:projectId/snapshots`
- `GET /projects/:projectId/snapshots`
- `GET /snapshots/:snapshotId`
- `POST /projects/:projectId/share`
- `DELETE /projects/:projectId/share/:shareLinkId`
- `POST /snapshots/:snapshotId/share`
- `DELETE /snapshots/:snapshotId/share/:shareLinkId`
- `GET /projects/:projectId/dossier`
- `GET /snapshots/:snapshotId/dossier`
- `GET /share/:token/dossier`
- `GET /health`
- `GET /health/db`
- `GET /health/ready`

## Environment

Use one of the environment templates as your active `.env` file:

- `.env.development` for local Supabase development
- `.env.staging` for the staging Supabase project
- `.env.production` for the production Supabase project

For local development, copy `.env.development` to `.env`, then replace
`SUPABASE_SERVICE_ROLE_KEY` with the local service role key printed by
`npx supabase start`.

```bash
cp .env.development .env
```

The active `.env` should contain:

```env
NODE_ENV=development
LOG_LEVEL=info
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
JWT_SECRET=local-dev-secret
JWT_EXPIRES_IN=30d
SUPABASE_URL=http://127.0.0.1:54320
SUPABASE_SERVICE_ROLE_KEY=your-local-service-role-key
SUPABASE_STORAGE_BUCKET=dev-progress-evidence
SIGNED_URL_TTL_SECONDS=3600
CORS_ORIGIN=http://localhost:5173
STORAGE_DRIVER=supabase
TRUST_PROXY=false
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
RATE_LIMIT_STORE=redis
RATE_LIMIT_REDIS_URL=redis://127.0.0.1:6379/0
RATE_LIMIT_REDIS_TIMEOUT_MS=1500
RATE_LIMIT_REDIS_KEY_PREFIX=progress-log:development:rate-limit
CACHE_STORE=redis
CACHE_REDIS_URL=redis://127.0.0.1:6379/1
CACHE_REDIS_TIMEOUT_MS=1500
CACHE_REDIS_KEY_PREFIX=progress-log:development:cache
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
CACHE_SHARE_LOOKUP_TTL_SECONDS=60
CACHE_DOSSIER_PAYLOAD_TTL_SECONDS=300
SIGNED_URL_CACHE_TTL_MINUTES=45
UPLOAD_MAX_FILES=20
UPLOAD_MAX_FILE_SIZE_MB=25
UPLOAD_SCAN_MODE=off
UPLOAD_SCAN_URL=https://scanner.example.com/scan
UPLOAD_SCAN_TIMEOUT_MS=8000
UPLOAD_SCAN_API_KEY=
PROJECT_SHARE_LINK_TTL_HOURS=168
SNAPSHOT_SHARE_LINK_TTL_HOURS=72
PAGINATION_DEFAULT_LIMIT=20
PAGINATION_MAX_LIMIT=100
```

Use `STORAGE_DRIVER=mock` for tests or when you want to avoid real Supabase calls.
Use `NOTIFICATION_DRIVER=off` by default, or `NOTIFICATION_DRIVER=mock` in tests.
For staging and production, use `RATE_LIMIT_STORE=upstash` and `CACHE_STORE=upstash` with `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

Security defaults:

- auth rate limiting is enabled on `/auth/signup` and `/auth/login`
- public share dossier lookup is rate limited per IP
- evidence uploads are rate limited per user and IP
- accounts lock for 15 minutes after 5 failed password attempts
- share links expire by default
- file scanning can be enabled with `UPLOAD_SCAN_MODE=http`
- Redis-backed rate limiting is available through `RATE_LIMIT_STORE=redis`
- Redis-backed caching with memory acceleration is available through `CACHE_STORE=redis`

## SMS Notifications

Workflow SMS alerts are optional and disabled by default. When enabled, messages route by recipient region.

### Architecture

```
notificationService          business events + message copy
       ↓
routingNotificationProvider  picks provider per recipient
       ├── USA (+1)  → Surge
       ├── Ghana (+233) → Arkesel stub (logs only until implemented)
       └── other     → skipped (warning log)
```

Code lives in `src/services/notificationService.ts` (what/when) and `src/notifications/` (how to send). SMS failures are logged but do not fail the API request.

### Drivers

| `NOTIFICATION_DRIVER` | Behavior |
|----------------------|----------|
| `off` | No SMS (default for local dev) |
| `mock` | Log payload only (used by `npm test`) |
| `surge` | Route and send via Surge / Arkesel stub |
| `routing` | Same as `surge` |

### Workflow events

| Event | Trigger | Recipient |
|-------|---------|-----------|
| Reviewer added | `POST /projects` with `reviewer_phone(s)` | Each reviewer |
| Reviewer invited | `POST /projects/:projectId/invite-reviewer` | Invited reviewer |
| Milestone submitted | `POST /milestones/:milestoneId/submit` | All project reviewers |
| Milestone reviewed | `POST /milestones/:milestoneId/review` | Milestone creator (worker) |

Messages include the recipient's first name, actor name, project/milestone title, and an app link from the first origin in `CORS_ORIGIN`.

### Environment strategy

Use separate Surge credentials per environment. Do not reuse production keys in development or staging.

| Environment | `NOTIFICATION_DRIVER` | SMS behavior | Surge setup |
|-------------|----------------------|--------------|-------------|
| **Development** | `off` (recommended default) | No SMS sent | Optional: keep demo Surge creds to manually test with `surge` |
| **Tests / CI** | `mock` | Log only | None (`npm test` sets this automatically) |
| **Staging** | `surge` | Real SMS to team/test numbers | Separate staging account, number, and campaign |
| **Production** | `surge` | Real SMS to users | Separate prod account, number, and approved campaign |

**Development notes:**

- Leave `NOTIFICATION_DRIVER=off` for day-to-day work so seed data and flows never text real users.
- Flip to `surge` only when actively testing SMS. Demo Surge numbers typically deliver only to your own phone.
- Use `npm run notification:test -- +1YOUR_PHONE` for a direct send check.

**Staging / production notes:**

- Register a dedicated sending number and carrier campaign for each environment.
- Demo/trial numbers are not suitable for staging or production.
- Ghana recipients remain stubbed until Arkesel is implemented; US numbers use Surge today.

### Environment variables

```env
NOTIFICATION_DRIVER=off
SURGE_API_KEY=
SURGE_ACCOUNT_ID=
SURGE_FROM_PHONE_NUMBER=
NOTIFICATION_TIMEOUT_MS=8000
```

When `NOTIFICATION_DRIVER` is `surge` or `routing`, `SURGE_API_KEY` and `SURGE_ACCOUNT_ID` are required.

### Surge setup checklist

1. Create an API key in the Surge dashboard.
2. Copy your account id (`acct_...`) from the dashboard or `GET https://api.surge.app/accounts`.
3. Purchase or assign a sending phone number on the account.
4. Complete carrier campaign registration before sending to real US numbers.
5. Add the values above to the active env file and set `NOTIFICATION_DRIVER=surge`.

### Verification scripts

```bash
# Check Surge account, number, and credentials
npx tsx scripts/surgeStatus.ts

# Send a one-off test SMS (requires NOTIFICATION_DRIVER=surge)
npm run notification:test -- +15555550100

# Environment-specific wrappers
npm run notification:test:staging -- +15555550100
npm run notification:test:production -- +15555550100
```

Startup logs include `notificationDriver`, `surgeApiKeyConfigured`, and related fields under the `app.start` event.

## Setup

1. Install dependencies.
   `npm install`
2. Generate the Prisma client.
   `npm run db:generate`
3. Run migrations.
   `npm run db:migrate`
4. Seed demo data.
   `npm run db:seed`
5. Start the development server.
   `npm run dev`

## Supabase Storage

Create a private bucket named `progress-evidence`.

Server behavior:

- Stores only `file_path` in Postgres.
- Upload path format is `projects/{projectId}/milestones/{milestoneId}/{evidenceItemId}-{safeFilename}`.
- Generates signed URLs on dossier reads and standard project/milestone evidence fetches.
- Uses `SUPABASE_SERVICE_ROLE_KEY` only on the server.

Evidence response behavior:

- `GET /projects/:projectId`
- `GET /projects/:projectId/milestones`
- `GET /milestones/:milestoneId`
- `POST /milestones/:milestoneId/evidence`

These responses include:

- `signed_url` and `signed_url_expires_at` for the original file
- `thumbnail_path`, `thumbnail_size_bytes`, `thumbnail_width`, `thumbnail_height`
- `thumbnail_signed_url` and `thumbnail_signed_url_expires_at` when a thumbnail exists

Thumbnail generation coverage:

- photos: generated from the original image
- videos: generated from a captured frame
- documents: generated for `pdf`, `doc`, `docx`, `xls`, `xlsx`, `txt`, and `csv`

Document preview behavior:

- PDFs use a real first-page render
- `doc`, `docx`, `xls`, `xlsx`, `txt`, and `csv` attempt a real first-page render through LibreOffice first
- if LibreOffice is unavailable or conversion fails, the backend falls back to a content-based preview image for those non-PDF document formats

The dossier endpoints keep `file_url` and `thumbnail_url` naming in their report payloads.

Atomicity notes:

- `POST /milestones/:milestoneId/evidence` is all-or-nothing for the full batch. If any file in the request fails validation, scanning, thumbnailing, storage upload, or DB persistence, the backend rolls back every evidence item created by that request.
- `POST /projects/:projectId/milestones/with-evidence` creates a milestone and its first evidence batch atomically. If the evidence step fails, the new milestone is deleted.
- `POST /projects/:projectId/milestones` followed later by `POST /milestones/:milestoneId/evidence` are still two separate HTTP requests, so they are not cross-request atomic by design.

Recommended bucket setup:

- Bucket visibility: private
- Client-side direct access: disabled
- All uploads, deletes, and signed URL generation: server-side only

Storage commands:

- `npm run storage:setup`
- `npm run storage:test`
- `npm run storage:setup:staging`
- `npm run storage:test:staging`
- `npm run storage:setup:production`
- `npm run storage:test:production`

Deployment note:

- Run `npm run storage:setup:production` once before first production deploy.
- Run `npm run storage:test:production` as part of release verification.
- Storage backup / restore placeholders live in `docs/STORAGE_RUNBOOK.md`.

## Seed Data

The canonical seed script is `scripts/seedDatabase.ts`.

Behavior by environment:

- `development`: seeds 10 projects if the seed users do not already exist
- `staging`: seeds 5 projects if the seed users do not already exist
- `production`: asks for confirmation, then seeds 3 projects if the seed users do not already exist

Commands:

- `npm run db:seed`
- `npm run db:seed:development`
- `npm run db:seed:staging`
- `npm run db:seed:production`

`development` and `staging` do not prompt.
`production` always requires an explicit interactive confirmation.

Seed behavior:

- Seeded image evidence is downloaded, uploaded to storage, and stored with real file paths.
- Seeded photo, video, and PDF document thumbnails are generated and uploaded alongside the originals.
- `development` and `staging` auto-create the bucket if it does not exist.
- `production` expects the bucket to already exist.
- The seed is non-destructive and skips entirely if either demo seed user already exists.
- Use `db:wipe` or `db:wipe:staging` before seeding when you want a clean reseed.

## Sample curl

Signup:

```bash
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Worker One","phone":"+10123456780","country":"United States","role":"worker","password":"WorkerPass123!"}'
```

Login:

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"+10123456780","password":"WorkerPass123!"}'
```

Create project:

```bash
curl -X POST http://localhost:3000/projects \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Site Build","project_type":"construction","reviewer_phones":["+10123456780"]}'
```

Create milestone:

```bash
curl -X POST http://localhost:3000/projects/<PROJECT_ID>/milestones \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Foundation","description":"Foundation complete","activity_date":"2026-03-20"}'
```

Upload evidence:

```bash
curl -X POST http://localhost:3000/milestones/<MILESTONE_ID>/evidence \
  -H "Authorization: Bearer <TOKEN>" \
  -F "evidence_type=photo" \
  -F "files=@/path/to/photo-1.jpg" \
  -F "files=@/path/to/photo-2.jpg"
```

Review milestone:

```bash
curl -X POST http://localhost:3000/milestones/<MILESTONE_ID>/review \
  -H "Authorization: Bearer <REVIEWER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"decision":"approved"}'
```

View milestone:

```bash
curl -X GET http://localhost:3000/milestones/<MILESTONE_ID> \
  -H "Authorization: Bearer <TOKEN>"
```

Fetch dossier:

```bash
curl -X GET http://localhost:3000/projects/<PROJECT_ID>/dossier \
  -H "Authorization: Bearer <TOKEN>"
```

Revoke a project share link:

```bash
curl -X DELETE http://localhost:3000/projects/<PROJECT_ID>/share/<SHARE_LINK_ID> \
  -H "Authorization: Bearer <TOKEN>"
```

## Testing

The integration test covers:

- signup and login
- project creation
- milestone creation
- multi-file upload
- submission
- review
- dossier generation
- snapshot creation
- public share dossier access

Run tests:

```bash
npm test
```

Test prerequisites:

- a reachable Postgres database in `DATABASE_URL`
- `STORAGE_DRIVER=mock` so tests do not call Supabase

## Postman

The collection lives at `postman/ProgressLog.postman_collection.json`.
