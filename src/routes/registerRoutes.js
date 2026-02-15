const express = require('express');
const { body } = require('express-validator');
const registerController = require('../controllers/registerController');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.post(
  '/register',
  [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Name is required')
      .isLength({ min: 2, max: 255 })
      .withMessage('Name must be between 2 and 255 characters'),
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
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
    body('department')
      .trim()
      .notEmpty()
      .withMessage('Department is required'),
    body('machine_id')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Invalid machine ID')
  ],
  validate,
  registerController.register
);

router.get('/departments', registerController.getDepartments);

router.get('/machines', registerController.getMachines);

module.exports = router;
