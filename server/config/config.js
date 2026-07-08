/**
 * config.js
 * Centralized configuration loaded from environment variables.
 * All other modules should read settings from here instead of
 * accessing process.env directly, to keep config in one place.
 */

require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,

  // Allowed origins for CORS / Socket.IO (comma separated in .env)
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5000')
    .split(',')
    .map((origin) => origin.trim()),

  // WebRTC ICE server configuration sent to clients
  iceServers: [
    {
      urls: process.env.STUN_SERVER || 'stun:stun.l.google.com:19302',
    },
    // TURN server is included only if credentials are provided
    ...(process.env.TURN_SERVER_URL
      ? [
          {
            urls: process.env.TURN_SERVER_URL,
            username: process.env.TURN_SERVER_USERNAME || '',
            credential: process.env.TURN_SERVER_CREDENTIAL || '',
          },
        ]
      : []),
  ],

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  },

  socket: {
    maxMessageLength: parseInt(process.env.SOCKET_MAX_MESSAGE_LENGTH, 10) || 500,
    messageRateLimit: parseInt(process.env.SOCKET_MESSAGE_RATE_LIMIT, 10) || 5, // messages per second
  },

  room: {
    maxLifetimeMs: parseInt(process.env.MAX_ROOM_LIFETIME_MS, 10) || 7200000, // 2 hours
  },
};

module.exports = config;
