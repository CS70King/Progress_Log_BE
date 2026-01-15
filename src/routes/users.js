const express = require('express');
const router = express.Router();

// User routes will be implemented here
// GET /api/v1/users/search
// GET /api/v1/users/:userId
// GET /api/v1/users/me
// PUT /api/v1/users/me

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'User routes - Coming soon'
  });
});

module.exports = router;
