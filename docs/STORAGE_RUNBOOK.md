# Storage Runbook

This project stores evidence files in a private Supabase Storage bucket.

## Required Production Controls

1. Private bucket only
2. Service-role-only server access
3. Bucket verification before deploy
4. Restore plan documented and tested

## Provisioning

Use the production environment file and run:

```bash
npm run storage:setup:production
npm run storage:test:production
```

Expected result:
- bucket exists
- bucket is private
- MIME allowlist is configured
- file upload, signed URL generation, and delete all succeed

## Deployment Gate

Before every production release:

1. Confirm `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_STORAGE_BUCKET`
2. Run `npm run storage:test:production`
3. Confirm uploads work from the app
4. Confirm signed dossier URLs work

## Backup / Restore Placeholder

This repo does not automate provider-level bucket backups.
Fill in the following before or immediately after MVP launch:

- Storage provider account owner: `<fill in>`
- Bucket region: `<fill in>`
- Versioning enabled: `<yes/no>`
- Object retention policy: `<fill in>`
- Backup/export cadence: `<fill in>`
- Restore owner: `<fill in>`
- Restore drill date: `<fill in>`
- Restore drill notes: `<fill in>`

## Recommended MVP Position

If bucket versioning is available in your Supabase plan, enable it.
If not, document the accepted risk and schedule a restore/export follow-up.
