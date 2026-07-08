/**
 * logger.js
 * Minimal timestamped logger so we have consistent log formatting
 * across the app without pulling in a heavy dependency.
 */

const levels = {
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
  DEBUG: 'DEBUG',
};

function timestamp() {
  return new Date().toISOString();
}

function log(level, message, meta) {
  const line = `[${timestamp()}] [${level}] ${message}`;
  if (meta !== undefined) {
    // eslint-disable-next-line no-console
    console.log(line, meta);
  } else {
    // eslint-disable-next-line no-console
    console.log(line);
  }
}

module.exports = {
  info: (message, meta) => log(levels.INFO, message, meta),
  warn: (message, meta) => log(levels.WARN, message, meta),
  error: (message, meta) => log(levels.ERROR, message, meta),
  debug: (message, meta) => {
    if (process.env.NODE_ENV !== 'production') {
      log(levels.DEBUG, message, meta);
    }
  },
};
