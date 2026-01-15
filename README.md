================================================================================
                    PROGRESS LOG - BACKEND API SPECIFICATION
================================================================================

This document defines all backend API endpoints required to support the
Progress Log frontend application. Each endpoint includes request/response
schemas, authentication requirements, and error handling.

BASE URL: /api/v1

AUTHENTICATION:
- All protected endpoints require a Bearer token in the Authorization header
- Format: Authorization: Bearer {session_token}
- Session tokens expire after 30 days


================================================================================
1. AUTHENTICATION ENDPOINTS
================================================================================

1.1 User Signup
---------------
POST /auth/signup

Description:
Creates a new user account with role-based access (worker or reviewer).

Request Body:
{
  "name": "string",           // Full name
  "phone": "string",          // Phone number with country code (e.g., "+233240000000")
  "country": "ghana" | "usa", // Country for phone context
  "role": "worker" | "reviewer",
  "company": "string",        // Optional company name
  "pin": "string"             // 4-digit PIN (will be hashed)
}

Response (201 Created):
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "role": "worker" | "reviewer",
      "name": "string",
      "phone": "string",
      "company": "string" | null,
      "createdAt": "ISO8601 timestamp"
    },
    "session": {
      "token": "string",
      "userId": "uuid",
      "expiresAt": "ISO8601 timestamp"
    }
  }
}

Errors:
- 400: Invalid request (missing required fields, invalid PIN format)
- 409: Phone number already registered


1.2 User Login
--------------
POST /auth/login

Description:
Authenticates a user with phone number and PIN, returns session token.

Request Body:
{
  "phone": "string",  // Phone number with country code
  "pin": "string"     // 4-digit PIN
}

Response (200 OK):
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "role": "worker" | "reviewer",
      "name": "string",
      "phone": "string",
      "company": "string" | null,
      "createdAt": "ISO8601 timestamp"
    },
    "session": {
      "token": "string",
      "userId": "uuid",
      "expiresAt": "ISO8601 timestamp"
    }
  }
}

Errors:
- 400: Invalid request
- 401: Invalid phone number or PIN


1.3 Session Validation
-----------------------
GET /auth/session

Description:
Validates current session token and returns user data.

Headers:
Authorization: Bearer {token}

Response (200 OK):
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "role": "worker" | "reviewer",
      "name": "string",
      "phone": "string",
      "company": "string" | null,
      "createdAt": "ISO8601 timestamp"
    },
    "session": {
      "userId": "uuid",
      "expiresAt": "ISO8601 timestamp"
    }
  }
}

Errors:
- 401: Invalid or expired token


1.4 User Logout
---------------
POST /auth/logout

Description:
Invalidates the current session token.

Headers:
Authorization: Bearer {token}

Response (200 OK):
{
  "success": true,
  "message": "Logged out successfully"
}

Errors:
- 401: Invalid or expired token


================================================================================
2. PROJECT ENDPOINTS
================================================================================

2.1 List User's Projects
-------------------------
GET /projects

Description:
Returns all projects owned by or shared with the authenticated user.

Headers:
Authorization: Bearer {token}

Query Parameters:
- status: "active" | "completed" | "abandoned" (optional, filter by status)
- role: "owner" | "reviewer" (optional, filter by user role in project)

Response (200 OK):
{
  "success": true,
  "data": {
    "projects": [
      {
        "id": "uuid",
        "ownerId": "uuid",
        "title": "string",
        "description": "string",
        "projectType": "generic" | "construction" | "service",
        "status": "active" | "completed" | "abandoned",
        "createdAt": "ISO8601 timestamp",
        "updatedAt": "ISO8601 timestamp",
        "completedAt": "ISO8601 timestamp" | null,
        "invitedReviewerIds": ["uuid"],
        "owner": {
          "id": "uuid",
          "name": "string",
          "phone": "string",
          "company": "string" | null
        },
        "reviewers": [
          {
            "id": "uuid",
            "name": "string",
            "phone": "string",
            "company": "string" | null
          }
        ],
        "milestoneStats": {
          "total": "number",
          "draft": "number",
          "submitted": "number",
          "approved": "number",
          "disapproved": "number"
        }
      }
    ]
  }
}

Errors:
- 401: Invalid or expired token


2.2 Get Project by ID
---------------------
GET /projects/:projectId

Description:
Returns detailed information about a specific project.

Headers:
Authorization: Bearer {token}

Response (200 OK):
{
  "success": true,
  "data": {
    "project": {
      "id": "uuid",
      "ownerId": "uuid",
      "title": "string",
      "description": "string",
      "projectType": "generic" | "construction" | "service",
      "status": "active" | "completed" | "abandoned",
      "createdAt": "ISO8601 timestamp",
      "updatedAt": "ISO8601 timestamp",
      "completedAt": "ISO8601 timestamp" | null,
      "invitedReviewerIds": ["uuid"],
      "shareToken": "string" | null,
      "owner": {
        "id": "uuid",
        "name": "string",
        "phone": "string",
        "company": "string" | null
      },
      "reviewers": [
        {
          "id": "uuid",
          "name": "string",
          "phone": "string",
          "company": "string" | null
        }
      ]
    },
    "milestones": [
      {
        "id": "uuid",
        "projectId": "uuid",
        "createdBy": "uuid",
        "title": "string",
        "description": "string",
        "activityDate": "ISO8601 timestamp",
        "status": "draft" | "submitted" | "approved" | "disapproved",
        "evidenceIds": ["uuid"],
        "createdAt": "ISO8601 timestamp",
        "updatedAt": "ISO8601 timestamp",
        "submittedAt": "ISO8601 timestamp" | null,
        "reviewedBy": "uuid" | null,
        "reviewedAt": "ISO8601 timestamp" | null,
        "reviewerNote": "string" | null,
        "evidenceCount": "number"
      }
    ]
  }
}

