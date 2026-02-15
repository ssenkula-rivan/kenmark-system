const db = require('../config/database');
const logger = require('../utils/logger');

const addDepartmentField = async () => {
  try {
    logger.info('Adding department field to users table...');
    
    await db.query(`
      ALTER TABLE users 
      ADD COLUMN department VARCHAR(100) NULL AFTER role
    `);
    
    logger.info('Department field added successfully');
    return true;
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      logger.info('Department field already exists');
      return true;
    }
    logger.error('Failed to add department field', { error: error.message });
    throw error;
  }
};

if (require.main === module) {
  (async () => {
    try {
      await db.testConnection();
      db.createPool();
      await addDepartmentField();
      await db.closePool();
      process.exit(0);
    } catch (error) {
      logger.error('Migration failed', { error: error.message });
      process.exit(1);
    }
  })();
}

module.exports = { addDepartmentField };
