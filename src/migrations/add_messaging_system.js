const db = require('../config/database');
const logger = require('../utils/logger');

const addMessagingSystem = async () => {
  try {
    logger.info('Adding messaging system tables...');
    
    // Create messages table
    await db.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sender_id INT NOT NULL,
        receiver_id INT NOT NULL,
        message TEXT NULL,
        file_name VARCHAR(255) NULL,
        file_path VARCHAR(500) NULL,
        file_type VARCHAR(100) NULL,
        file_size INT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_sender (sender_id),
        INDEX idx_receiver (receiver_id),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    logger.info('Messaging system tables created successfully');
    return true;
  } catch (error) {
    logger.error('Failed to add messaging system', { error: error.message });
    throw error;
  }
};

if (require.main === module) {
  (async () => {
    try {
      await db.testConnection();
      db.createPool();
      await addMessagingSystem();
      await db.closePool();
      process.exit(0);
    } catch (error) {
      logger.error('Migration failed', { error: error.message });
      process.exit(1);
    }
  })();
}

module.exports = { addMessagingSystem };