Errors:
- 401: Invalid or expired token
- 403: User not authorized to view project
- 404: Project not found


2.3 Create Project
------------------
POST /projects

Description:
Creates a new project. Only workers can create projects.

Headers:
Authorization: Bearer {token}

Request Body:
{
  "title": "string",
  "description": "string",
  "projectType": "generic" | "construction" | "service",
  "invitedReviewerIds": ["uuid"]  // Optional, array of reviewer user IDs
}

Response (201 Created):
{
  "success": true,
  "data": {
    "project": {
      "id": "uuid",
      "ownerId": "uuid",
      "title": "string",
      "description": "string",
      "projectType": "generic" | "construction" | "service",
      "status": "active",
      "createdAt": "ISO8601 timestamp",
      "updatedAt": "ISO8601 timestamp",
      "completedAt": null,
      "invitedReviewerIds": ["uuid"],
      "shareToken": null
    }
  }
}

Errors:
- 400: Invalid request data
- 401: Invalid or expired token
- 403: User is not a worker


2.4 Update Project
------------------
PUT /projects/:projectId

Description:
Updates project details. Only project owner can update.

Headers:
Authorization: Bearer {token}

Request Body:
{
  "title": "string",              // Optional
  "description": "string",        // Optional
  "projectType": "generic" | "construction" | "service",  // Optional
  "invitedReviewerIds": ["uuid"]  // Optional
}

Response (200 OK):
{
  "success": true,
  "data": {
    "project": {
      "id": "uuid",
      "ownerId": "uuid",
      "title": "string",
      "description": "string",
      "projectType": "generic" | "construction" | "service",
      "status": "active" | "completed" | "abandoned",
      "createdAt": "ISO8601 timestamp",
      "updatedAt": "ISO8601 timestamp",
      "completedAt": "ISO8601 timestamp" | null,
      "invitedReviewerIds": ["uuid"],
      "shareToken": "string" | null
    }
  }
}

Errors:
- 400: Invalid request data
- 401: Invalid or expired token
- 403: User is not the project owner
- 404: Project not found


2.5 Delete Project
------------------
DELETE /projects/:projectId

Description:
Deletes a project and all associated milestones, evidence, and snapshots.
Only project owner can delete.

Headers:
Authorization: Bearer {token}

Response (200 OK):
{
  "success": true,
  "message": "Project deleted successfully"
}

Errors:
- 401: Invalid or expired token
- 403: User is not the project owner
- 404: Project not found


2.6 Complete Project
--------------------
POST /projects/:projectId/complete

Description:
Marks a project as completed. Only project owner can complete.

Headers:
Authorization: Bearer {token}

Response (200 OK):
{
  "success": true,
  "data": {
    "project": {
      "id": "uuid",
      "status": "completed",
      "completedAt": "ISO8601 timestamp",
      "updatedAt": "ISO8601 timestamp"
    }
  }
}

Errors:
- 401: Invalid or expired token
- 403: User is not the project owner
- 404: Project not found


2.7 Abandon Project
-------------------
POST /projects/:projectId/abandon

Description:
Marks a project as abandoned. Only project owner can abandon.

Headers:
Authorization: Bearer {token}

Response (200 OK):
{
  "success": true,
  "data": {
    "project": {
      "id": "uuid",
      "status": "abandoned",
      "updatedAt": "ISO8601 timestamp"
    }
  }
}

Errors:
- 401: Invalid or expired token
- 403: User is not the project owner
- 404: Project not found


2.8 Reopen Project
------------------
POST /projects/:projectId/reopen

Description:
Reopens a completed or abandoned project. Only project owner can reopen.

Headers:
Authorization: Bearer {token}

Response (200 OK):
{
  "success": true,
  "data": {
    "project": {
      "id": "uuid",
      "status": "active",
      "completedAt": null,
      "updatedAt": "ISO8601 timestamp"
    }
  }
}

Errors:
- 401: Invalid or expired token
- 403: User is not the project owner
- 404: Project not found


2.9 Generate Project Share Token
---------------------------------
POST /projects/:projectId/share

Description:
Generates or regenerates a share token for public project access.
Only project owner can generate share token.

Headers:
Authorization: Bearer {token}

Response (200 OK):
{
  "success": true,
  "data": {
    "shareToken": "string",
    "shareUrl": "string"  // Full URL: https://domain.com/share/project/{token}
  }
}

Errors:
- 401: Invalid or expired token
- 403: User is not the project owner
- 404: Project not found


2.10 Get Project by Share Token (Public)
-----------------------------------------
GET /public/projects/:shareToken

Description:
Returns project details for public viewing using share token.
No authentication required.

