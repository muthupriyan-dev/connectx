/**
 * routes/index.js
 * Root router - mounts the /api routes and serves the client's
 * index.html for the base route (single-page app entry point).
 */

const express = require('express');
const path = require('path');
const apiRoutes = require('./api');

const router = express.Router();

router.use('/api', apiRoutes);

// Serve the landing page for the root route
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'client', 'public', 'index.html'));
});

module.exports = router;
