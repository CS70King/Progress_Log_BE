const express = require('express');
const router = express.Router();

// Review routes will be implemented here
// GET /api/v1/reviews/pending
// GET /api/v1/reviews/statistics

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Review routes - Coming soon'
  });
});

module.exports = router;
