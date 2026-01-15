const express = require('express');
const router = express.Router();

// Authentication routes will be implemented here
// POST /api/v1/auth/signup
// POST /api/v1/auth/login
// GET /api/v1/auth/session
// POST /api/v1/auth/logout

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Authentication routes - Coming soon'
  });
});

module.exports = router;
