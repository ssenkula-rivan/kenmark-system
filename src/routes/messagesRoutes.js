const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body } = require('express-validator');
const messagesController = require('../controllers/messagesController');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const logger = require('../utils/logger');

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = 'uploads/';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads with enhanced error handling
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, uniqueSuffix + '-' + sanitizedFilename);
  }
});

// File filter for security
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/csv',
    'application/zip', 'application/x-rar-compressed'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    logger.warn('File upload rejected: unsupported file type', { 
      mimetype: file.mimetype,
      filename: file.originalname 
    });
    cb(new Error('Unsupported file type'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // Increased to 50MB for heavy files
    files: 1
  },
  fileFilter: fileFilter
});


router.post('/send',
  authenticate,
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'File too large. Maximum size is 50MB'
          });
        }
        return res.status(400).json({
          success: false,
          message: `Upload error: ${err.message}`
        });
      } else if (err) {
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }
      next();
    });
  },
  [
    body('receiver_id')
      .isInt({ min: 1 })
      .withMessage('Valid receiver ID is required'),
    body('message')
      .optional()
      .trim()
      .isLength({ max: 5000 })
      .withMessage('Message must not exceed 5000 characters')
  ],
  validate,
  messagesController.sendMessage
);

router.get('/',
  authenticate,
  messagesController.getMessages
);

router.get('/users',
  authenticate,
  messagesController.getUsers
);

router.put('/:message_id/read',
  authenticate,
  messagesController.markAsRead
);

router.get('/:message_id/download',
  authenticate,
  messagesController.downloadFile
);

module.exports = router;
