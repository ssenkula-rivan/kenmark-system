const express = require('express');
const { body, query, param } = require('express-validator');
const adminController = require('../controllers/adminController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { validate } = require('../middleware/validate');
const { auditLog } = require('../middleware/auditLog');

const router = express.Router();

// Reports - Summary endpoints
router.get('/daily-summary',
  authenticate,
  authorize('admin'),
  [
    query('date')
      .optional()
      .isDate()
      .withMessage('Date must be a valid date')
  ],
  validate,
  adminController.getDailySummary
);

router.get('/machine-summary',
  authenticate,
  authorize('admin'),
  [
    query('date')
      .optional()
      .isDate()
      .withMessage('Date must be a valid date')
  ],
  validate,
  adminController.getMachineSummary
);

router.get('/worker-summary',
  authenticate,
  authorize('admin'),
  [
    query('date')
      .optional()
      .isDate()
      .withMessage('Date must be a valid date')
  ],
  validate,
  adminController.getWorkerSummary
);

router.get('/job-type-summary',
  authenticate,
  authorize('admin'),
  [
    query('date')
      .optional()
      .isDate()
      .withMessage('Date must be a valid date')
  ],
  validate,
  adminController.getJobTypeSummary
);

router.get('/detailed-jobs',
  authenticate,
  authorize('admin'),
  [
    query('date')
      .optional()
      .isDate()
      .withMessage('Date must be a valid date')
  ],
  validate,
  adminController.getDetailedJobs
);

// Reports - Download endpoints
router.get('/reports/pdf',
  authenticate,
  authorize('admin'),
  [
    query('date')
      .optional()
      .isDate()
      .withMessage('Date must be a valid date')
  ],
  validate,
  auditLog('report_download_pdf'),
  adminController.downloadPDFReport
);

router.get('/reports/excel',
  authenticate,
  authorize('admin'),
  [
    query('date')
      .optional()
      .isDate()
      .withMessage('Date must be a valid date')
  ],
  validate,
  auditLog('report_download_excel'),
  adminController.downloadExcelReport
);

// Pricing
router.get('/pricing',
  authenticate,
  authorize('admin'),
  adminController.getAllPricing
);

router.post('/pricing',
  authenticate,
  authorize('admin'),
  [
    body('job_type_id')
      .isInt({ min: 1 })
      .withMessage('Valid job type ID is required'),
    body('rate')
      .isFloat({ min: 0.01 })
      .withMessage('Rate must be a positive number'),
    body('rate_unit')
      .isIn(['per_sqm', 'per_piece'])
      .withMessage('Rate unit must be per_sqm or per_piece'),
    body('active')
      .optional()
      .isBoolean()
      .withMessage('Active must be a boolean')
  ],
  validate,
  auditLog('pricing_create'),
  adminController.createPricing
);

router.put('/pricing/:id',
  authenticate,
  authorize('admin'),
  [
    param('id')
      .isInt({ min: 1 })
      .withMessage('Valid pricing ID is required'),
    body('rate')
      .optional()
      .isFloat({ min: 0.01 })
      .withMessage('Rate must be a positive number'),
    body('active')
      .optional()
      .isBoolean()
      .withMessage('Active must be a boolean')
  ],
  validate,
  auditLog('pricing_update'),
  adminController.updatePricing
);

// Users
router.get('/users',
  authenticate,
  authorize('admin'),
  adminController.getAllUsers
);

router.post('/users',
  authenticate,
  authorize('admin'),
  [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Name is required')
      .isLength({ max: 255 })
      .withMessage('Name must not exceed 255 characters'),
    body('username')
      .trim()
      .notEmpty()
      .withMessage('Username is required')
      .isLength({ min: 3, max: 100 })
      .withMessage('Username must be between 3 and 100 characters')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username can only contain letters, numbers, and underscores'),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long'),
    body('role')
      .isIn(['admin', 'worker'])
      .withMessage('Role must be admin or worker'),
    body('machine_id')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Valid machine ID is required')
  ],
  validate,
  auditLog('user_create'),
  adminController.createUser
);

// Machines
router.get('/machines',
  authenticate,
  authorize('admin'),
  adminController.getAllMachines
);

router.post('/machines',
  authenticate,
  authorize('admin'),
  [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Name is required')
      .isLength({ max: 255 })
      .withMessage('Name must not exceed 255 characters'),
    body('type')
      .isIn(['large_format', 'digital_press'])
      .withMessage('Type must be large_format or digital_press'),
    body('status')
      .optional()
      .isIn(['active', 'inactive'])
      .withMessage('Status must be active or inactive')
  ],
  validate,
  auditLog('machine_create'),
  adminController.createMachine
);

// Audit Logs
router.get('/audit-logs',
  authenticate,
  authorize('admin'),
  [
    query('startDate')
      .optional()
      .isDate()
      .withMessage('Start date must be a valid date'),
    query('endDate')
      .optional()
      .isDate()
      .withMessage('End date must be a valid date'),
    query('userId')
      .optional()
      .isInt({ min: 1 })
      .withMessage('User ID must be a positive integer'),
    query('action')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Action cannot be empty'),
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
  adminController.getAuditLogs
);

module.exports = router;

// Backup & Restore Management
router.post('/backup/create',
  authenticate,
  authorize('admin'),
  auditLog('backup_create'),
  adminController.createBackup
);

router.get('/backup/list',
  authenticate,
  authorize('admin'),
  adminController.listBackups
);

router.post('/backup/restore',
  authenticate,
  authorize('admin'),
  [
    body('database')
      .optional()
      .isString()
      .withMessage('Database backup file must be a string'),
    body('files')
      .optional()
      .isString()
      .withMessage('Files backup file must be a string')
  ],
  validate,
  auditLog('backup_restore'),
  adminController.restoreBackup
);

router.delete('/backup/:filename',
  authenticate,
  authorize('admin'),
  [
    param('filename')
      .notEmpty()
      .withMessage('Filename is required')
  ],
  validate,
  auditLog('backup_delete'),
  adminController.deleteBackup
);

// System Health & Monitoring
router.get('/system/health',
  authenticate,
  authorize('admin'),
  adminController.getSystemHealth
);

router.get('/system/disk-usage',
  authenticate,
  authorize('admin'),
  adminController.getDiskUsage
);

router.post('/system/cleanup',
  authenticate,
  authorize('admin'),
  [
    body('cleanLogs')
      .optional()
      .isBoolean()
      .withMessage('cleanLogs must be a boolean'),
    body('cleanOrphanedFiles')
      .optional()
      .isBoolean()
      .withMessage('cleanOrphanedFiles must be a boolean'),
    body('logsDaysOld')
      .optional()
      .isInt({ min: 1 })
      .withMessage('logsDaysOld must be a positive integer')
  ],
  validate,
  auditLog('system_cleanup'),
  adminController.cleanupSystem
);