Response (200 OK):
{
  "success": true,
  "data": {
    "project": {
      "id": "uuid",
      "title": "string",
      "description": "string",
      "projectType": "generic" | "construction" | "service",
      "status": "active" | "completed" | "abandoned",
      "createdAt": "ISO8601 timestamp",
      "updatedAt": "ISO8601 timestamp",
      "owner": {
        "name": "string",
        "company": "string" | null
      },
      "reviewers": [
        {
          "name": "string",
          "company": "string" | null
        }
      ]
    },
    "milestones": [
      {
        "id": "uuid",
        "title": "string",
        "description": "string",
        "activityDate": "ISO8601 timestamp",
        "status": "draft" | "submitted" | "approved" | "disapproved",
        "createdAt": "ISO8601 timestamp",
        "reviewedAt": "ISO8601 timestamp" | null,
        "reviewerNote": "string" | null,
        "evidenceCount": "number"
      }
    ],
    "evidence": [
      {
        "id": "uuid",
        "milestoneId": "uuid",
        "type": "photo" | "video" | "document" | "receipt" | "other",
        "filename": "string",
        "mimeType": "string",
        "sizeBytes": "number",
        "downloadUrl": "string",
        "thumbnailUrl": "string" | null,
        "note": "string" | null,
        "createdAt": "ISO8601 timestamp"
      }
    ]
  }
}

Errors:
- 404: Invalid share token or project not found


================================================================================
3. MILESTONE ENDPOINTS
================================================================================

3.1 List Milestones for Project
--------------------------------
GET /projects/:projectId/milestones

Description:
Returns all milestones for a specific project.

Headers:
Authorization: Bearer {token}

Query Parameters:
- status: "draft" | "submitted" | "approved" | "disapproved" (optional filter)

Response (200 OK):
{
  "success": true,
  "data": {
    "milestones": [
      {
        "id": "uuid",
        "projectId": "uuid",
        "createdBy": "uuid",
        "title": "string",
        "description": "string",
        "activityDate": "ISO8601 timestamp",
        "status": "draft" | "submitted" | "approved" | "disapproved",
        "evidenceIds": ["uuid"],
        "createdAt": "ISO8601 timestamp",
        "updatedAt": "ISO8601 timestamp",
        "submittedAt": "ISO8601 timestamp" | null,
        "reviewedBy": "uuid" | null,
        "reviewedAt": "ISO8601 timestamp" | null,
        "reviewerNote": "string" | null,
        "evidenceCount": "number",
        "creator": {
          "id": "uuid",
          "name": "string"
        },
        "reviewer": {
          "id": "uuid",
          "name": "string"
        } | null
      }
    ]
  }
}

Errors:
- 401: Invalid or expired token
- 403: User not authorized to view project
- 404: Project not found


3.2 Get Milestone by ID
-----------------------
GET /milestones/:milestoneId

Description:
Returns detailed information about a specific milestone.

Headers:
Authorization: Bearer {token}

Response (200 OK):
{
  "success": true,
  "data": {
    "milestone": {
      "id": "uuid",
      "projectId": "uuid",
      "createdBy": "uuid",
      "title": "string",
      "description": "string",
      "activityDate": "ISO8601 timestamp",
      "status": "draft" | "submitted" | "approved" | "disapproved",
      "evidenceIds": ["uuid"],
      "createdAt": "ISO8601 timestamp",
      "updatedAt": "ISO8601 timestamp",
      "submittedAt": "ISO8601 timestamp" | null,
      "reviewedBy": "uuid" | null,
      "reviewedAt": "ISO8601 timestamp" | null,
      "reviewerNote": "string" | null,
      "creator": {
        "id": "uuid",
        "name": "string",
        "phone": "string",
        "company": "string" | null
      },
      "reviewer": {
        "id": "uuid",
        "name": "string",
        "phone": "string",
        "company": "string" | null
      } | null
    },
    "evidence": [
      {
        "id": "uuid",
        "projectId": "uuid",
        "milestoneId": "uuid",
        "type": "photo" | "video" | "document" | "receipt" | "other",
        "filename": "string",
        "mimeType": "string",
        "sizeBytes": "number",
        "downloadUrl": "string",
        "thumbnailUrl": "string" | null,
        "note": "string" | null,
        "createdAt": "ISO8601 timestamp"
      }
    ]
  }
}

Errors:
- 401: Invalid or expired token
- 403: User not authorized to view milestone
- 404: Milestone not found


3.3 Create Milestone
--------------------
POST /projects/:projectId/milestones

Description:
Creates a new milestone in draft status. Only project owner can create.

Headers:
Authorization: Bearer {token}

Request Body:
{
  "title": "string",
  "description": "string",
  "activityDate": "ISO8601 timestamp"  // Date when activity occurred
}

Response (201 Created):
{
  "success": true,
  "data": {
    "milestone": {
      "id": "uuid",
      "projectId": "uuid",
      "createdBy": "uuid",
      "title": "string",
      "description": "string",
      "activityDate": "ISO8601 timestamp",
      "status": "draft",
      "evidenceIds": [],
      "createdAt": "ISO8601 timestamp",
      "updatedAt": "ISO8601 timestamp",
      "submittedAt": null,
      "reviewedBy": null,
      "reviewedAt": null,
      "reviewerNote": null
    }
  }
}

Errors:
- 400: Invalid request data
- 401: Invalid or expired token
- 403: User is not the project owner
- 404: Project not found


3.4 Update Milestone
--------------------
PUT /milestones/:milestoneId

Description:
Updates milestone details. Only milestone creator can update.
Can only update milestones in "draft" status.

Headers:
Authorization: Bearer {token}

