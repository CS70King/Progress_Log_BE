const express = require('express');
const router = express.Router();

// Milestone routes will be implemented here
// GET /api/v1/projects/:projectId/milestones
// GET /api/v1/milestones/:milestoneId
// POST /api/v1/projects/:projectId/milestones
// PUT /api/v1/milestones/:milestoneId
// DELETE /api/v1/milestones/:milestoneId
// POST /api/v1/milestones/:milestoneId/submit
// POST /api/v1/milestones/:milestoneId/approve
// POST /api/v1/milestones/:milestoneId/disapprove

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Milestone routes - Coming soon'
  });
});

module.exports = router;
