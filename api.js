/**
 * routes/api.js
 * REST API routes for ConnectX. Kept minimal since most real-time
 * behavior happens over Socket.IO - these endpoints support the
 * client with configuration and health data.
 */

const express = require('express');
const statsController = require('../controllers/statsController');

const router = express.Router();

// Health check for uptime monitors / deployment platforms (Render, Railway)
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: Date.now() });
});

// Returns WebRTC ICE server configuration (STUN/TURN) for the client
router.get('/ice-config', statsController.getIceConfig);

// Returns current online user count
router.get('/stats', statsController.getStats);

module.exports = router;
