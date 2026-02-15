const express = require('express');
const { body, query } = require('express-validator');
const jobsController = require('../controllers/jobsController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { validate } = require('../middleware/validate');
const { auditLog } = require('../middleware/auditLog');

const router = express.Router();

router.post('/',
  authenticate,
  authorize('worker'),
  [
    body('job_type_id')
      .isInt({ min: 1 })
      .withMessage('Valid job type ID is required'),
    body('description')
      .trim()
      .notEmpty()
      .withMessage('Description is required')
      .isLength({ max: 1000 })
      .withMessage('Description must not exceed 1000 characters'),
    body('rate')
      .isFloat({ min: 0.01 })
      .withMessage('Valid rate is required'),
    body('width_cm')
      .optional()
      .isFloat({ min: 0.1, max: 10000 })
      .withMessage('Width must be between 0.1 and 10000 cm'),
    body('height_cm')
      .optional()
      .isFloat({ min: 0.1, max: 10000 })
      .withMessage('Height must be between 0.1 and 10000 cm'),
    body('quantity')
      .optional()
      .isInt({ min: 1, max: 1000000 })
      .withMessage('Quantity must be between 1 and 1000000')
  ],
  validate,
  auditLog('job_create'),
  jobsController.createJob
);

router.get('/my-jobs',
  authenticate,
  authorize('worker'),
  [
    query('startDate')
      .optional()
      .isDate()
      .withMessage('Start date must be a valid date'),
    query('endDate')
      .optional()
      .isDate()
      .withMessage('End date must be a valid date'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 500 })
      .withMessage('Limit must be between 1 and 500'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be a non-negative integer')
  ],
  validate,
  jobsController.getMyJobs
);

router.get('/my-daily-total',
  authenticate,
  authorize('worker'),
  [
    query('date')
      .optional()
      .isDate()
      .withMessage('Date must be a valid date')
  ],
  validate,
  jobsController.getMyDailyTotal
);

router.get('/job-types',
  authenticate,
  authorize('worker'),
  jobsController.getJobTypes
);

module.exports = router;
