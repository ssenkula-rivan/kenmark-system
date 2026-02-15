const logger = require('../utils/logger');

// XSS prevention - sanitize strings
function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  
  return str
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .trim();
}

// SQL injection prevention - detect suspicious patterns
function detectSQLInjection(str) {
  if (typeof str !== 'string') return false;
  
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi,
    /(UNION\s+SELECT)/gi,
    /(--|\#|\/\*|\*\/)/g,
    /(\bOR\b\s+\d+\s*=\s*\d+)/gi,
    /(\bAND\b\s+\d+\s*=\s*\d+)/gi,
    /(;|\||&&)/g
  ];
  
  return sqlPatterns.some(pattern => pattern.test(str));
}

// Sanitize object recursively
function sanitizeObject(obj) {
  if (obj === null || obj === undefined) return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }
  
  if (typeof obj === 'string') {
    // Check for SQL injection
    if (detectSQLInjection(obj)) {
      logger.warn('Potential SQL injection detected', { value: obj });
      throw new Error('Invalid input detected');
    }
    return sanitizeString(obj);
  }
  
  return obj;
}

// Middleware to sanitize request body, query, and params
function sanitizeInput(req, res, next) {
  try {
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }
    
    if (req.query) {
      req.query = sanitizeObject(req.query);
    }
    
    if (req.params) {
      req.params = sanitizeObject(req.params);
    }
    
    next();
  } catch (error) {
    logger.error('Input sanitization failed', {
      error: error.message,
      ip: req.ip,
      path: req.path
    });
    return res.status(400).json({
      success: false,
      message: 'Invalid input detected'
    });
  }
}

module.exports = { sanitizeInput, sanitizeString, sanitizeObject };
