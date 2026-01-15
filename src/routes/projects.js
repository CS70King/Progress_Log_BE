const express = require('express');
const router = express.Router();

// Project routes will be implemented here
// GET /api/v1/projects
// GET /api/v1/projects/:projectId
// POST /api/v1/projects
// PUT /api/v1/projects/:projectId
// DELETE /api/v1/projects/:projectId
// POST /api/v1/projects/:projectId/complete
// POST /api/v1/projects/:projectId/abandon
// POST /api/v1/projects/:projectId/reopen
// POST /api/v1/projects/:projectId/share

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Project routes - Coming soon'
  });
});

module.exports = router;
