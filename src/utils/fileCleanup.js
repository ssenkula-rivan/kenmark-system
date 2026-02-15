const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const UPLOADS_DIR = path.join(__dirname, '../../uploads');
const LOGS_DIR = path.join(__dirname, '../../logs');

/**
 * Get directory size in bytes
 */
const getDirectorySize = (dirPath) => {
  let totalSize = 0;

  if (!fs.existsSync(dirPath)) {
    return 0;
  }

  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    const stats = fs.statSync(filePath);

    if (stats.isFile()) {
      totalSize += stats.size;
    } else if (stats.isDirectory()) {
      totalSize += getDirectorySize(filePath);
    }
  });

  return totalSize;
};

/**
 * Delete files older than specified days
 */
const deleteOldFiles = (dirPath, daysOld = 90) => {
  if (!fs.existsSync(dirPath)) {
    return { deleted: 0, freedSpace: 0 };
  }

  const now = Date.now();
  const maxAge = daysOld * 24 * 60 * 60 * 1000;
  let deleted = 0;
  let freedSpace = 0;

  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    const stats = fs.statSync(filePath);

    if (stats.isFile()) {
      const age = now - stats.mtimeMs;

      if (age > maxAge) {
        const size = stats.size;
        fs.unlinkSync(filePath);
        deleted++;
        freedSpace += size;
        logger.info('Old file deleted', {
          file: filePath,
          age: Math.floor(age / (24 * 60 * 60 * 1000)) + ' days',
          size: (size / 1024 / 1024).toFixed(2) + ' MB'
        });
      }
    }
  });

  return { deleted, freedSpace };
};

/**
 * Clean old log files
 */
const cleanOldLogs = async (daysOld = 30) => {
  try {
    logger.info('Starting log cleanup...');
    const result = deleteOldFiles(LOGS_DIR, daysOld);
    logger.info('Log cleanup completed', {
      filesDeleted: result.deleted,
      spaceFreed: (result.freedSpace / 1024 / 1024).toFixed(2) + ' MB'
    });
    return result;
  } catch (error) {
    logger.error('Log cleanup failed', {
      error: error.message
    });
    throw error;
  }
};

/**
 * Clean orphaned upload files (files not referenced in database)
 */
const cleanOrphanedUploads = async (db) => {
  try {
    logger.info('Starting orphaned uploads cleanup...');

    // Get all file references from database
    const [messages] = await db.query(
      'SELECT file_path FROM messages WHERE file_path IS NOT NULL'
    );

    const referencedFiles = new Set(
      messages.map(m => path.basename(m.file_path))
    );

    if (!fs.existsSync(UPLOADS_DIR)) {
      return { deleted: 0, freedSpace: 0 };
    }

    const files = fs.readdirSync(UPLOADS_DIR);
    let deleted = 0;
    let freedSpace = 0;

    files.forEach(file => {
      if (!referencedFiles.has(file)) {
        const filePath = path.join(UPLOADS_DIR, file);
        const stats = fs.statSync(filePath);

        if (stats.isFile()) {
          const size = stats.size;
          fs.unlinkSync(filePath);
          deleted++;
          freedSpace += size;
          logger.info('Orphaned file deleted', {
            file: filePath,
            size: (size / 1024 / 1024).toFixed(2) + ' MB'
          });
        }
      }
    });

    logger.info('Orphaned uploads cleanup completed', {
      filesDeleted: deleted,
      spaceFreed: (freedSpace / 1024 / 1024).toFixed(2) + ' MB'
    });

    return { deleted, freedSpace };
  } catch (error) {
    logger.error('Orphaned uploads cleanup failed', {
      error: error.message
    });
    throw error;
  }
};

/**
 * Get disk usage statistics
 */
const getDiskUsage = () => {
  const uploadsSize = getDirectorySize(UPLOADS_DIR);
  const logsSize = getDirectorySize(LOGS_DIR);

  return {
    uploads: {
      size: uploadsSize,
      sizeMB: (uploadsSize / 1024 / 1024).toFixed(2),
      path: UPLOADS_DIR
    },
    logs: {
      size: logsSize,
      sizeMB: (logsSize / 1024 / 1024).toFixed(2),
      path: LOGS_DIR
    },
    total: {
      size: uploadsSize + logsSize,
      sizeMB: ((uploadsSize + logsSize) / 1024 / 1024).toFixed(2)
    }
  };
};

/**
 * Check if disk space is running low
 */
const checkDiskSpace = () => {
  const usage = getDiskUsage();
  const maxUploadsSizeMB = 1000; // 1GB warning threshold

  if (parseFloat(usage.uploads.sizeMB) > maxUploadsSizeMB) {
    logger.warn('Uploads directory size exceeds threshold', {
      currentSize: usage.uploads.sizeMB + ' MB',
      threshold: maxUploadsSizeMB + ' MB'
    });
    return false;
  }

  return true;
};

module.exports = {
  getDirectorySize,
  deleteOldFiles,
  cleanOldLogs,
  cleanOrphanedUploads,
  getDiskUsage,
  checkDiskSpace
};
