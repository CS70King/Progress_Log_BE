# Progress Log Backend API Contract

Last updated: 2026-05-06

Base URL (local dev): `http://localhost:3000`

All responses use JSON.

## Conventions

### Authentication

Most endpoints require a JWT access token:

- Header: `Authorization: Bearer <token>`

Auth-required routes return `401` if missing/invalid, and `403` when authenticated but not allowed.

### Standard Response Shape

Success:

```json
{
  "status": "success",
  "message": "Human readable message",
  "data": {}
}
```

Error:

```json
{
  "status": "error",
  "message": "Human readable message",
  "data": null,
  "errors": [
    { "field": "field_name", "message": "reason" }
  ]
}
```

Notes:

- `errors` is present only for validation-style errors that include per-field details.
- Some errors use specific `code`s internally in logs; the client receives `status/message/data`.

### IDs and Dates

- IDs are UUID strings.
- `created_at`, `updated_at`, `reviewed_at`, etc. are ISO-8601 timestamps.
- `activity_date` is a date-only string: `YYYY-MM-DD`.

### Roles and Access

User roles:

- `worker`
- `reviewer`

Key policy:

- Workers create/edit projects, milestones, and evidence.
- Reviewers can view assigned projects/milestones and review submitted milestones.

### Milestone Status (Client-facing)

Workers may see:

- `draft`
- `submitted`
- `approved`
- `needs_revision`

Reviewers may see:

- `draft` is hidden in some responses (see endpoint notes).
- `submitted` is shown as `pending_review` (role-based mapping).

Project state:

- `active`
- `completed`
- `abandoned`

## Health

### GET `/health`

Basic liveness check.

Response: `data` includes service status.

### GET `/health/db`

Checks database connectivity.

## Auth

### POST `/auth/signup`

Create a user account.

Body:

```json
{
  "name": "Worker One",
  "phone": "+15555550101",
  "country": "Ghana",
  "company": "Build Co",
  "role": "worker",
  "pin": "1234"
}
```

Notes:

- `company` is optional.
- `pin` must be exactly 4 digits.

Response `data`:

```json
{
  "user": {
    "id": "uuid",
    "role": "worker",
    "name": "Worker One",
    "phone": "+15555550101",
    "country": "Ghana",
    "company": "Build Co",
    "created_at": "ISO"
  },
  "token": "jwt"
}
```

### POST `/auth/login`

Body:

```json
{
  "phone": "+15555550101",
  "pin": "1234"
}
```

Response `data`: same shape as signup (`user` + `token`).

### GET `/auth/me`

Auth required.

Response `data`: user profile (`presentUser` shape).

### GET `/me`

Auth required. Same as `/auth/me`.

## Projects

### POST `/projects`

Auth required. Worker-only.

Creates an `active` project.

Body:

```json
{
  "title": "Demo Project",
  "description": "Optional description",
  "project_type": "construction",
  "reviewer_phone": "+15555550102"
}
```

Or multiple reviewers:

```json
{
  "title": "Demo Project",
  "description": "Optional description",
  "project_type": "construction",
  "reviewer_phones": ["+15555550102", "+15555550103"]
}
```

Constraints:

- `project_type` must be one of: `generic | construction | service`
- Reviewer phone numbers must be unique.
- At most 3 reviewers at create time.
- Worker cannot add their own phone as a reviewer (explicit validation error).
- Reviewers must already exist (must be registered as `reviewer` users).
- Duplicate project prevention: cannot create the same project for the same worker + reviewers + title + type.

Response:

- Returns a project details payload (worker view).

### GET `/projects`

Auth required.

Returns projects grouped by project `state`:

```json
{
  "active": [/* projects */],
  "completed": [/* projects */],
  "abandoned": [/* projects */]
}
```

Each project item includes (no owner/reviewers objects):

- `id`, `title`, `description`, `project_type`, `state`, `created_at`, `updated_at`
- `milestonesInfo`: `{ total, breakdown }`

Role-based summary mapping (`milestonesInfo.breakdown`):

- Worker breakdown: `draft`, `submitted`, `approved`, `needs_revision`, `disapproved`
- Reviewer breakdown: `pending_review`, `approved`, `disapproved`

### GET `/projects/:projectId`

Auth required.

Access:

- Worker: must be project owner
- Reviewer: must be a member of the project

Response is role-based:

Worker response (`data`):

- `id`, `title`, `description`, `type`, `state`, `created_at`, `updated_at`, `reviewer_count`
- `reviewers`: array of reviewer objects with `id`, `name`, `phone`, `company`
- `milestones`: array (includes drafts)
- `snapshots`: array