Request Body:
{
  "title": "string",              // Optional
  "description": "string",        // Optional
  "activityDate": "ISO8601 timestamp"  // Optional
}

Response (200 OK):
{
  "success": true,
  "data": {
    "milestone": {
      "id": "uuid",
      "projectId": "uuid",
      "createdBy": "uuid",
      "title": "string",
      "description": "string",
      "activityDate": "ISO8601 timestamp",
      "status": "draft",
      "evidenceIds": ["uuid"],
      "createdAt": "ISO8601 timestamp",
      "updatedAt": "ISO8601 timestamp",
      "submittedAt": null,
      "reviewedBy": null,
      "reviewedAt": null,
      "reviewerNote": null
    }
  }
}

Errors:
- 400: Invalid request data or milestone not in draft status
- 401: Invalid or expired token
- 403: User is not the milestone creator
- 404: Milestone not found


3.5 Delete Milestone
--------------------
DELETE /milestones/:milestoneId

Description:
Deletes a milestone and all associated evidence.
Only milestone creator can delete. Can only delete milestones in "draft" status.

Headers:
Authorization: Bearer {token}

Response (200 OK):
{
  "success": true,
  "message": "Milestone deleted successfully"
}

Errors:
- 400: Milestone not in draft status
- 401: Invalid or expired token
- 403: User is not the milestone creator
- 404: Milestone not found


3.6 Submit Milestone for Review
--------------------------------
POST /milestones/:milestoneId/submit

Description:
Submits a milestone for review, changing status from draft to submitted.
Only milestone creator can submit.

Headers:
Authorization: Bearer {token}

Response (200 OK):
{
  "success": true,
  "data": {
    "milestone": {
      "id": "uuid",
      "status": "submitted",
      "submittedAt": "ISO8601 timestamp",
      "updatedAt": "ISO8601 timestamp"
    }
  }
}

Errors:
- 400: Milestone not in draft status
- 401: Invalid or expired token
- 403: User is not the milestone creator
- 404: Milestone not found


3.7 Approve Milestone
---------------------
POST /milestones/:milestoneId/approve

Description:
Approves a submitted milestone. Only invited reviewers can approve.

Headers:
Authorization: Bearer {token}

Request Body:
{
  "reviewerNote": "string"  // Optional note from reviewer
}

Response (200 OK):
{
  "success": true,
  "data": {
    "milestone": {
      "id": "uuid",
      "status": "approved",
      "reviewedBy": "uuid",
      "reviewedAt": "ISO8601 timestamp",
      "reviewerNote": "string" | null,
      "updatedAt": "ISO8601 timestamp"
    }
  }
}

Errors:
- 400: Milestone not in submitted status
- 401: Invalid or expired token
- 403: User is not an invited reviewer for the project
- 404: Milestone not found


3.8 Disapprove Milestone
------------------------
POST /milestones/:milestoneId/disapprove

Description:
Disapproves a submitted milestone. Only invited reviewers can disapprove.
Reviewer note is required explaining reason for disapproval.

Headers:
Authorization: Bearer {token}

Request Body:
{
  "reviewerNote": "string"  // Required, min 5 characters
}

Response (200 OK):
{
  "success": true,
  "data": {
    "milestone": {
      "id": "uuid",
      "status": "disapproved",
      "reviewedBy": "uuid",
      "reviewedAt": "ISO8601 timestamp",
      "reviewerNote": "string",
      "updatedAt": "ISO8601 timestamp"
    }
  }
}

Errors:
- 400: Milestone not in submitted status or missing/invalid reviewer note
- 401: Invalid or expired token
- 403: User is not an invited reviewer for the project
- 404: Milestone not found


================================================================================
4. EVIDENCE/ATTACHMENT ENDPOINTS
================================================================================

4.1 Upload Evidence
-------------------
POST /milestones/:milestoneId/evidence

Description:
Uploads evidence (photo, document, etc.) for a milestone.
Only milestone creator can upload evidence.
Supports multipart/form-data file upload.

Headers:
Authorization: Bearer {token}
Content-Type: multipart/form-data

Request Body (form-data):
- file: File (required, max 10MB)
- type: "photo" | "video" | "document" | "receipt" | "other" (optional, auto-detected)
- note: "string" (optional description)

Response (201 Created):
{
  "success": true,
  "data": {
    "evidence": {
      "id": "uuid",
      "projectId": "uuid",
      "milestoneId": "uuid",
      "type": "photo" | "video" | "document" | "receipt" | "other",
      "filename": "string",
      "mimeType": "string",
      "sizeBytes": "number",
      "downloadUrl": "string",
      "thumbnailUrl": "string" | null,
      "note": "string" | null,
      "createdAt": "ISO8601 timestamp"
    }
  }
}

Errors:
- 400: Invalid file type or size exceeds limit
- 401: Invalid or expired token
- 403: User is not the milestone creator
- 404: Milestone not found
- 413: File too large


4.2 Get Evidence by ID
----------------------
GET /evidence/:evidenceId

Description:
Returns metadata for a specific evidence item.

Headers:
Authorization: Bearer {token}

Response (200 OK):
{
  "success": true,
  "data": {
    "evidence": {
      "id": "uuid",
      "projectId": "uuid",
      "milestoneId": "uuid",
      "type": "photo" | "video" | "document" | "receipt" | "other",
      "filename": "string",
      "mimeType": "string",
      "sizeBytes": "number",
      "downloadUrl": "string",
      "thumbnailUrl": "string" | null,
      "note": "string" | null,
      "createdAt": "ISO8601 timestamp"
    }
  }
}

