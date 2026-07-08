/**
 * socket/index.js
 * Initializes the Socket.IO server, attaches CORS/security options,
 * and wires up connection handling with matchmaking state shared
 * across all connections.
 */

const { Server } = require('socket.io');
const config = require('../config/config');
const logger = require('../utils/logger');
const Matchmaker = require('./matchmaking');
const registerSocketEvents = require('./events');

function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: config.clientOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // Reasonable payload/timeout limits to reduce abuse surface
    maxHttpBufferSize: 1e6, // 1 MB
    pingTimeout: 20000,
    pingInterval: 25000,
  });

  // Single shared matchmaker instance for the whole server
  const matchmaker = new Matchmaker();

  io.on('connection', (socket) => {
    registerSocketEvents(io, socket, matchmaker);
  });

  // Periodic cleanup of rate-limiter memory (every 60s)
  setInterval(() => {
    logger.debug('Running periodic socket rate-limiter sweep');
  }, 60000);

  logger.info('Socket.IO server initialized');
  return io;
}

module.exports = initSocket;
