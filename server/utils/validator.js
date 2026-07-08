/**
 * validator.js
 * Input validation & sanitization helpers used by socket event handlers
 * to prevent XSS, oversized payloads, and malformed data from
 * reaching the rest of the application.
 */

const validator = require('validator');
const config = require('../config/config');

/**
 * Escapes HTML-sensitive characters to prevent stored/reflected XSS
 * when chat messages are broadcast to other clients.
 */
function sanitizeText(text) {
  if (typeof text !== 'string') return '';
  return validator.escape(text.trim());
}

/**
 * Validates a chat message payload.
 * Returns { valid: boolean, error?: string, message?: string }
 */
function validateChatMessage(payload) {
  if (!payload || typeof payload.message !== 'string') {
    return { valid: false, error: 'Message must be a string.' };
  }

  const trimmed = payload.message.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: 'Message cannot be empty.' };
  }

  if (trimmed.length > config.socket.maxMessageLength) {
    return {
      valid: false,
      error: `Message exceeds maximum length of ${config.socket.maxMessageLength} characters.`,
    };
  }

  return { valid: true, message: sanitizeText(trimmed) };
}

/**
 * Validates an anonymous display name (auto-generated, but still checked
 * in case future features allow custom nicknames).
 */
function validateUsername(username) {
  if (typeof username !== 'string') return false;
  const trimmed = username.trim();
  return trimmed.length > 0 && trimmed.length <= 30 && /^[a-zA-Z0-9_\- ]+$/.test(trimmed);
}

/**
 * Validates a room ID format (UUID v4 expected).
 */
function validateRoomId(roomId) {
  return typeof roomId === 'string' && validator.isUUID(roomId, 4);
}

/**
 * Validates WebRTC signaling payloads (offer/answer/ICE candidate)
 * to ensure only expected shapes are relayed between peers.
 */
function validateSignalPayload(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (!payload.type || typeof payload.type !== 'string') return false;
  const allowedTypes = ['offer', 'answer', 'ice-candidate'];
  return allowedTypes.includes(payload.type) && payload.data !== undefined;
}

/**
 * Validates a report reason submitted by a user.
 */
function validateReportReason(reason) {
  if (typeof reason !== 'string') return false;
  const trimmed = reason.trim();
  return trimmed.length > 0 && trimmed.length <= 300;
}

module.exports = {
  sanitizeText,
  validateChatMessage,
  validateUsername,
  validateRoomId,
  validateSignalPayload,
  validateReportReason,
};
