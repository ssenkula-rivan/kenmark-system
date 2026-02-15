const db = require('../config/database');
const logger = require('../utils/logger');

const addDigitalPrintTypes = async () => {
  try {
    logger.info('Adding digital print job types...');
    
    // Add new job types for digital press
    await db.query(`
      INSERT INTO job_types (machine_type, name, unit) VALUES
      ('digital_press', 'A4 One-Sided', 'piece'),
      ('digital_press', 'A4 Back-to-Back', 'piece'),
      ('digital_press', 'A3 One-Sided', 'piece'),
      ('digital_press', 'A3 Back-to-Back', 'piece')
      ON DUPLICATE KEY UPDATE name=name
    `);
    
    // Get the newly created job type IDs
    const jobTypes = await db.query(`
      SELECT id FROM job_types 
      WHERE name IN ('A4 One-Sided', 'A4 Back-to-Back', 'A3 One-Sided', 'A3 Back-to-Back')
    `);
    
    // Add default pricing for new job types
    for (const jobType of jobTypes) {
      await db.query(`
        INSERT INTO pricing (job_type_id, rate, rate_unit, active) 
        VALUES (?, 100.00, 'per_piece', true)
        ON DUPLICATE KEY UPDATE rate=rate
      `, [jobType.id]);
    }
    
    logger.info('Digital print job types added successfully');
    return true;
  } catch (error) {
    logger.error('Failed to add digital print job types', { error: error.message });
    throw error;
  }
};

if (require.main === module) {
  (async () => {
    try {
      await db.testConnection();
      db.createPool();
      await addDigitalPrintTypes();
      await db.closePool();
      process.exit(0);
    } catch (error) {
      logger.error('Migration failed', { error: error.message });
      process.exit(1);
    }
  })();
}

module.exports = { addDigitalPrintTypes };
