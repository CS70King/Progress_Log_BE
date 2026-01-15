const express = require('express');
const router = express.Router();

// Snapshot routes will be implemented here
// GET /api/v1/projects/:projectId/snapshots
// GET /api/v1/snapshots/:snapshotId
// POST /api/v1/projects/:projectId/snapshots
// DELETE /api/v1/snapshots/:snapshotId
// POST /api/v1/snapshots/:snapshotId/share

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Snapshot routes - Coming soon'
  });
});

module.exports = router;
