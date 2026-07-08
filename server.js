/**
 * server.js
 * ConnectX main server entry point.
 * Sets up Express with security middleware (Helmet, CORS, rate limiting),
 * serves the static client, mounts API routes, and attaches Socket.IO
 * for real-time matchmaking, WebRTC signaling, and chat.
 */

const express = require('express');
const http = require('http');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const config = require('./config/config');
const logger = require('./utils/logger');
const routes = require('./routes/index');
const initSocket = require('./socket/index');

const app = express();
const httpServer = http.createServer(app);

// ---- Security middleware ----

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        mediaSrc: ["'self'", 'blob:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors({
    origin: config.clientOrigins,
    credentials: true,
  })
);

app.use(compression());
app.use(express.json({ limit: '10kb' })); // small limit - no large payloads expected over REST

// HTTP rate limiting (protects REST endpoints from abuse/scraping)
const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api', apiLimiter);

// ---- Static client files ----
app.use(express.static(path.join(__dirname, '..', 'client', 'public')));

// ---- Routes ----
app.use('/', routes);

// ---- 404 handler ----
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ---- Centralized error handler ----
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error('Unhandled error', err);
  res.status(err.status || 500).json({
    error: config.env === 'production' ? 'Internal server error' : err.message,
  });
});

// ---- Socket.IO ----
const io = initSocket(httpServer);
app.set('io', io); // exposed so controllers can read live socket stats

// ---- Start server ----
httpServer.listen(config.port, () => {
  logger.info(`ConnectX server running on port ${config.port} [${config.env}]`);
});

// ---- Graceful shutdown ----
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  httpServer.close(() => process.exit(0));
});

module.exports = { app, httpServer };