Errors:
- 401: Invalid or expired token
- 403: User not authorized to view evidence
- 404: Evidence not found


4.3 Download Evidence File
---------------------------
GET /evidence/:evidenceId/download

Description:
Downloads the actual file for an evidence item.
Returns the file with appropriate Content-Type and Content-Disposition headers.

Headers:
Authorization: Bearer {token}

Response (200 OK):
- Content-Type: {mimeType}
- Content-Disposition: attachment; filename="{filename}"
- Body: Binary file data

Errors:
- 401: Invalid or expired token
- 403: User not authorized to download evidence
- 404: Evidence not found


4.4 Get Evidence Thumbnail
---------------------------
GET /evidence/:evidenceId/thumbnail

Description:
Returns a thumbnail image for photo/video evidence.
Only available for image and video evidence types.

Headers:
Authorization: Bearer {token}

Query Parameters:
- size: "small" | "medium" | "large" (optional, default: medium)

Response (200 OK):
- Content-Type: image/jpeg
- Body: Binary image data

Errors:
- 400: Thumbnail not available for this evidence type
- 401: Invalid or expired token
- 403: User not authorized to view evidence
- 404: Evidence not found


4.5 Delete Evidence
-------------------
DELETE /evidence/:evidenceId

Description:
Deletes an evidence item and its associated file.
Only milestone creator can delete evidence.
Can only delete if milestone is in "draft" status.

Headers:
Authorization: Bearer {token}

Response (200 OK):
{
  "success": true,
  "message": "Evidence deleted successfully"
}

Errors:
- 400: Milestone not in draft status
- 401: Invalid or expired token
- 403: User is not the milestone creator
- 404: Evidence not found


4.6 List Evidence for Milestone
--------------------------------
GET /milestones/:milestoneId/evidence

Description:
Returns all evidence items for a specific milestone.

Headers:
Authorization: Bearer {token}

Response (200 OK):
{
  "success": true,
  "data": {
    "evidence": [
      {
        "id": "uuid",
        "projectId": "uuid",
        "milestoneId": "uuid",
        "type": "photo" | "video" | "document" | "receipt" | "other",
        "filename": "string",
        "mimeType": "string",
        "sizeBytes": "number",
        "downloadUrl": "string",
        "thumbnailUrl": "string" | null,
        "note": "string" | null,
        "createdAt": "ISO8601 timestamp"
      }
    ]
  }
}

Errors:
- 401: Invalid or expired token
- 403: User not authorized to view milestone
- 404: Milestone not found


================================================================================
5. SNAPSHOT ENDPOINTS
================================================================================

5.1 List Snapshots for Project
-------------------------------
GET /projects/:projectId/snapshots

Description:
Returns all snapshots created for a specific project.

Headers:
Authorization: Bearer {token}

Response (200 OK):
{
  "success": true,
  "data": {
    "snapshots": [
      {
        "id": "uuid",
        "projectId": "uuid",
        "createdBy": "uuid",
        "createdAt": "ISO8601 timestamp",
        "title": "string",
        "milestoneIdsIncluded": ["uuid"],
        "shareToken": "string" | null,
        "milestoneCount": "number"
      }
    ]
  }
}

Errors:
- 401: Invalid or expired token
- 403: User not authorized to view project
- 404: Project not found


5.2 Get Snapshot by ID
----------------------
GET /snapshots/:snapshotId

Description:
Returns detailed snapshot data including immutable project state.

Headers:
Authorization: Bearer {token}

Response (200 OK):
{
  "success": true,
  "data": {
    "snapshot": {
      "id": "uuid",
      "projectId": "uuid",
      "createdBy": "uuid",
      "createdAt": "ISO8601 timestamp",
      "title": "string",
      "milestoneIdsIncluded": ["uuid"],
      "shareToken": "string" | null,
      "immutablePayload": {
        "project": {
          "id": "uuid",
          "title": "string",
          "description": "string",
          "projectType": "generic" | "construction" | "service",
          "status": "active" | "completed" | "abandoned",
          "createdAt": "ISO8601 timestamp",
          "owner": {
            "id": "uuid",
            "name": "string",
            "phone": "string",
            "company": "string" | null
          },
          "reviewers": [
            {
              "id": "uuid",
              "name": "string",
              "phone": "string",
              "company": "string" | null
            }
          ]
        },
        "milestones": [
          {
            "id": "uuid",
            "title": "string",
            "description": "string",
            "activityDate": "ISO8601 timestamp",
            "status": "draft" | "submitted" | "approved" | "disapproved",
            "createdAt": "ISO8601 timestamp",
            "reviewedAt": "ISO8601 timestamp" | null,
            "reviewerNote": "string" | null,
            "creator": {
              "id": "uuid",
              "name": "string"
            },
            "reviewer": {
              "id": "uuid",
              "name": "string"
            } | null
          }
        ],
        "evidence": [
          {
            "id": "uuid",
            "milestoneId": "uuid",
            "type": "photo" | "video" | "document" | "receipt" | "other",
            "filename": "string",
            "mimeType": "string",
            "sizeBytes": "number",
            "downloadUrl": "string",
            "thumbnailUrl": "string" | null,
            "note": "string" | null,
            "createdAt": "ISO8601 timestamp"
          }
        ]
      }
    }
  }
}

