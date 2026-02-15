#!/usr/bin/env node
require('../config/env');
const db = require('../config/database');
const logger = require('../utils/logger');

// This is a convenience script that just runs seeding
// The actual seeding logic is in run.js
const { exec } = require('child_process');

logger.info('Running migrations with seed flag...');
exec('node src/migrations/run.js --seed', (error, stdout, stderr) => {
  if (stdout) logger.info(stdout);
  if (stderr) logger.error(stderr);
  if (error) {
    logger.error('Seed command failed', { error: error.message });
    process.exit(1);
  }
});
