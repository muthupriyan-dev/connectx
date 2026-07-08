/**
 * events.js
 * Registers all Socket.IO event listeners for a connected client:
 * matchmaking (find/skip/leave), WebRTC signaling relay, live chat,
 * and moderation actions (report/block). Security checks (validation,
 * rate limiting) are applied before any data is trusted or relayed.
 */

const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const {
  validateChatMessage,
  validateSignalPayload,
  validateReportReason,
} = require('../utils/validator');
const SocketRateLimiter = require('../utils/rateLimiter');
const config = require('../config/config');

// Anonymous display name generator - no personal data ever used
const ADJECTIVES = ['Swift', 'Silent', 'Cosmic', 'Neon', 'Hidden', 'Electric', 'Lunar', 'Crimson', 'Arctic', 'Rapid'];
const NOUNS = ['Falcon', 'Phantom', 'Nomad', 'Voyager', 'Ranger', 'Comet', 'Shadow', 'Pioneer', 'Drifter', 'Spark'];

function generateAnonymousName() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${adj}${noun}${num}`;
}

/**
 * Registers all event handlers for one connected socket.
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 * @param {import('./matchmaking')} matchmaker
 */
function registerSocketEvents(io, socket, matchmaker) {
  const chatLimiter = registerSocketEvents.chatLimiter
    || (registerSocketEvents.chatLimiter = new SocketRateLimiter(config.socket.messageRateLimit, 1000));
  const actionLimiter = registerSocketEvents.actionLimiter
    || (registerSocketEvents.actionLimiter = new SocketRateLimiter(3, 2000)); // find/skip max 3 per 2s

  socket.anonymousName = generateAnonymousName();
  logger.info(`Client connected: ${socket.id} as ${socket.anonymousName}`);

  // Broadcast updated online count to everyone
  const broadcastOnlineCount = () => {
    io.emit('online-count', { count: io.engine.clientsCount });
  };
  broadcastOnlineCount();

  /** Attempts to match the socket, or places it in queue if none available. */
  function tryMatch() {
    const partnerId = matchmaker.findMatch(socket.id);

    if (!partnerId) {
      matchmaker.addToQueue(socket.id);
      socket.emit('searching');
      return;
    }

    matchmaker.pair(socket.id, partnerId);
    const roomId = uuidv4();
    socket.join(roomId);
    io.sockets.sockets.get(partnerId)?.join(roomId);

    socket.roomId = roomId;
    const partnerSocket = io.sockets.sockets.get(partnerId);
    if (partnerSocket) partnerSocket.roomId = roomId;

    // The socket with the "lower" id initiates the WebRTC offer to avoid glare
    const initiator = socket.id < partnerId ? socket.id : partnerId;

    io.to(socket.id).emit('matched', {
      roomId,
      isInitiator: initiator === socket.id,
      partnerName: partnerSocket?.anonymousName || 'Stranger',
    });
    io.to(partnerId).emit('matched', {
      roomId,
      isInitiator: initiator === partnerId,
      partnerName: socket.anonymousName,
    });

    logger.info(`Match created in room ${roomId}: ${socket.id} <-> ${partnerId}`);
  }

  // ---- Matchmaking events ----

  socket.on('find-partner', () => {
    if (!actionLimiter.isAllowed(socket.id)) {
      socket.emit('error-message', { message: 'Please slow down.' });
      return;
    }
    tryMatch();
  });

  socket.on('skip-partner', () => {
    if (!actionLimiter.isAllowed(socket.id)) {
      socket.emit('error-message', { message: 'Please slow down.' });
      return;
    }
    const partnerId = matchmaker.unpair(socket.id);
    if (partnerId) {
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.leave(socket.roomId);
        partnerSocket.emit('partner-left');
      }
    }
    socket.leave(socket.roomId);
    socket.roomId = null;
    tryMatch();
  });

  socket.on('leave-chat', () => {
    const partnerId = matchmaker.unpair(socket.id);
    matchmaker.removeFromQueue(socket.id);
    if (partnerId) {
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.leave(socket.roomId);
        partnerSocket.emit('partner-left');
      }
    }
    if (socket.roomId) socket.leave(socket.roomId);
    socket.roomId = null;
  });

  // ---- WebRTC signaling relay ----
  // The server never inspects SDP/ICE contents - it only relays them
  // to the correct room after basic shape validation.

  socket.on('signal', (payload) => {
    if (!validateSignalPayload(payload)) {
      logger.warn(`Invalid signal payload from ${socket.id}`);
      return;
    }
    if (!socket.roomId) return;
    socket.to(socket.roomId).emit('signal', payload);
  });

  // ---- Chat events ----

  socket.on('chat-message', (payload) => {
    if (!chatLimiter.isAllowed(socket.id)) {
      socket.emit('error-message', { message: 'You are sending messages too fast.' });
      return;
    }
    const result = validateChatMessage(payload);
    if (!result.valid) {
      socket.emit('error-message', { message: result.error });
      return;
    }
    if (!socket.roomId) return;

    const outgoing = {
      message: result.message,
      sender: socket.anonymousName,
      timestamp: Date.now(),
      self: false,
    };

    socket.to(socket.roomId).emit('chat-message', outgoing);
    socket.emit('chat-message', { ...outgoing, self: true });
  });

  socket.on('typing', () => {
    if (socket.roomId) socket.to(socket.roomId).emit('typing');
  });

  // ---- Moderation ----

  socket.on('report-user', (payload) => {
    const reason = payload && payload.reason;
    if (!validateReportReason(reason)) {
      socket.emit('error-message', { message: 'Invalid report reason.' });
      return;
    }
    const partnerId = matchmaker.getPartner(socket.id);
    logger.warn(`Report filed by ${socket.id} against ${partnerId}: ${reason}`);
    // In production this would persist to a moderation database/queue.
    socket.emit('report-received');
  });

  socket.on('block-user', () => {
    const partnerId = matchmaker.getPartner(socket.id);
    if (partnerId) {
      matchmaker.addBlock(socket.id, partnerId);
      logger.info(`${socket.id} blocked ${partnerId}`);
    }
  });

  // ---- Disconnect handling ----

  socket.on('disconnect', () => {
    const partnerId = matchmaker.cleanup(socket.id);
    chatLimiter.clear(socket.id);
    actionLimiter.clear(socket.id);

    if (partnerId) {
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        if (socket.roomId) partnerSocket.leave(socket.roomId);
        partnerSocket.emit('partner-left');
      }
    }

    logger.info(`Client disconnected: ${socket.id}`);
    broadcastOnlineCount();
  });
}

module.exports = registerSocketEvents;
