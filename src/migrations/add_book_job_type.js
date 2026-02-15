const db = require('../config/database');
const logger = require('../utils/logger');

const addBookJobType = async () => {
  try {
    logger.info('Adding Book job type...');
    
    // Check if Book job type already exists
    const existing = await db.query(`
      SELECT id FROM job_types 
      WHERE machine_type = 'digital_press' AND name = 'Book'
    `);
    
    if (existing.length > 0) {
      logger.info('Book job type already exists');
      return true;
    }
    
    // Add Book job type
    await db.query(`
      INSERT INTO job_types (machine_type, name, unit) 
      VALUES ('digital_press', 'Book', 'piece')
    `);
    
    // Get the newly created job type ID
    const bookJobType = await db.query(`
      SELECT id FROM job_types 
      WHERE machine_type = 'digital_press' AND name = 'Book'
    `);
    
    if (bookJobType.length > 0) {
      // Add default pricing for Book job type
      await db.query(`
        INSERT INTO pricing (job_type_id, rate, rate_unit, active) 
        VALUES (?, 500.00, 'per_piece', true)
      `, [bookJobType[0].id]);
      
      logger.info('Book job type added successfully with default rate of 500.00 per piece');
    }
    
    return true;
  } catch (error) {
    logger.error('Failed to add Book job type', { error: error.message });
    throw error;
  }
};

if (require.main === module) {
  (async () => {
    try {
      await db.testConnection();
      db.createPool();
      await addBookJobType();
      await db.closePool();
      process.exit(0);
    } catch (error) {
      logger.error('Migration failed', { error: error.message });
      process.exit(1);
    }
  })();
}

module.exports = { addBookJobType };
