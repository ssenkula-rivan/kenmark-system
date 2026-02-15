const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');
const execPromise = util.promisify(exec);
const logger = require('./logger');
const config = require('../config/env');

const BACKUP_DIR = path.join(__dirname, '../../backups');
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/**
 * Create a database backup
 */
const backupDatabase = async () => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `db_backup_${timestamp}.sql`);

    const command = `mysqldump -h ${config.db.host} -P ${config.db.port} -u ${config.db.user} -p${config.db.password} ${config.db.database} > ${backupFile}`;

    await execPromise(command);

    // Compress the backup
    await execPromise(`gzip ${backupFile}`);

    logger.info('Database backup created successfully', {
      file: `${backupFile}.gz`,
      timestamp
    });

    return `${backupFile}.gz`;
  } catch (error) {
    logger.error('Database backup failed', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
};

/**
 * Restore database from backup
 */
const restoreDatabase = async (backupFile) => {
  try {
    if (!fs.existsSync(backupFile)) {
      throw new Error(`Backup file not found: ${backupFile}`);
    }

    // Decompress if needed
    let sqlFile = backupFile;
    if (backupFile.endsWith('.gz')) {
      await execPromise(`gunzip -c ${backupFile} > ${backupFile.replace('.gz', '')}`);
      sqlFile = backupFile.replace('.gz', '');
    }

    const command = `mysql -h ${config.db.host} -P ${config.db.port} -u ${config.db.user} -p${config.db.password} ${config.db.database} < ${sqlFile}`;

    await execPromise(command);

    logger.info('Database restored successfully', {
      file: backupFile
    });

    // Clean up decompressed file if it was compressed
    if (backupFile.endsWith('.gz') && fs.existsSync(sqlFile)) {
      fs.unlinkSync(sqlFile);
    }

    return true;
  } catch (error) {
    logger.error('Database restore failed', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
};

/**
 * Backup uploaded files
 */
const backupFiles = async () => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `files_backup_${timestamp}.tar.gz`);

    if (!fs.existsSync(UPLOADS_DIR)) {
      logger.warn('Uploads directory does not exist, skipping file backup');
      return null;
    }

    await execPromise(`tar -czf ${backupFile} -C ${path.dirname(UPLOADS_DIR)} ${path.basename(UPLOADS_DIR)}`);

    logger.info('Files backup created successfully', {
      file: backupFile,
      timestamp
    });

    return backupFile;
  } catch (error) {
    logger.error('Files backup failed', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
};

/**
 * Restore uploaded files from backup
 */
const restoreFiles = async (backupFile) => {
  try {
    if (!fs.existsSync(backupFile)) {
      throw new Error(`Backup file not found: ${backupFile}`);
    }

    await execPromise(`tar -xzf ${backupFile} -C ${path.dirname(UPLOADS_DIR)}`);

    logger.info('Files restored successfully', {
      file: backupFile
    });

    return true;
  } catch (error) {
    logger.error('Files restore failed', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
};

/**
 * Create full system backup (database + files)
 */
const createFullBackup = async () => {
  try {
    logger.info('Starting full system backup...');

    const dbBackup = await backupDatabase();
    const filesBackup = await backupFiles();

    logger.info('Full system backup completed', {
      database: dbBackup,
      files: filesBackup
    });

    return {
      database: dbBackup,
      files: filesBackup,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Full system backup failed', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
};

/**
 * List available backups
 */
const listBackups = () => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      return [];
    }

    const files = fs.readdirSync(BACKUP_DIR);
    const backups = files.map(file => {
      const filePath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filePath);
      return {
        filename: file,
        path: filePath,
        size: stats.size,
        created: stats.birthtime,
        type: file.startsWith('db_') ? 'database' : 'files'
      };
    });

    return backups.sort((a, b) => b.created - a.created);
  } catch (error) {
    logger.error('Failed to list backups', {
      error: error.message
    });
    return [];
  }
};

/**
 * Clean old backups (keep last N backups)
 */
const cleanOldBackups = async (keepCount = 10) => {
  try {
    const backups = listBackups();
    const dbBackups = backups.filter(b => b.type === 'database');
    const fileBackups = backups.filter(b => b.type === 'files');

    const deleteBackups = (backupList, keep) => {
      if (backupList.length > keep) {
        const toDelete = backupList.slice(keep);
        toDelete.forEach(backup => {
          fs.unlinkSync(backup.path);
          logger.info('Old backup deleted', { file: backup.filename });
        });
      }
    };

    deleteBackups(dbBackups, keepCount);
    deleteBackups(fileBackups, keepCount);

    logger.info('Old backups cleaned', { keepCount });
  } catch (error) {
    logger.error('Failed to clean old backups', {
      error: error.message
    });
  }
};

module.exports = {
  backupDatabase,
  restoreDatabase,
  backupFiles,
  restoreFiles,
  createFullBackup,
  listBackups,
  cleanOldBackups
};