Errors:
- 401: Invalid or expired token
- 403: User not authorized to view snapshot
- 404: Snapshot not found


5.3 Create Snapshot
-------------------
POST /projects/:projectId/snapshots

Description:
Creates an immutable snapshot of project state at current point in time.
Only project owner can create snapshots.

Headers:
Authorization: Bearer {token}

Request Body:
{
  "title": "string",
  "milestoneIds": ["uuid"]  // IDs of milestones to include in snapshot
}

Response (201 Created):
{
  "success": true,
  "data": {
    "snapshot": {
      "id": "uuid",
      "projectId": "uuid",
      "createdBy": "uuid",
      "createdAt": "ISO8601 timestamp",
      "title": "string",
      "milestoneIdsIncluded": ["uuid"],
      "shareToken": "string",
      "milestoneCount": "number"
    }
  }
}

Errors:
- 400: Invalid request data or milestone IDs not found
- 401: Invalid or expired token
- 403: User is not the project owner
- 404: Project not found


5.4 Delete Snapshot
-------------------
DELETE /snapshots/:snapshotId

Description:
Deletes a snapshot. Only snapshot creator can delete.

Headers:
Authorization: Bearer {token}

Response (200 OK):
{
  "success": true,
  "message": "Snapshot deleted successfully"
}

Errors:
- 401: Invalid or expired token
- 403: User is not the snapshot creator
- 404: Snapshot not found


5.5 Generate Snapshot Share Token
----------------------------------
POST /snapshots/:snapshotId/share

Description:
Generates or regenerates a share token for public snapshot access.
Only snapshot creator can generate share token.

Headers:
Authorization: Bearer {token}

Response (200 OK):
{
  "success": true,
  "data": {
    "shareToken": "string",
    "shareUrl": "string"  // Full URL: https://domain.com/share/snapshot/{token}
  }
}

Errors:
- 401: Invalid or expired token
- 403: User is not the snapshot creator
- 404: Snapshot not found


5.6 Get Snapshot by Share Token (Public)
-----------------------------------------
GET /public/snapshots/:shareToken

Description:
Returns snapshot data for public viewing using share token.
No authentication required.

Response (200 OK):
{
  "success": true,
  "data": {
    "snapshot": {
      "id": "uuid",
      "createdAt": "ISO8601 timestamp",
      "title": "string",
      "immutablePayload": {
        "project": {
          "id": "uuid",
          "title": "string",
          "description": "string",
          "projectType": "generic" | "construction" | "service",
          "createdAt": "ISO8601 timestamp",
          "owner": {
            "name": "string",
            "company": "string" | null
          },
          "reviewers": [
            {
              "name": "string",
              "company": "string" | null
            }
          ]
        },
        "milestones": [
          {
            "id": "uuid",
            "title": "string",
            "description": "string",
            "activityDate": "ISO8601 timestamp",
            "status": "draft" | "submitted" | "approved" | "disapproved",
            "createdAt": "ISO8601 timestamp",
            "reviewedAt": "ISO8601 timestamp" | null,
            "reviewerNote": "string" | null
          }
        ],
        "evidence": [
          {
            "id": "uuid",
            "milestoneId": "uuid",
            "type": "photo" | "video" | "document" | "receipt" | "other",
            "filename": "string",
            "mimeType": "string",
            "sizeBytes": "number",
            "downloadUrl": "string",
            "thumbnailUrl": "string" | null,
            "note": "string" | null,
            "createdAt": "ISO8601 timestamp"
          }
        ]
      }
    }
  }
}

Errors:
- 404: Invalid share token or snapshot not found


================================================================================
6. USER/REVIEWER ENDPOINTS
================================================================================

6.1 Search Users
----------------
GET /users/search

Description:
Search for users by phone number or name. Used for inviting reviewers.

Headers:
Authorization: Bearer {token}

Query Parameters:
- q: "string" (search query, min 3 characters)
- role: "reviewer" (optional, filter by role)

Response (200 OK):
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "uuid",
        "name": "string",
        "phone": "string",
        "company": "string" | null,
        "role": "worker" | "reviewer"
      }
    ]
  }
}

Errors:
- 400: Search query too short
- 401: Invalid or expired token


6.2 Get User Profile
--------------------
GET /users/:userId

Description:
Returns public profile information for a user.

Headers:
Authorization: Bearer {token}

Response (200 OK):
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "name": "string",
      "phone": "string",
      "company": "string" | null,
      "role": "worker" | "reviewer",
      "createdAt": "ISO8601 timestamp"
    }
  }
}

Errors:
- 401: Invalid or expired token
- 404: User not found


6.3 Get Current User Profile
-----------------------------
GET /users/me

Description:
Returns full profile information for authenticated user.

Headers:
Authorization: Bearer {token}

Response (200 OK):
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "name": "string",
      "phone": "string",
      "company": "string" | null,
      "role": "worker" | "reviewer",
      "createdAt": "ISO8601 timestamp"
    }
  }
}

Errors:
- 401: Invalid or expired token


6.4 Update Current User Profile
--------------------------------
PUT /users/me

Description:
Updates authenticated user's profile information.

Headers:
Authorization: Bearer {token}

Request Body:
{
  "name": "string",     // Optional
  "company": "string"   // Optional
}

