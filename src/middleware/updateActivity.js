const db = require('../config/database');

const updateActivity = async (req, res, next) => {
  if (req.user && req.user.id) {
    try {
      // Update last_active timestamp asynchronously (don't wait)
      db.query('UPDATE users SET last_active = NOW() WHERE id = ?', [req.user.id])
        .catch(err => logger.error('Failed to update last_active', { error: err.message }));
    } catch (error) {
      // Silently fail - don't block the request
    }
  }
  next();
};

module.exports = updateActivity;
