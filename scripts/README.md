# Database Scripts

This directory contains the database management scripts for Progress Log.

## Scripts Overview

### 1. `seedDatabase.ts`

Canonical environment-aware seeding script.

Behavior by environment:
- `development`: asks for confirmation, wipes the database, then seeds 10 projects
- `staging`: asks for confirmation, wipes the database, then seeds 5 projects
- `production`: asks for confirmation, does not wipe, then seeds 3 projects
- `test`: asks for confirmation, wipes the database, then seeds 1 project

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
- `development`: type `WIPE DEVELOPMENT`
- `staging`: type `WIPE STAGING`
- `production`: type `SEED PRODUCTION`
- `test`: type `WIPE TEST`
- Set `SKIP_CONFIRMATION=true` only for automation

Login credentials:
- Worker: `+15555550100` / `WorkerDemo123!`
- Reviewer: `+15555550200` / `ReviewerDemo123!`

Notes:
- Development and staging are destructive by design. They fully clear the database before seeding.
- Production preserves existing rows and only adds seed data after confirmation.
- The script wipes child tables before parent tables, including `share_links` and `snapshots`.

### 2. `wipeDatabase.ts`

Complete database reset for non-production environments.

Usage:
```bash
# Development
npm run db:wipe

# Staging
npm run db:wipe:staging
```

Safety behavior:
- Blocked when `NODE_ENV=production`
- Deletes in foreign-key-safe order

### 3. `wipeProductionProject.ts`

Safely deletes one production project and its related data.

Usage:
```bash
npm run db:wipe:project <project-id>
```

Safety behavior:
- Runs only when `NODE_ENV=production`
- Shows project statistics first
- Requires typing `DELETE` unless `SKIP_CONFIRMATION=true`

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
