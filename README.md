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
- `POST /snapshots/:snapshotId/share`
- `GET /projects/:projectId/dossier`
- `GET /snapshots/:snapshotId/dossier`
- `GET /share/:token/dossier`
- `GET /health`
- `GET /health/db`

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
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
JWT_SECRET=local-dev-secret
JWT_EXPIRES_IN=30d
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=your-local-service-role-key
SUPABASE_STORAGE_BUCKET=progress-evidence
SIGNED_URL_TTL_SECONDS=3600
CORS_ORIGIN=http://localhost:5173
STORAGE_DRIVER=supabase
```

Use `STORAGE_DRIVER=mock` for tests or when you want to avoid real Supabase calls.

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
- Generates signed URLs on dossier reads.
- Uses `SUPABASE_SERVICE_ROLE_KEY` only on the server.

Recommended bucket setup:

- Bucket visibility: private
- Client-side direct access: disabled
- All uploads, deletes, and signed URL generation: server-side only

## Seed Data

The seed creates:

- One worker: `+15555550100` / `1234`
- One reviewer: `+15555550200` / `1234`
- One project with both users attached
- Four milestones with mixed statuses

## Sample curl

Signup:

```bash
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Worker One","phone":"+15555550100","country":"United States","role":"worker","pin":"1234"}'
```

Login:

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"+15555550100","pin":"1234"}'
```

Create project:

```bash
curl -X POST http://localhost:3000/projects \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Site Build","project_type":"construction","reviewer_phones":["+15555550200"]}'
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