Reviewer response (`data`):

- `id`, `title`, `description`, `type`, `state`, `created_at`, `updated_at`
- `worker`: object with `id`, `name`, `phone`, `company`
- `milestonesInfo` (reviewer-friendly breakdown)
- `milestones`: array (draft milestones removed; `submitted` appears as `pending_review`)
- No `snapshots`

Milestone items include:

- `id`, `title`, `description`, `activity_date`, `state`, timestamps
- `review` (decision + note + reviewer) when present
- `evidence[]` with `signed_url` fields (may be `null` if object missing)

### POST `/projects/:projectId/invite-reviewer`

Auth required. Worker-only (project owner).

Body:

```json
{
  "reviewer_phone": "+15555550102"
}
```

Constraints:

- Reviewer must exist and be role `reviewer`.
- Worker cannot invite their own phone.
- Max 3 reviewers per project.
- Prevents duplicate projects by updating a dedupe key.

Response: project list-item shape (no owner/reviewers objects) with `milestonesInfo`.

### POST `/projects/:projectId/complete`

Auth required. Worker-only (project owner).

Rules:

- Only `active` projects can be completed.

Response: project details payload (worker view).

### POST `/projects/:projectId/abandon`

Auth required. Worker-only (project owner).

Rules:

- Only `active` projects can be abandoned.

Response: project details payload (worker view).

### POST `/projects/:projectId/share`

Auth required. Worker-only (project owner).

Rules:

- Only `completed` projects can be shared.

Body:

```json
{ "resource": "project" }
```

Response `data`:

```json
{
  "token": "share_token",
  "url_path": "/share/<token>/dossier"
}
```

### GET `/projects/:projectId/dossier`

Auth required (owner or member).

Returns a "project dossier" report-style payload:

- `header` (project + parties)
- `milestones` (each includes evidence with signed `file_url`)
- `generated_at`

## Milestones

### POST `/projects/:projectId/milestones`

Auth required. Worker-only (project owner).

Body:

```json
{
  "title": "Milestone title",
  "description": "Milestone description",
  "activity_date": "2026-03-20",
  "tags": ["optional", "tags"]
}
```

Response `data`: milestone (`creator` object included).

### GET `/projects/:projectId/milestones`

Auth required (owner or member).

Returns an array of milestone objects:

- `status` is role-mapped: reviewers see `pending_review` instead of `submitted`.
- Each milestone includes `review` (if present) and `evidence` (metadata only; no signed URLs here unless returned by evidence upload).

### GET `/milestones/:milestoneId`

Auth required (owner or member).

Response `data`:

```json
{
  "milestone": { /* milestone */ },
  "evidence_items": [ /* evidence items */ ],
  "review": { /* milestone review or null */ }
}
```

Role-based mapping:

- Reviewers see `milestone.status: "pending_review"` for submitted milestones.

### PATCH `/milestones/:milestoneId`

Auth required. Worker-only (project owner + milestone creator).

Editable statuses:

- `draft`
- `needs_revision`

Body (at least 1 field required):

```json
{
  "title": "Optional",
  "description": "Optional",
  "activity_date": "YYYY-MM-DD",
  "tags": ["optional"]
}
```

### POST `/milestones/:milestoneId/submit`

Auth required. Worker-only (project owner).

Body: none.

Effect:

- Sets milestone status to `submitted`
- Sets `submitted_at`

### POST `/milestones/:milestoneId/review`

Auth required. Reviewer-only (must be a reviewer member on the project).

Only allowed when milestone status is `submitted`.

Body:

```json
{
  "decision": "approved",
  "note": "Optional. Required when decision is needs_revision."
}
```

Rules:

- If `decision` is `needs_revision`, `note` is required.

Effect:

- `approved` -> milestone status becomes `approved`
- `needs_revision` -> milestone status becomes `needs_revision`

Response includes:

- `milestone` (updated)
- `review` with a full `reviewer` object

## Evidence

### POST `/milestones/:milestoneId/evidence`

Auth required. Worker-only (project owner).

Content-Type: `multipart/form-data`

Fields:

- `evidence_type`: one of `photo | video | document | receipt | other`
- `files`: one or more files

Limits:

- Max 20 files per request
- Max 20 evidence items per milestone total (across all uploads)
- Evidence can be added/removed only while milestone is `draft` or `needs_revision`

Response `data` is grouped to avoid repetition:

```json
{
  "project_id": "uuid",
  "milestone_id": "uuid",
  "uploader": { "id": "uuid", "name": "...", "phone": "...", "country": "...", "company": "..." },
  "evidence_type": "photo",
  "items": [
    {
      "id": "uuid",
      "file_path": "projects/<projectId>/milestones/<milestoneId>/<evidenceId>-<filename>",
      "original_filename": "file.jpg",
      "content_type": "image/jpeg",
      "size_bytes": 123,
      "created_at": "ISO",
      "signed_url": "http://... (time-limited)",
      "signed_url_expires_at": "ISO"
    }
  ]
}
```

Notes:

- `file_path` is the stable storage key stored in the DB.
- `signed_url` is generated on demand and expires; it may be `null` if the underlying storage object is missing.

### DELETE `/evidence/:evidenceId`

Auth required. Worker-only (project owner).

Deletes:

- Storage object at `file_path`
- Evidence DB record

## Snapshots

Snapshots capture a frozen "immutable payload" of project + milestones at creation time.

### POST `/projects/:projectId/snapshots`

Auth required. Worker-only (project owner).

Body:

```json
{ "title": "Snapshot title" }
```

Effect:

- Selects all current milestones for the project (no date filtering)
- Stores milestone IDs and an immutable JSON payload in the snapshot

Response `data`: snapshot metadata (`presentSnapshot`).

Shape:

```json
{
  "id": "snapshot-uuid",
  "project_id": "project-uuid",
  "created_by": "user-uuid",
  "title": "Snapshot Title",
  "milestone_count": 5,
  "created_at": "2026-05-06T12:00:00.000Z"
}
```

### GET `/projects/:projectId/snapshots`

Auth required (owner or member).

Returns snapshot metadata list.

Response `data`: array of snapshot metadata objects (same shape as create response).

### POST `/snapshots/:snapshotId/share`

Auth required. Snapshot-owner only.

Returns:

```json
{
  "token": "share_token",
  "url_path": "/share/<token>/dossier"
}
```

### GET `/snapshots/:snapshotId/dossier`

Auth required (owner or member).

Returns a snapshot dossier payload based on the snapshot's stored immutable payload.

Response `data` includes:

- `snapshot`: snapshot metadata
- `project`: project details  
- `parties`: 
  - `owner`: worker object with `id`, `name`, `phone`, `company`
  - `reviewers`: array of reviewer objects with `id`, `name`, `phone`, `company`
- `milestones`: array of milestone data with evidence
- `generated_at`: timestamp

Shape:

```json
{
  "header": {
    "type": "snapshot",
    "snapshot": {
      "id": "snapshot-uuid",
      "title": "Snapshot Title",
      "from_date": null,
      "to_date": null,
      "created_at": "2026-05-06T12:00:00.000Z"
    },
    "project": {
      "id": "project-uuid",
      "title": "Project Title",
      "project_type": "generic|construction|service"
    },
    "parties": {
      "owner": {
        "id": "worker-uuid",
        "name": "Worker Name",
        "phone": "+15555550100",
        "company": "Worker Company"
      },
      "reviewers": [
        {
          "id": "reviewer-uuid",
          "name": "Reviewer Name",
          "phone": "+15555550200",
          "company": "Review Company"
        }
      ]
    }
  },
  "milestones": [
    {
      "id": "milestone-uuid",
      "title": "Milestone Title",
      "description": "Milestone description",
      "activity_date": "2026-05-05",
      "status": "approved",
      "submitted_at": "2026-05-05T10:00:00.000Z",
      "review": {
        "decision": "approved",
        "note": "Looks good",
        "reviewer": {
          "id": "reviewer-uuid",
          "name": "Reviewer Name"
        },
        "reviewed_at": "2026-05-05T11:00:00.000Z"
      },
      "evidence": [
        {
          "id": "evidence-uuid",
          "evidence_type": "photo",
          "original_filename": "photo.jpg",
          "file_path": "projects/uuid/milestones/uuid/file.jpg",
          "content_type": "image/jpeg",
          "size_bytes": 1024000,
          "file_url": "https://supabase-url/signed-url",
          "file_expires_at": "2026-05-06T12:00:00.000Z",
          "created_at": "2026-05-05T09:00:00.000Z"
        }
      ],
      "created_at": "2026-05-05T08:00:00.000Z",
      "updated_at": "2026-05-05T10:00:00.000Z"
    }
  ],
  "generated_at": "2026-05-06T12:00:00.000Z"
}
```

## Share (Public)

### GET `/share/:token/dossier`

No auth.

Resolves the share token to either a project dossier or a snapshot dossier:

- If token points to a project: returns project dossier
- If token points to a snapshot: returns snapshot dossier

Token validity rules:

- 404 if token not found
- 410 if revoked or expired

