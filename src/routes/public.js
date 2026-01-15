const express = require('express');
const router = express.Router();

// Public routes (no authentication required)
// GET /public/projects/:shareToken
// GET /public/snapshots/:shareToken

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Public routes - Coming soon'
  });
});

module.exports = router;
