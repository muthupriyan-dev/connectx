/**
 * matchmaking.js
 * Handles the waiting queue and random pairing logic for ConnectX.
 * Kept independent of Socket.IO event wiring (events.js) so the
 * matching algorithm can be tested/reasoned about in isolation.
 */

const logger = require('../utils/logger');

class Matchmaker {
  constructor() {
    // FIFO queue of socket IDs waiting for a partner
    this.waitingQueue = [];

    // Map<socketId, partnerSocketId> - active pairings
    this.activePairs = new Map();

    // Map<socketId, Set<blockedSocketId>> - users this socket has blocked
    this.blockList = new Map();
  }

  /** Adds a socket to the waiting queue if not already present or paired. */
  addToQueue(socketId) {
    if (this.activePairs.has(socketId)) return false;
    if (this.waitingQueue.includes(socketId)) return false;
    this.waitingQueue.push(socketId);
    return true;
  }

  /** Removes a socket from the waiting queue (e.g. on disconnect). */
  removeFromQueue(socketId) {
    const idx = this.waitingQueue.indexOf(socketId);
    if (idx !== -1) this.waitingQueue.splice(idx, 1);
  }

  /**
   * Checks whether two sockets have blocked each other.
   */
  isBlocked(socketIdA, socketIdB) {
    const blockedByA = this.blockList.get(socketIdA);
    const blockedByB = this.blockList.get(socketIdB);
    return Boolean(blockedByA?.has(socketIdB) || blockedByB?.has(socketIdA));
  }

  /** Registers that socketId has blocked targetId. */
  addBlock(socketId, targetId) {
    if (!this.blockList.has(socketId)) {
      this.blockList.set(socketId, new Set());
    }
    this.blockList.get(socketId).add(targetId);
  }

  /**
   * Attempts to find a match for the given socket from the waiting queue,
   * skipping anyone that has been mutually blocked.
   * @returns {string|null} the matched partner's socket ID, or null
   */
  findMatch(socketId) {
    for (let i = 0; i < this.waitingQueue.length; i += 1) {
      const candidate = this.waitingQueue[i];
      if (candidate === socketId) continue;
      if (this.isBlocked(socketId, candidate)) continue;

      // Remove candidate from queue - they are now matched
      this.waitingQueue.splice(i, 1);
      return candidate;
    }
    return null;
  }

  /** Records an active pairing between two sockets. */
  pair(socketIdA, socketIdB) {
    this.activePairs.set(socketIdA, socketIdB);
    this.activePairs.set(socketIdB, socketIdA);
    logger.info(`Paired ${socketIdA} <-> ${socketIdB}`);
  }

  /** Returns the current partner of a socket, if any. */
  getPartner(socketId) {
    return this.activePairs.get(socketId) || null;
  }

  /** Breaks the pairing for a socket and its partner. Returns the partner ID. */
  unpair(socketId) {
    const partner = this.activePairs.get(socketId);
    if (partner) {
      this.activePairs.delete(socketId);
      this.activePairs.delete(partner);
    }
    return partner || null;
  }

  /** Fully removes a socket from all matchmaking state (on disconnect). */
  cleanup(socketId) {
    this.removeFromQueue(socketId);
    const partner = this.unpair(socketId);
    this.blockList.delete(socketId);
    return partner;
  }

  /** Total number of currently connected/online users (queue + paired). */
  getOnlineCount() {
    const paired = new Set(this.activePairs.keys());
    const waiting = new Set(this.waitingQueue);
    return new Set([...paired, ...waiting]).size;
  }
}

module.exports = Matchmaker;
