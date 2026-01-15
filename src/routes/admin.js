const express = require('express');
const router = express.Router();

// Admin routes will be implemented here
// POST /api/v1/admin/demo/reset

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Admin routes - Coming soon'
  });
});

module.exports = router;
