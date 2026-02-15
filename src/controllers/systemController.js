const db = require('../config/database');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

class SystemController {
  async resetSystem(req, res) {
    try {
      const adminId = req.user.id;
      const { password } = req.body;
      
      if (!password) {
        return res.status(400).json({
          success: false,
          message: 'Password is required to reset system'
        });
      }

      // Verify admin password
      const users = await db.query(
        'SELECT password_hash FROM users WHERE id = ?',
        [adminId]
      );

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Admin user not found'
        });
      }

      const isPasswordValid = await bcrypt.compare(password, users[0].password_hash);

      if (!isPasswordValid) {
        logger.warn('System reset failed: Invalid password', {
          adminId,
          ip: req.ip
        });
        return res.status(401).json({
          success: false,
          message: 'Password is incorrect'
        });
      }
      
      logger.warn('System reset initiated', {
        adminId,
        adminUsername: req.user.username,
        ip: req.ip
      });

      // Start transaction
      await db.query('START TRANSACTION');

      try {
        // Delete all jobs
        await db.query('DELETE FROM jobs');
        logger.info('All jobs deleted');

        // Delete all messages
        await db.query('DELETE FROM messages');
        logger.info('All messages deleted');

        // Delete all audit logs except the current reset action
        await db.query('DELETE FROM audit_logs WHERE action != ?', ['system_reset']);
        logger.info('Audit logs cleared');

        // Delete all non-admin users
        await db.query('DELETE FROM users WHERE role != ? AND id != ?', ['admin', adminId]);
        logger.info('All worker accounts deleted');

        // Reset auto-increment counters
        const isPostgres = process.env.DB_TYPE === 'postgres' || process.env.DATABASE_URL;
        
        if (isPostgres) {
          await db.query('ALTER SEQUENCE jobs_id_seq RESTART WITH 1');
          await db.query('ALTER SEQUENCE messages_id_seq RESTART WITH 1');
        } else {
          await db.query('ALTER TABLE jobs AUTO_INCREMENT = 1');
          await db.query('ALTER TABLE messages AUTO_INCREMENT = 1');
        }

        // Commit transaction
        await db.query('COMMIT');

        logger.warn('System reset completed successfully', {
          adminId,
          adminUsername: req.user.username
        });

        return res.json({
          success: true,
          message: 'System reset to default successfully. All jobs, messages, and worker accounts have been deleted.'
        });
      } catch (error) {
        // Rollback on error
        await db.query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      logger.error('System reset failed', {
        error: error.message,
        stack: error.stack,
        adminId: req.user.id
      });
      return res.status(500).json({
        success: false,
        message: 'Failed to reset system'
      });
    }
  }
}

module.exports = new SystemController();
