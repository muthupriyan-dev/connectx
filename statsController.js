/**
 * statsController.js
 * Controller logic for the /ice-config and /stats API endpoints.
 * Keeps route files thin and testable.
 */

const config = require('../config/config');

/**
 * Returns the ICE server list (STUN + optional TURN) so the client
 * never has to hardcode credentials in its own source.
 */
function getIceConfig(req, res) {
  res.status(200).json({ iceServers: config.iceServers });
}

/**
 * Returns basic server stats. The io instance is attached to the
 * Express app in server.js so we can read live socket counts here.
 */
function getStats(req, res) {
  const io = req.app.get('io');
  const onlineCount = io ? io.engine.clientsCount : 0;
  res.status(200).json({ onlineUsers: onlineCount });
}

module.exports = {
  getIceConfig,
  getStats,
};
