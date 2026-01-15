const express = require('express');
const { prisma } = require('../config/database');
const router = express.Router();

/**
 * Basic health check
 * GET /api/v1/health
 */
router.get('/', async (req, res) => {
  try {
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * Database health check
 * GET /api/v1/health/db
 */
router.get('/db', async (req, res) => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    
    res.json({
      success: true,
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      database: 'disconnected',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

module.exports = router;
