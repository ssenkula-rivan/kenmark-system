const db = require('../config/database');
const logger = require('../utils/logger');

const auditLog = (action) => {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = function(data) {
      res.locals.responseData = data;
      return originalJson(data);
    };

    res.on('finish', async () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          const userId = req.user?.id || null;
          const ipAddress = req.ip || req.connection.remoteAddress;
          const userAgent = req.headers['user-agent'] || null;

          let details = {
            method: req.method,
            path: req.path,
            body: req.body,
            query: req.query,
            params: req.params
          };

          if (req.body && req.body.password) {
            details.body = { ...req.body, password: '[REDACTED]' };
          }

          if (req.body && req.body.password_hash) {
            details.body = { ...req.body, password_hash: '[REDACTED]' };
          }

          await db.query(
            'INSERT INTO audit_logs (user_id, action, details, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)',
            [userId, action, JSON.stringify(details), ipAddress, userAgent]
          );

          logger.info('Audit log created', {
            userId,
            action,
            path: req.path,
            method: req.method
          });
        } catch (error) {
          logger.error('Failed to create audit log', {
            error: error.message,
            action,
            userId: req.user?.id
          });
        }
      }
    });

    next();
  };
};

module.exports = {
  auditLog
};
