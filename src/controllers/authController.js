const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const config = require('../config/env');
const logger = require('../utils/logger');
const { recordLoginAttempt } = require('../middleware/loginAttempts');

class AuthController {
  async login(req, res) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: 'Username and password are required'
        });
      }

      const users = await db.query(
        'SELECT id, name, username, password_hash, role, department, machine_id FROM users WHERE username = ?',
        [username]
      );

      if (users.length === 0) {
        logger.warn('Login failed: User not found', { username, ip: req.ip });
        recordLoginAttempt(username, req.ip, false);
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      const user = users[0];
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);

      if (!isPasswordValid) {
        logger.warn('Login failed: Invalid password', { username, userId: user.id, ip: req.ip });
        const attemptResult = recordLoginAttempt(username, req.ip, false);
        
        if (attemptResult.locked) {
          return res.status(429).json({
            success: false,
            message: 'Account locked due to too many failed login attempts. Please try again in 30 minutes.'
          });
        }
        
        return res.status(401).json({
          success: false,
          message: `Invalid credentials. ${attemptResult.remainingAttempts} attempts remaining.`
        });
      }

      // Record successful login
      recordLoginAttempt(username, req.ip, true);

      const token = jwt.sign(
        {
          userId: user.id,
          username: user.username,
          role: user.role,
          department: user.department,
          machineId: user.machine_id
        },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
      );

      // Update last_active timestamp
      await db.query(
        'UPDATE users SET last_active = NOW() WHERE id = ?',
        [user.id]
      );

      logger.info('User logged in successfully', {
        userId: user.id,
        username: user.username,
        role: user.role,
        ip: req.ip
      });

      return res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          token,
          user: {
            id: user.id,
            name: user.name,
            username: user.username,
            role: user.role,
            department: user.department,
            machineId: user.machine_id
          }
        }
      });
    } catch (error) {
      logger.error('Login error', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        message: 'Login failed'
      });
    }
  }

  async logout(req, res) {
    try {
      logger.info('User logged out', {
        userId: req.user.id,
        username: req.user.username,
        ip: req.ip
      });

      return res.status(200).json({
        success: true,
        message: 'Logout successful'
      });
    } catch (error) {
      logger.error('Logout error', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        message: 'Logout failed'
      });
    }
  }

  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.id;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password and new password are required'
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'New password must be at least 8 characters long'
        });
      }

      const users = await db.query(
        'SELECT password_hash FROM users WHERE id = ?',
        [userId]
      );

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, users[0].password_hash);

      if (!isCurrentPasswordValid) {
        logger.warn('Password change failed: Invalid current password', {
          userId,
          ip: req.ip
        });
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }

      const newPasswordHash = await bcrypt.hash(newPassword, 12);

      await db.query(
        'UPDATE users SET password_hash = ? WHERE id = ?',
        [newPasswordHash, userId]
      );

      logger.info('Password changed successfully', {
        userId,
        username: req.user.username,
        ip: req.ip
      });

      return res.status(200).json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      logger.error('Password change error', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        message: 'Password change failed'
      });
    }
  }

  async deleteAccount(req, res) {
    try {
      const { password } = req.body;
      const userId = req.user.id;
      const username = req.user.username;

      if (!password) {
        return res.status(400).json({
          success: false,
          message: 'Password is required to delete account'
        });
      }

      // Verify password
      const users = await db.query(
        'SELECT password_hash FROM users WHERE id = ?',
        [userId]
      );

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const isPasswordValid = await bcrypt.compare(password, users[0].password_hash);

      if (!isPasswordValid) {
        logger.warn('Account deletion failed: Invalid password', {
          userId,
          username,
          ip: req.ip
        });
        return res.status(401).json({
          success: false,
          message: 'Password is incorrect'
        });
      }

      // Delete the account
      await db.query('DELETE FROM users WHERE id = ?', [userId]);

      logger.info('User deleted their own account', {
        userId,
        username,
        ip: req.ip
      });

      return res.status(200).json({
        success: true,
        message: 'Account deleted successfully'
      });
    } catch (error) {
      logger.error('Account deletion error', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        message: 'Account deletion failed'
      });
    }
  }
}

module.exports = new AuthController();
