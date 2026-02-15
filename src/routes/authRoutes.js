const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { auditLog } = require('../middleware/auditLog');
const { checkLoginAllowed } = require('../middleware/loginAttempts');

const router = express.Router();

router.post('/login',
  checkLoginAllowed,
  [
    body('username')
      .trim()
      .notEmpty()
      .withMessage('Username is required')
      .isLength({ min: 3, max: 100 })
      .withMessage('Username must be between 3 and 100 characters'),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
  ],
  validate,
  auditLog('user_login'),
  authController.login
);

router.post('/logout',
  authenticate,
  auditLog('user_logout'),
  authController.logout
);

router.post('/change-password',
  authenticate,
  [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .notEmpty()
      .withMessage('New password is required')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters long')
  ],
  validate,
  auditLog('password_change'),
  authController.changePassword
);

router.post('/delete-account',
  authenticate,
  [
    body('password')
      .notEmpty()
      .withMessage('Password is required to delete account')
  ],
  validate,
  auditLog('account_delete'),
  authController.deleteAccount
);

module.exports = router;

router.get('/machines', async (req, res) => {
  try {
    const db = require('../config/database');
    const machines = await db.query('SELECT id, name, type FROM machines WHERE status = "active"');
    res.json({
      success: true,
      data: machines
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch machines'
    });
  }
});