Response (200 OK):
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "name": "string",
      "phone": "string",
      "company": "string" | null,
      "role": "worker" | "reviewer",
      "createdAt": "ISO8601 timestamp"
    }
  }
}

Errors:
- 400: Invalid request data
- 401: Invalid or expired token


================================================================================
7. EXPORT ENDPOINTS
================================================================================

7.1 Export Project
------------------
GET /projects/:projectId/export

Description:
Generates exportable data for a project including all milestones and evidence.
Returns HTML that can be printed or converted to PDF.

Headers:
Authorization: Bearer {token}

Query Parameters:
- format: "html" | "json" (default: html)

Response (200 OK):
For HTML format:
- Content-Type: text/html
- Body: Formatted HTML document ready for printing

For JSON format:
{
  "success": true,
  "data": {
    "project": {
      "id": "uuid",
      "title": "string",
      "description": "string",
      "projectType": "generic" | "construction" | "service",
      "status": "active" | "completed" | "abandoned",
      "createdAt": "ISO8601 timestamp",
      "owner": {
        "name": "string",
        "phone": "string",
        "company": "string" | null
      },
      "reviewers": [
        {
          "name": "string",
          "phone": "string",
          "company": "string" | null
        }
      ]
    },
    "milestones": [...],
    "evidence": [...]
  }
}

Errors:
- 401: Invalid or expired token
- 403: User not authorized to export project
- 404: Project not found


7.2 Export Snapshot
-------------------
GET /snapshots/:snapshotId/export

Description:
Generates exportable data for a snapshot.
Returns HTML that can be printed or converted to PDF.

Headers:
Authorization: Bearer {token}

Query Parameters:
- format: "html" | "json" (default: html)

Response (200 OK):
Similar to project export, but uses immutable snapshot data.

Errors:
- 401: Invalid or expired token
- 403: User not authorized to export snapshot
- 404: Snapshot not found


================================================================================
8. REVIEW WORKFLOW ENDPOINTS
================================================================================

8.1 Get Pending Reviews
------------------------
GET /reviews/pending

Description:
Returns all milestones pending review for the authenticated reviewer.
Shows milestones from projects where user is invited as reviewer.

Headers:
Authorization: Bearer {token}

Response (200 OK):
{
  "success": true,
  "data": {
    "pendingReviews": [
      {
        "milestone": {
          "id": "uuid",
          "projectId": "uuid",
          "title": "string",
          "description": "string",
          "activityDate": "ISO8601 timestamp",
          "status": "submitted",
          "submittedAt": "ISO8601 timestamp",
          "evidenceCount": "number"
        },
        "project": {
          "id": "uuid",
          "title": "string",
          "projectType": "generic" | "construction" | "service",
          "owner": {
            "name": "string",
            "company": "string" | null
          }
        }
      }
    ]
  }
}

Errors:
- 401: Invalid or expired token
- 403: User is not a reviewer


8.2 Get Review Statistics
--------------------------
GET /reviews/statistics

Description:
Returns review statistics for the authenticated reviewer.

Headers:
Authorization: Bearer {token}

Response (200 OK):
{
  "success": true,
  "data": {
    "statistics": {
      "totalReviews": "number",
      "pendingReviews": "number",
      "approvedReviews": "number",
      "disapprovedReviews": "number",
      "projectsReviewing": "number"
    }
  }
}

Errors:
- 401: Invalid or expired token
- 403: User is not a reviewer


================================================================================
9. NOTIFICATION ENDPOINTS (Optional for Future)
================================================================================

9.1 Get Notifications
---------------------
GET /notifications

Description:
Returns notifications for the authenticated user.
Types: milestone_submitted, milestone_reviewed, reviewer_invited, etc.

Headers:
Authorization: Bearer {token}

Query Parameters:
- unread: "true" | "false" (optional, filter by read status)
- limit: "number" (optional, default: 50)

Response (200 OK):
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "uuid",
        "userId": "uuid",
        "type": "milestone_submitted" | "milestone_reviewed" | "reviewer_invited",
        "title": "string",
        "message": "string",
        "relatedEntityType": "project" | "milestone" | "snapshot",
        "relatedEntityId": "uuid",
        "read": "boolean",
        "createdAt": "ISO8601 timestamp"
      }
    ]
  }
}

Errors:
- 401: Invalid or expired token


9.2 Mark Notification as Read
------------------------------
PUT /notifications/:notificationId/read

Description:
Marks a notification as read.

Headers:
Authorization: Bearer {token}

Response (200 OK):
{
  "success": true,
  "message": "Notification marked as read"
}

Errors:
- 401: Invalid or expired token
- 404: Notification not found


================================================================================
10. ADMIN/DEMO ENDPOINTS
================================================================================

10.1 Reset Demo Data
--------------------
POST /admin/demo/reset

Description:
Resets the database to demo seed data. For demo/testing purposes only.
Should be disabled or restricted in production.

Headers:
Authorization: Bearer {token}

Response (200 OK):
{
  "success": true,
  "message": "Demo data reset successfully"
}

Errors:
- 401: Invalid or expired token
- 403: Not authorized (only available in development)


================================================================================
11. HEALTH CHECK ENDPOINTS
================================================================================

11.1 Health Check
-----------------
GET /health

Description:
Returns API health status. No authentication required.

Response (200 OK):
{
  "success": true,
  "status": "healthy",
  "timestamp": "ISO8601 timestamp",
  "version": "string"
}


