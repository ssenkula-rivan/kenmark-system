const logger = require('../utils/logger');

// In-memory rate limiter (simple implementation)
const requestCounts = new Map();
const blockedIPs = new Map();

// Configuration
const RATE_LIMITS = {
  login: { windowMs: 15 * 60 * 1000, maxRequests: 5 }, // 5 attempts per 15 minutes
  api: { windowMs: 60 * 1000, maxRequests: 100 }, // 100 requests per minute
  upload: { windowMs: 60 * 1000, maxRequests: 10 }, // 10 uploads per minute
  strict: { windowMs: 60 * 1000, maxRequests: 30 } // 30 requests per minute for sensitive endpoints
};

const BLOCK_DURATION = 30 * 60 * 1000; // 30 minutes

function getClientIdentifier(req) {
  // Use IP address as identifier
  return req.ip || req.connection.remoteAddress || 'unknown';
}

function isBlocked(identifier) {
  const blockInfo = blockedIPs.get(identifier);
  if (!blockInfo) return false;
  
  if (Date.now() > blockInfo.until) {
    blockedIPs.delete(identifier);
    return false;
  }
  
  return true;
}

function blockClient(identifier, reason) {
  const until = Date.now() + BLOCK_DURATION;
  blockedIPs.set(identifier, { until, reason });
  logger.warn('Client blocked', { identifier, reason, until: new Date(until) });
}

function rateLimiter(limitType = 'api') {
  return (req, res, next) => {
    const identifier = getClientIdentifier(req);
    const config = RATE_LIMITS[limitType] || RATE_LIMITS.api;
    
    // Check if blocked
    if (isBlocked(identifier)) {
      const blockInfo = blockedIPs.get(identifier);
      logger.warn('Blocked client attempted access', {
        identifier,
        path: req.path,
        reason: blockInfo.reason
      });
      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.'
      });
    }
    
    // Get or create request count
    const key = `${identifier}:${limitType}`;
    const now = Date.now();
    let requestData = requestCounts.get(key);
    
    if (!requestData || now > requestData.resetTime) {
      requestData = {
        count: 0,
        resetTime: now + config.windowMs
      };
    }
    
    requestData.count++;
    requestCounts.set(key, requestData);
    
    // Check if limit exceeded
    if (requestData.count > config.maxRequests) {
      logger.warn('Rate limit exceeded', {
        identifier,
        limitType,
        count: requestData.count,
        max: config.maxRequests
      });
      
      // Block after repeated violations
      if (requestData.count > config.maxRequests * 2) {
        blockClient(identifier, `Excessive ${limitType} requests`);
      }
      
      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((requestData.resetTime - now) / 1000)
      });
    }
    
    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', config.maxRequests);
    res.setHeader('X-RateLimit-Remaining', config.maxRequests - requestData.count);
    res.setHeader('X-RateLimit-Reset', new Date(requestData.resetTime).toISOString());
    
    next();
  };
}

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  
  // Clean request counts
  for (const [key, data] of requestCounts.entries()) {
    if (now > data.resetTime) {
      requestCounts.delete(key);
    }
  }
  
  // Clean blocked IPs
  for (const [identifier, blockInfo] of blockedIPs.entries()) {
    if (now > blockInfo.until) {
      blockedIPs.delete(identifier);
    }
  }
}, 5 * 60 * 1000);

module.exports = { rateLimiter };
