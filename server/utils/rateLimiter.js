/**
 * rateLimiter.js
 * A lightweight in-memory sliding-window rate limiter for Socket.IO events
 * (e.g. chat messages, skip requests) to prevent spam/flooding abuse.
 * This is separate from the HTTP rate limiter (express-rate-limit) which
 * only protects REST routes.
 */

class SocketRateLimiter {
  /**
   * @param {number} maxEvents - max events allowed within windowMs
   * @param {number} windowMs - time window in milliseconds
   */
  constructor(maxEvents, windowMs) {
    this.maxEvents = maxEvents;
    this.windowMs = windowMs;
    // Map<socketId, number[]> - timestamps of recent events
    this.hits = new Map();
  }

  /**
   * Records an event attempt and returns whether it is allowed.
   * @param {string} key - unique identifier (usually socket.id)
   * @returns {boolean} true if within limit, false if rate-limited
   */
  isAllowed(key) {
    const now = Date.now();
    const timestamps = this.hits.get(key) || [];

    // Drop timestamps outside the current window
    const recent = timestamps.filter((t) => now - t < this.windowMs);

    if (recent.length >= this.maxEvents) {
      this.hits.set(key, recent);
      return false;
    }

    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }

  /** Cleans up tracking data for a disconnected socket. */
  clear(key) {
    this.hits.delete(key);
  }

  /** Periodic cleanup of stale entries to avoid unbounded memory growth. */
  sweep() {
    const now = Date.now();
    for (const [key, timestamps] of this.hits.entries()) {
      const recent = timestamps.filter((t) => now - t < this.windowMs);
      if (recent.length === 0) {
        this.hits.delete(key);
      } else {
        this.hits.set(key, recent);
      }
    }
  }
}

module.exports = SocketRateLimiter;
