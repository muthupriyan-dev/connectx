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
    maxHttpBufferSize: 1e6,
    pingTimeout: 20000,
    pingInterval: 25000,
  });

  const matchmaker = new Matchmaker();

  io.on('connection', (socket) => {
    registerSocketEvents(io, socket, matchmaker);
  });

  setInterval(() => {
    logger.debug('Running periodic socket rate-limiter sweep');
  }, 60000);

  logger.info('Socket.IO server initialized');
  return io;
}

module.exports = initSocket;
