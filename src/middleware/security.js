const logger = require('../utils/logger');

// Security headers middleware
function securityHeaders(req, res, next) {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Strict Transport Security (HTTPS only)
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  // Content Security Policy
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: blob:; " +
    "font-src 'self' data:; " +
    "connect-src 'self'; " +
    "frame-ancestors 'none';"
  );
  
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions Policy
  res.setHeader('Permissions-Policy', 
    'geolocation=(), microphone=(), camera=(), payment=()'
  );
  
  // Remove powered-by header
  res.removeHeader('X-Powered-By');
  
  next();
}

// CORS configuration for LAN-only access
function corsMiddleware(req, res, next) {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173'
  ];
  
  // Add LAN IP ranges if configured
  if (process.env.ALLOWED_ORIGINS) {
    allowedOrigins.push(...process.env.ALLOWED_ORIGINS.split(','));
  }
  
  const origin = req.headers.origin;
  
  if (allowedOrigins.includes(origin) || !origin) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  }
  
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  next();
}

// Request logging for security audit
function securityLogger(req, res, next) {
  const startTime = Date.now();
  
  // Log request
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    userId: req.user?.id
  });
  
  // Log response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
    
    logger[logLevel]('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
      userId: req.user?.id
    });
  });
  
  next();
}

// Detect suspicious activity
function suspiciousActivityDetector(req, res, next) {
  const suspiciousPatterns = [
    /\.\.\//g, // Directory traversal
    /%00/g, // Null byte
    /%2e%2e/gi, // Encoded directory traversal
    /\beval\b/gi, // Code injection
    /\bexec\b/gi,
    /<script/gi, // XSS
    /javascript:/gi
  ];
  
  const checkString = `${req.path}${JSON.stringify(req.query)}${JSON.stringify(req.body)}`;
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(checkString)) {
      logger.error('Suspicious activity detected', {
        pattern: pattern.toString(),
        ip: req.ip,
        path: req.path,
        userAgent: req.headers['user-agent']
      });
      
      return res.status(403).json({
        success: false,
        message: 'Forbidden'
      });
    }
  }
  
  next();
}

module.exports = {
  securityHeaders,
  corsMiddleware,
  securityLogger,
  suspiciousActivityDetector
};
