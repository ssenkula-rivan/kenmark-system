const logger = require('../utils/logger');

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      logger.error('Authorization check failed: No user in request', { path: req.path });
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('Authorization denied', {
        userId: req.user.id,
        username: req.user.username,
        userRole: req.user.role,
        requiredRoles: allowedRoles,
        path: req.path,
        method: req.method
      });
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    logger.debug('Authorization granted', {
      userId: req.user.id,
      role: req.user.role,
      path: req.path
    });

    next();
  };
};

module.exports = {
  authorize
};
