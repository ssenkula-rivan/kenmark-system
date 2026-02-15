const cron = require('node-cron');
const backup = require('../utils/backup');
const logger = require('../utils/logger');

class BackupScheduler {
  constructor() {
    this.jobs = [];
  }

  /**
   * Start automatic backup scheduler
   */
  start() {
    // Daily backup at 2 AM
    const dailyBackup = cron.schedule('0 2 * * *', async () => {
      try {
        logger.info('Starting scheduled backup...');
        await backup.createFullBackup();
        await backup.cleanOldBackups(30); // Keep last 30 backups
        logger.info('Scheduled backup completed successfully');
      } catch (error) {
        logger.error('Scheduled backup failed', {
          error: error.message,
          stack: error.stack
        });
      }
    });

    // Weekly cleanup on Sunday at 3 AM
    const weeklyCleanup = cron.schedule('0 3 * * 0', async () => {
      try {
        logger.info('Starting weekly backup cleanup...');
        await backup.cleanOldBackups(10); // Keep only last 10 backups
        logger.info('Weekly cleanup completed');
      } catch (error) {
        logger.error('Weekly cleanup failed', {
          error: error.message
        });
      }
    });

    this.jobs.push(dailyBackup, weeklyCleanup);
    logger.info('Backup scheduler started', {
      dailyBackup: '2:00 AM',
      weeklyCleanup: 'Sunday 3:00 AM'
    });
  }

  /**
   * Stop all scheduled jobs
   */
  stop() {
    this.jobs.forEach(job => job.stop());
    this.jobs = [];
    logger.info('Backup scheduler stopped');
  }
}

module.exports = new BackupScheduler();
