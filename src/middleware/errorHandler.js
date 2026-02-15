const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  // Log detailed error information
  logger.error('Error occurred', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
    body: req.body,
    query: req.query,
    userId: req.user?.id,
    ip: req.ip
  });

  // Determine status code
  const statusCode = err.statusCode || err.status || 500;
  
  // Determine error message
  let message = err.message || 'Internal Server Error';
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    message = 'Validation failed';
  } else if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError') {
    message = 'Authentication failed';
  } else if (err.code === 'ECONNREFUSED') {
    message = 'Database connection failed';
  } else if (err.code === 'ER_DUP_ENTRY') {
    message = 'Duplicate entry - record already exists';
  } else if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    message = 'Referenced record does not exist';
  } else if (err.code === 'LIMIT_FILE_SIZE') {
    message = 'File size exceeds maximum limit';
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    message: message,
    ...(process.env.NODE_ENV === 'development' && { 
      error: err.message,
      stack: err.stack 
    })
  });
};

module.exports = errorHandler;
