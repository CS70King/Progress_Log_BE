const express = require('express');
const router = express.Router();

// Evidence routes will be implemented here
// POST /api/v1/milestones/:milestoneId/evidence
// GET /api/v1/evidence/:evidenceId
// GET /api/v1/evidence/:evidenceId/download
// GET /api/v1/evidence/:evidenceId/thumbnail
// DELETE /api/v1/evidence/:evidenceId
// GET /api/v1/milestones/:milestoneId/evidence

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Evidence routes - Coming soon'
  });
});

module.exports = router;
