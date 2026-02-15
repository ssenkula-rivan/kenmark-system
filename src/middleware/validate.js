const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(err => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value
    }));

    logger.warn('Validation failed', {
      errors: errorMessages,
      userId: req.user?.id,
      path: req.path,
      method: req.method
    });

    // Return more detailed error message
    const firstError = errorMessages[0];
    return res.status(400).json({
      success: false,
      message: `Validation failed: ${firstError.message}`,
      errors: errorMessages
    });
  }

  next();
};

module.exports = {
  validate
};
