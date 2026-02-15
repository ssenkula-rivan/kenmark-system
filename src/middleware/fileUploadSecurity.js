const path = require('path');
const logger = require('../utils/logger');

// Allowed file types for uploads
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv'
];

const ALLOWED_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.txt', '.csv'
];

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Dangerous file extensions that should never be allowed
const DANGEROUS_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.com', '.pif', '.scr',
  '.vbs', '.js', '.jar', '.msi', '.app', '.deb',
  '.rpm', '.sh', '.php', '.asp', '.aspx', '.jsp'
];

function validateFileUpload(req, res, next) {
  if (!req.file && !req.files) {
    return next();
  }
  
  const files = req.files ? Object.values(req.files).flat() : [req.file];
  
  for (const file of files) {
    if (!file) continue;
    
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      logger.warn('File upload rejected: Size exceeds limit', {
        filename: file.originalname,
        size: file.size,
        maxSize: MAX_FILE_SIZE,
        userId: req.user?.id,
        ip: req.ip
      });
      return res.status(400).json({
        success: false,
        message: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`
      });
    }
    
    // Check file extension
    const ext = path.extname(file.originalname).toLowerCase();
    
    // Block dangerous extensions
    if (DANGEROUS_EXTENSIONS.includes(ext)) {
      logger.error('File upload rejected: Dangerous file type', {
        filename: file.originalname,
        extension: ext,
        userId: req.user?.id,
        ip: req.ip
      });
      return res.status(400).json({
        success: false,
        message: 'File type not allowed for security reasons'
      });
    }
    
    // Check if extension is allowed
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      logger.warn('File upload rejected: Extension not allowed', {
        filename: file.originalname,
        extension: ext,
        userId: req.user?.id,
        ip: req.ip
      });
      return res.status(400).json({
        success: false,
        message: `File type ${ext} is not allowed. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`
      });
    }
    
    // Check MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      logger.warn('File upload rejected: MIME type not allowed', {
        filename: file.originalname,
        mimetype: file.mimetype,
        userId: req.user?.id,
        ip: req.ip
      });
      return res.status(400).json({
        success: false,
        message: 'File type not allowed'
      });
    }
    
    // Sanitize filename
    file.originalname = sanitizeFilename(file.originalname);
    
    logger.info('File upload validated', {
      filename: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      userId: req.user?.id
    });
  }
  
  next();
}

function sanitizeFilename(filename) {
  // Remove path traversal attempts
  filename = path.basename(filename);
  
  // Remove special characters except dots, dashes, and underscores
  filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  
  // Prevent double extensions
  filename = filename.replace(/\.{2,}/g, '.');
  
  // Limit filename length
  const ext = path.extname(filename);
  const name = path.basename(filename, ext);
  const maxNameLength = 100;
  
  if (name.length > maxNameLength) {
    return name.substring(0, maxNameLength) + ext;
  }
  
  return filename;
}

module.exports = {
  validateFileUpload,
  sanitizeFilename,
  MAX_FILE_SIZE,
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS
};
