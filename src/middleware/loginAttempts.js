const logger = require('../utils/logger');

// In-memory storage for login attempts
const loginAttempts = new Map();
const lockedAccounts = new Map();

const MAX_ATTEMPTS = 10;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
const ATTEMPT_WINDOW = 15 * 60 * 1000; // 15 minutes

function getAttemptKey(username, ip) {
  return `${username}:${ip}`;
}

function isAccountLocked(username) {
  const lockInfo = lockedAccounts.get(username);
  if (!lockInfo) return false;
  
  if (Date.now() > lockInfo.until) {
    lockedAccounts.delete(username);
    return false;
  }
  
  return true;
}

function lockAccount(username, reason) {
  const until = Date.now() + LOCKOUT_DURATION;
  lockedAccounts.set(username, { until, reason });
  logger.warn('Account locked', { username, reason, until: new Date(until) });
}

function recordLoginAttempt(username, ip, success) {
  const key = getAttemptKey(username, ip);
  const now = Date.now();
  
  let attempts = loginAttempts.get(key);
  
  if (!attempts || now > attempts.resetTime) {
    attempts = {
      count: 0,
      resetTime: now + ATTEMPT_WINDOW,
      failures: []
    };
  }
  
  if (success) {
    // Clear attempts on successful login
    loginAttempts.delete(key);
    lockedAccounts.delete(username);
    return { allowed: true };
  }
  
  // Record failed attempt
  attempts.count++;
  attempts.failures.push(now);
  loginAttempts.set(key, attempts);
  
  logger.warn('Failed login attempt', {
    username,
    ip,
    attemptCount: attempts.count,
    maxAttempts: MAX_ATTEMPTS
  });
  
  // Check if should lock account
  if (attempts.count >= MAX_ATTEMPTS) {
    lockAccount(username, 'Too many failed login attempts');
    return {
      allowed: false,
      locked: true,
      remainingAttempts: 0
    };
  }
  
  return {
    allowed: true,
    remainingAttempts: MAX_ATTEMPTS - attempts.count
  };
}

function checkLoginAllowed(req, res, next) {
  const { username } = req.body;
  
  if (!username) {
    return next();
  }
  
  // Check if account is locked
  if (isAccountLocked(username)) {
    const lockInfo = lockedAccounts.get(username);
    const minutesRemaining = Math.ceil((lockInfo.until - Date.now()) / 60000);
    
    logger.warn('Login attempt on locked account', {
      username,
      ip: req.ip,
      minutesRemaining
    });
    
    return res.status(429).json({
      success: false,
      message: `Account is temporarily locked due to too many failed login attempts. Please try again in ${minutesRemaining} minutes.`
    });
  }
  
  next();
}

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  
  // Clean login attempts
  for (const [key, data] of loginAttempts.entries()) {
    if (now > data.resetTime) {
      loginAttempts.delete(key);
    }
  }
  
  // Clean locked accounts
  for (const [username, lockInfo] of lockedAccounts.entries()) {
    if (now > lockInfo.until) {
      lockedAccounts.delete(username);
      logger.info('Account unlocked', { username });
    }
  }
}, 5 * 60 * 1000);

module.exports = {
  checkLoginAllowed,
  recordLoginAttempt,
  isAccountLocked
};
