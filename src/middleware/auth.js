const jwt = require('jsonwebtoken');
const config = require('../config/env');
const logger = require('../utils/logger');

const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Authentication failed: No token provided', {
        ip: req.ip,
        path: req.path
      });
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, config.jwt.secret);

    if (!decoded.userId || !decoded.username || !decoded.role) {
      logger.warn('Authentication failed: Invalid token payload', { ip: req.ip });
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication token'
      });
    }

    req.user = {
      id: decoded.userId,
      username: decoded.username,
      role: decoded.role,
      machineId: decoded.machineId || null
    };

    logger.debug('User authenticated', {
      userId: req.user.id,
      username: req.user.username,
      role: req.user.role
    });

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      logger.warn('Authentication failed: Token expired', {
        ip: req.ip,
        expiredAt: error.expiredAt
      });
      return res.status(401).json({
        success: false,
        message: 'Authentication token expired'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      logger.warn('Authentication failed: Invalid token', {
        ip: req.ip,
        error: error.message
      });
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication token'
      });
    }

    logger.error('Authentication error', {
      error: error.message,
      stack: error.stack
    });
    return res.status(500).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

module.exports = {
  authenticate
};
