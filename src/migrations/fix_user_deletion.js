const db = require('../config/database');
const logger = require('../utils/logger');

async function fixUserDeletionConstraints() {
  try {
    const isPostgres = process.env.DB_TYPE === 'postgres';
    
    if (isPostgres) {
      // PostgreSQL: Drop and recreate foreign key constraint
      await db.query(`
        ALTER TABLE jobs 
        DROP CONSTRAINT IF EXISTS jobs_worker_id_fkey;
      `);
      
      await db.query(`
        ALTER TABLE jobs 
        ADD CONSTRAINT jobs_worker_id_fkey 
        FOREIGN KEY (worker_id) REFERENCES users(id) ON DELETE SET NULL;
      `);
      
      // Also need to allow NULL for worker_id
      await db.query(`
        ALTER TABLE jobs 
        ALTER COLUMN worker_id DROP NOT NULL;
      `);
      
      logger.info('PostgreSQL: Updated jobs foreign key constraint to ON DELETE SET NULL');
    } else {
      // MySQL: Drop and recreate foreign key constraint
      await db.query(`
        ALTER TABLE jobs 
        DROP FOREIGN KEY jobs_ibfk_1;
      `);
      
      await db.query(`
        ALTER TABLE jobs 
        MODIFY worker_id INT NULL;
      `);
      
      await db.query(`
        ALTER TABLE jobs 
        ADD CONSTRAINT jobs_ibfk_1 
        FOREIGN KEY (worker_id) REFERENCES users(id) ON DELETE SET NULL;
      `);
      
      logger.info('MySQL: Updated jobs foreign key constraint to ON DELETE SET NULL');
    }
    
    logger.info('Fixed user deletion constraints - jobs will be preserved');
  } catch (error) {
    logger.error('Failed to fix user deletion constraints', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

module.exports = { fixUserDeletionConstraints };
