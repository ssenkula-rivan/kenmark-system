const db = require('../config/database');
const logger = require('../utils/logger');

async function addLastActive() {
  try {
    logger.info('Adding last_active column to users table...');

    await db.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS last_active TIMESTAMP NULL DEFAULT NULL
    `);

    // Update all existing users to current time
    await db.query(`
      UPDATE users 
      SET last_active = NOW()
    `);

    logger.info('Successfully added last_active column');
    return true;
  } catch (error) {
    logger.error('Failed to add last_active column', { error: error.message });
    throw error;
  }
}

module.exports = { addLastActive };