11.2 Database Health Check
---------------------------
GET /health/db

Description:
Checks database connectivity. No authentication required.

Response (200 OK):
{
  "success": true,
  "database": "connected",
  "timestamp": "ISO8601 timestamp"
}

Response (503 Service Unavailable):
{
  "success": false,
  "database": "disconnected",
  "error": "string",
  "timestamp": "ISO8601 timestamp"
}


================================================================================
ERROR RESPONSE FORMAT
================================================================================

All error responses follow this standard format:

{
  "success": false,
  "error": {
    "code": "string",        // Machine-readable error code
    "message": "string",     // Human-readable error message
    "details": {}            // Optional additional error details
  }
}

Common Error Codes:
- UNAUTHORIZED: Invalid or missing authentication token
- FORBIDDEN: User lacks permission for this action
- NOT_FOUND: Requested resource not found
- VALIDATION_ERROR: Invalid request data
- CONFLICT: Resource already exists or state conflict
- INTERNAL_ERROR: Unexpected server error


HTTP Status Codes:
- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 409: Conflict
- 413: Payload Too Large
- 500: Internal Server Error
- 503: Service Unavailable


================================================================================
AUTHENTICATION & AUTHORIZATION
================================================================================

Session Management:
- Sessions are created on login/signup
- Session tokens should be stored securely (HttpOnly cookie or secure storage)
- Tokens expire after 30 days
- Client should handle 401 errors by redirecting to login

Role-Based Access:
- Workers can:
  * Create, update, delete their own projects
  * Create, update, delete milestones in their projects
  * Upload, delete evidence for their milestones
  * Create snapshots of their projects
  * Invite reviewers to their projects

- Reviewers can:
  * View projects they're invited to
  * View milestones in those projects
  * Approve or disapprove submitted milestones
  * Add reviewer notes

- Public (no auth) can:
  * View shared projects via share token
  * View shared snapshots via share token


================================================================================
FILE UPLOAD SPECIFICATIONS
================================================================================

Supported File Types:
- Images: JPEG, PNG, GIF, WebP (max 10MB)
- Videos: MP4, MOV, AVI (max 50MB)
- Documents: PDF, DOC, DOCX, XLS, XLSX (max 10MB)

File Processing:
- Automatic thumbnail generation for images (small: 150x150, medium: 300x300, large: 600x600)
- Automatic MIME type detection
- Virus scanning (recommended for production)
- Storage in cloud storage (S3, Google Cloud Storage, etc.)

File URLs:
- Should be signed URLs with expiration (for security)
- Thumbnail URLs should be optimized for fast loading
- Download URLs should trigger file download (Content-Disposition: attachment)


================================================================================
PAGINATION (For Future Implementation)
================================================================================

For endpoints that return lists, implement pagination:

Query Parameters:
- page: "number" (default: 1)
- limit: "number" (default: 20, max: 100)
- sort: "field:direction" (e.g., "createdAt:desc")

Response:
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalItems": 150,
      "totalPages": 8,
      "hasNext": true,
      "hasPrevious": false
    }
  }
}


================================================================================
RATE LIMITING (Recommended)
================================================================================

Implement rate limiting to prevent abuse:
- Auth endpoints: 5 requests per minute per IP
- File upload: 10 requests per minute per user
- Other endpoints: 100 requests per minute per user

Rate limit headers:
- X-RateLimit-Limit: Maximum requests allowed
- X-RateLimit-Remaining: Requests remaining
- X-RateLimit-Reset: Time when limit resets (Unix timestamp)


================================================================================
WEBSOCKET ENDPOINTS (Optional for Real-time Updates)
================================================================================

For real-time updates (milestone reviews, new comments, etc.):

WebSocket Connection:
ws://domain.com/ws?token={session_token}

Events:
- milestone.submitted
- milestone.reviewed
- reviewer.invited
- project.shared

Event Format:
{
  "event": "milestone.reviewed",
  "data": {
    "milestoneId": "uuid",
    "projectId": "uuid",
    "status": "approved",
    "reviewerNote": "string"
  },
  "timestamp": "ISO8601 timestamp"
}


================================================================================
SECURITY CONSIDERATIONS
================================================================================

1. Authentication:
   - Use secure password hashing (bcrypt/argon2) for PIN storage
   - Implement rate limiting on auth endpoints
   - Use HTTPS only
   - Implement CSRF protection

2. Authorization:
   - Always verify user has permission to access resource
   - Check project ownership for modify operations
   - Check reviewer invitation for review operations
   - Validate share tokens securely

3. File Upload:
   - Validate file types and sizes
   - Scan for malware
   - Store files in secure cloud storage
   - Use signed URLs with expiration
   - Implement rate limiting

4. Data Privacy:
   - Don't expose sensitive user data in public endpoints
   - Remove phone numbers from public share views
   - Sanitize user input to prevent XSS
   - Use parameterized queries to prevent SQL injection

5. API Security:
   - Implement CORS properly
   - Use security headers (CSP, X-Frame-Options, etc.)
   - Log security events
   - Implement request validation


================================================================================
END OF API SPECIFICATION
================================================================================

Total Endpoints: 60+
Core Functionality: Complete
Optional Features: Notifications, WebSockets, Advanced Export

This specification provides a complete backend API to support all frontend
functionality in the Progress Log application. Implement endpoints in priority
order based on feature importance.
