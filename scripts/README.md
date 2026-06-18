# Database Scripts

This directory contains the database management scripts for Progress Log.

## Scripts Overview

### 1. `seedDatabase.ts`

Canonical environment-aware seeding script.

Behavior by environment:
- `development`: seeds 3 projects (active, abandoned, completed) if the seed users do not already exist
- `staging`: seeds 3 projects (active, abandoned, completed) if the seed users do not already exist
- `production`: asks for confirmation, then seeds 3 projects (active, abandoned, completed) if the seed users do not already exist

Usage:
```bash
# Development
npm run db:seed
# or
npm run db:seed:development

# Staging
npm run db:seed:staging

# Production
npm run db:seed:production
```

Confirmation behavior:
- `production`: type `SEED PRODUCTION`
- development and staging do not prompt
- production always requires an explicit interactive confirmation

Login credentials:
- Worker: `+10123456780` / `WorkerDemo123!`
- Reviewer: `+10123456780` / `ReviewerDemo123!`

Notes:
- The script is non-destructive. It skips seeding entirely if either seed user already exists.
- Use `db:wipe` or `db:wipe:staging` first when you want a clean reseed.
- Production preserves existing rows and only adds seed data after confirmation.
- Seeded evidence includes a real mix of photos, videos, and files.
- Seeded photos, videos, and PDF documents are uploaded with generated thumbnails.
- Production seeding requires a ready bucket. Run `npm run storage:setup:production` first.

### 2. `storageSetup.ts`

Provision and harden the configured storage bucket.

Usage:
```bash
npm run storage:setup
npm run storage:setup:staging
npm run storage:setup:production
```

Behavior:
- Creates the bucket when missing
- Enforces private bucket visibility
- Applies the evidence MIME allowlist
- Applies the configured upload size limit

### 3. `storageTest.ts`

Verifies upload, signed URL, and delete against the configured storage backend.

Usage:
```bash
npm run storage:test
npm run storage:test:staging
npm run storage:test:production
```

### 4. `wipeDatabase.ts`

Complete database reset for development or staging only.

Usage:
```bash
# Development
npm run db:wipe

# Staging
npm run db:wipe:staging
```

Safety behavior:
- Allowed only when `NODE_ENV=development` or `NODE_ENV=staging`
- Deletes in foreign-key-safe order
- Deletes DB-linked storage files before deleting rows

### 5. `wipeProductionUser.ts`

Safely deletes one production user and the deletable records tied to that user.

Usage:
```bash
npm run db:wipe:user -- <phone-number>
```

Safety behavior:
- Runs only when `NODE_ENV=production`
- Requires the target user's password
- Shows the deletion scope first
- Requires typing `DELETE USER <phone-number>`
- Deletes DB-linked storage files for that user's affected evidence records

## Recommended Flow

Development:
```bash
npm run db:migrate:development
npm run db:seed
npm run dev:development
```

Staging:
```bash
npm run db:migrate:staging
npm run db:seed:staging
npm run start:staging
```

Production:
```bash
npm run db:migrate:production
npm run db:seed:production
npm run start:production
```
