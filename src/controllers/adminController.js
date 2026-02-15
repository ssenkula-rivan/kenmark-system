const bcrypt = require('bcryptjs');
const db = require('../config/database');
const reportService = require('../services/reportService');
const pricingService = require('../services/pricingService');
const logger = require('../utils/logger');

class AdminController {
  async getDailySummary(req, res) {
    try {
      const { date } = req.query;
      const targetDate = date || new Date().toISOString().split('T')[0];

      const summary = await reportService.getDailySummary(targetDate);

      return res.status(200).json({
        success: true,
        data: summary
      });
    } catch (error) {
      logger.error('Failed to get daily summary', {
        error: error.message,
        stack: error.stack,
        userId: req.user.id
      });
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve daily summary'
      });
    }
  }

  async getMachineSummary(req, res) {
    try {
      const { date } = req.query;
      const targetDate = date || new Date().toISOString().split('T')[0];

      const summary = await reportService.getMachineSummary(targetDate);

      return res.status(200).json({
        success: true,
        data: summary
      });
    } catch (error) {
      logger.error('Failed to get machine summary', {
        error: error.message,
        stack: error.stack,
        userId: req.user.id
      });
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve machine summary'
      });
    }
  }

  async getWorkerSummary(req, res) {
    try {
      const { date } = req.query;
      const targetDate = date || new Date().toISOString().split('T')[0];

      const summary = await reportService.getWorkerSummary(targetDate);

      return res.status(200).json({
        success: true,
        data: summary
      });
    } catch (error) {
      logger.error('Failed to get worker summary', {
        error: error.message,
        stack: error.stack,
        userId: req.user.id
      });
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve worker summary'
      });
    }
  }

  async getJobTypeSummary(req, res) {
    try {
      const { date } = req.query;
      const targetDate = date || new Date().toISOString().split('T')[0];

      const summary = await reportService.getJobTypeSummary(targetDate);

      return res.status(200).json({
        success: true,
        data: summary
      });
    } catch (error) {
      logger.error('Failed to get job type summary', {
        error: error.message,
        stack: error.stack,
        userId: req.user.id
      });
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve job type summary'
      });
    }
  }

  async getDetailedJobs(req, res) {
    try {
      const { date } = req.query;
      const targetDate = date || new Date().toISOString().split('T')[0];

      const jobs = await reportService.getDetailedJobs(targetDate);

      return res.status(200).json({
        success: true,
        data: jobs
      });
    } catch (error) {
      logger.error('Failed to get detailed jobs', {
        error: error.message,
        stack: error.stack,
        userId: req.user.id
      });
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve detailed jobs'
      });
    }
  }

  async downloadPDFReport(req, res) {
    try {
      const { date } = req.query;
      const targetDate = date || new Date().toISOString().split('T')[0];

      const pdfBuffer = await reportService.generatePDFReport(targetDate);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="report_${targetDate}.pdf"`);
      res.send(pdfBuffer);

      logger.info('PDF report downloaded', {
        date: targetDate,
        userId: req.user.id
      });
    } catch (error) {
      logger.error('Failed to download PDF report', {
        error: error.message,
        stack: error.stack,
        userId: req.user.id
      });
      return res.status(500).json({
        success: false,
        message: 'Failed to generate PDF report'
      });
    }
  }

  async downloadExcelReport(req, res) {
    try {
      const { date } = req.query;
      const targetDate = date || new Date().toISOString().split('T')[0];

      const excelBuffer = await reportService.generateExcelReport(targetDate);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="report_${targetDate}.xlsx"`);
      res.send(excelBuffer);

      logger.info('Excel report downloaded', {
        date: targetDate,
        userId: req.user.id
      });
    } catch (error) {
      logger.error('Failed to download Excel report', {
        error: error.message,
        stack: error.stack,
        userId: req.user.id
      });
      return res.status(500).json({
        success: false,
        message: 'Failed to generate Excel report'
      });
    }
  }

  async getAllPricing(req, res) {
    try {
      const pricing = await pricingService.getAllPricing();

      return res.status(200).json({
        success: true,
        data: pricing
      });
    } catch (error) {
      logger.error('Failed to get pricing', {
        error: error.message,
        stack: error.stack,
        userId: req.user.id
      });
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve pricing'
      });
    }
  }

  async updatePricing(req, res) {
    try {
      const { id } = req.params;
      const { rate, active } = req.body;

      if (rate !== undefined && (rate <= 0 || isNaN(rate))) {
        return res.status(400).json({
          success: false,
          message: 'Rate must be a positive number'
        });
      }

      await pricingService.updatePricing(
        parseInt(id, 10),
        rate !== undefined ? parseFloat(rate) : undefined,
        active
      );

      return res.status(200).json({
        success: true,
        message: 'Pricing updated successfully'
      });
    } catch (error) {
      logger.error('Failed to update pricing', {
        error: error.message,
        stack: error.stack,
        userId: req.user.id
      });
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to update pricing'
      });
    }
  }

  async createPricing(req, res) {
    try {
      const { job_type_id, rate, rate_unit, active = true } = req.body;

      if (!job_type_id || !rate || !rate_unit) {
        return res.status(400).json({
          success: false,
          message: 'Job type ID, rate, and rate unit are required'
        });
      }

      if (rate <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Rate must be a positive number'
        });
      }

      if (!['per_sqm', 'per_piece'].includes(rate_unit)) {
        return res.status(400).json({
          success: false,
          message: 'Rate unit must be either per_sqm or per_piece'
        });
      }

      const pricingId = await pricingService.createPricing(
        parseInt(job_type_id, 10),
        parseFloat(rate),
        rate_unit,
        active
      );

      return res.status(201).json({
        success: true,
        message: 'Pricing created successfully',
        data: { pricingId }
      });
    } catch (error) {
      logger.error('Failed to create pricing', {
        error: error.message,
        stack: error.stack,
        userId: req.user.id
      });
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to create pricing'
      });
    }
  }

  async createUser(req, res) {
    try {
      const { name, username, password, role, machine_id, department } = req.body;

      if (!name || !username || !password || !role) {
        return res.status(400).json({
          success: false,
          message: 'Name, username, password, and role are required'
        });
      }

      if (!['admin', 'worker'].includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'Role must be either admin or worker'
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long'
        });
      }

      const existingUsers = await db.query(
        'SELECT id FROM users WHERE username = ?',
        [username]
      );

      if (existingUsers.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Username already exists'
        });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const result = await db.query(
        'INSERT INTO users (name, username, password_hash, role, department, machine_id) VALUES (?, ?, ?, ?, ?, ?)',
        [name, username, passwordHash, role, department || null, machine_id || null]
      );

      logger.info('User created', {
        userId: result.insertId,
        username,
        role,
        department,
        createdBy: req.user.id
      });

      return res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: {
          id: result.insertId,
          name,
          username,
          role,
          department
        }
      });
    } catch (error) {
      logger.error('Failed to create user', {
        error: error.message,
        stack: error.stack,
        userId: req.user.id
      });
      return res.status(500).json({
        success: false,
        message: 'Failed to create user'
      });
    }
  }

  async deleteUser(req, res) {
    try {
      const { id } = req.params;
      const adminId = req.user.id;

      // Prevent admin from deleting themselves
      if (parseInt(id) === adminId) {
        return res.status(400).json({
          success: false,
          message: 'You cannot delete your own account. Use self-delete instead.'
        });
      }

      // Check if user exists
      const users = await db.query('SELECT id, username, role FROM users WHERE id = ?', [id]);
      
      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const userToDelete = users[0];

      // Delete the user (CASCADE will handle related records)
      await db.query('DELETE FROM users WHERE id = ?', [id]);

      logger.info('User deleted by admin', {
        deletedUserId: id,
        deletedUsername: userToDelete.username,
        deletedRole: userToDelete.role,
        deletedBy: adminId
      });

      return res.json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error) {
      logger.error('Failed to delete user', {
        error: error.message,
        stack: error.stack,
        userId: req.user.id
      });
      return res.status(500).json({
        success: false,
        message: 'Failed to delete user'
      });
    }
  }

  async getAllUsers(req, res) {
    try {
      const users = await db.query(`
        SELECT 
          u.id,
          u.name,
          u.username,
          u.role,
          u.machine_id,
          u.last_active,
          m.name as machine_name,
          u.created_at
        FROM users u
        LEFT JOIN machines m ON u.machine_id = m.id
        ORDER BY 
          CASE WHEN u.last_active IS NULL THEN 1 ELSE 0 END,
          u.last_active DESC,
          u.role,
          u.name
      `);

      return res.status(200).json({
        success: true,
        data: users
      });
    } catch (error) {
      logger.error('Failed to get users', {
        error: error.message,
        stack: error.stack,
        userId: req.user.id
      });
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve users'
      });
    }
  }

  async createMachine(req, res) {
    try {
      const { name, type, status = 'active' } = req.body;

      if (!name || !type) {
        return res.status(400).json({
          success: false,
          message: 'Name and type are required'
        });
      }

      if (!['large_format', 'digital_press'].includes(type)) {
        return res.status(400).json({
          success: false,
          message: 'Type must be either large_format or digital_press'
        });
      }

      if (!['active', 'inactive'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Status must be either active or inactive'
        });
      }

      const result = await db.query(
        'INSERT INTO machines (name, type, status) VALUES (?, ?, ?)',
        [name, type, status]
      );

      logger.info('Machine created', {
        machineId: result.insertId,
        name,
        type,
        createdBy: req.user.id
      });

      return res.status(201).json({
        success: true,
        message: 'Machine created successfully',
        data: { machineId: result.insertId }
      });
    } catch (error) {
      logger.error('Failed to create machine', {
        error: error.message,
        stack: error.stack,
        userId: req.user.id
      });
      return res.status(500).json({
        success: false,
        message: 'Failed to create machine'
      });
    }
  }

  async getAllMachines(req, res) {
    try {
      const machines = await db.query(`
        SELECT 
          id,
          name,
          type,
          status,
          created_at
        FROM machines
        ORDER BY type, name
      `);

      return res.status(200).json({
        success: true,
        data: machines
      });
    } catch (error) {
      logger.error('Failed to get machines', {
        error: error.message,
        stack: error.stack,
        userId: req.user.id
      });
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve machines'
      });
    }
  }

  async getAuditLogs(req, res) {
    try {
      const { startDate, endDate, userId, action, limit = 100, offset = 0 } = req.query;

      let query = `
        SELECT 
          al.id,
          al.user_id,
          u.username,
          u.name as user_name,
          al.action,
          al.details,
          al.ip_address,
          al.created_at
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE 1=1
      `;

      const params = [];

      if (startDate && endDate) {
        query += ' AND al.created_at BETWEEN ? AND ?';
        params.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
      }

      if (userId) {
        query += ' AND al.user_id = ?';
        params.push(parseInt(userId, 10));
      }

      if (action) {
        query += ' AND al.action = ?';
        params.push(action);
      }

      query += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit, 10), parseInt(offset, 10));

      const logs = await db.query(query, params);

      return res.status(200).json({
        success: true,
        data: logs
      });
    } catch (error) {
      logger.error('Failed to get audit logs', {
        error: error.message,
        stack: error.stack,
        userId: req.user.id
      });
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve audit logs'
      });
    }
  }

  // Backup & Restore Management
  async createBackup(req, res) {
    try {
      const backup = require('../utils/backup');
      
      logger.info('Creating system backup', { userId: req.user.id });
      
      const result = await backup.createFullBackup();
      
      res.json({
        success: true,
        message: 'Backup created successfully',
        data: result
      });
    } catch (error) {
      logger.error('Failed to create backup', {
        error: error.message,
        stack: error.stack,
        userId: req.user.id
      });
      res.status(500).json({
        success: false,
        message: 'Failed to create backup'
      });
    }
  }

  async listBackups(req, res) {
    try {
      const backup = require('../utils/backup');
      const backups = backup.listBackups();
      
      res.json({
        success: true,
        data: backups
      });
    } catch (error) {
      logger.error('Failed to list backups', {
        error: error.message,
        userId: req.user.id
      });
      res.status(500).json({
        success: false,
        message: 'Failed to list backups'
      });
    }
  }

  async restoreBackup(req, res) {
    try {
      const { database, files } = req.body;
      const backup = require('../utils/backup');
      
      logger.info('Restoring backup', {
        database,
        files,
        userId: req.user.id
      });

      const results = {};

      if (database) {
        await backup.restoreDatabase(database);
        results.database = 'restored';
      }

      if (files) {
        await backup.restoreFiles(files);
        results.files = 'restored';
      }

      res.json({
        success: true,
        message: 'Backup restored successfully',
        data: results
      });
    } catch (error) {
      logger.error('Failed to restore backup', {
        error: error.message,
        stack: error.stack,
        userId: req.user.id
      });
      res.status(500).json({
        success: false,
        message: 'Failed to restore backup: ' + error.message
      });
    }
  }

  async deleteBackup(req, res) {
    try {
      const { filename } = req.params;
      const fs = require('fs');
      const path = require('path');
      const backupPath = path.join(__dirname, '../../backups', filename);

      if (!fs.existsSync(backupPath)) {
        return res.status(404).json({
          success: false,
          message: 'Backup file not found'
        });
      }

      fs.unlinkSync(backupPath);

      logger.info('Backup deleted', {
        filename,
        userId: req.user.id
      });

      res.json({
        success: true,
        message: 'Backup deleted successfully'
      });
    } catch (error) {
      logger.error('Failed to delete backup', {
        error: error.message,
        userId: req.user.id
      });
      res.status(500).json({
        success: false,
        message: 'Failed to delete backup'
      });
    }
  }

  // System Health & Monitoring
  async getSystemHealth(req, res) {
    try {
      const os = require('os');
      const fileCleanup = require('../utils/fileCleanup');
      
      const diskUsage = fileCleanup.getDiskUsage();
      const diskSpaceOk = fileCleanup.checkDiskSpace();

      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: {
          total: os.totalmem(),
          free: os.freemem(),
          used: os.totalmem() - os.freemem(),
          usagePercent: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2)
        },
        cpu: {
          cores: os.cpus().length,
          model: os.cpus()[0].model,
          loadAverage: os.loadavg()
        },
        disk: diskUsage,
        diskSpaceOk,
        platform: os.platform(),
        nodeVersion: process.version
      };

      res.json({
        success: true,
        data: health
      });
    } catch (error) {
      logger.error('Failed to get system health', {
        error: error.message,
        userId: req.user.id
      });
      res.status(500).json({
        success: false,
        message: 'Failed to get system health'
      });
    }
  }

  async getDiskUsage(req, res) {
    try {
      const fileCleanup = require('../utils/fileCleanup');
      const usage = fileCleanup.getDiskUsage();

      res.json({
        success: true,
        data: usage
      });
    } catch (error) {
      logger.error('Failed to get disk usage', {
        error: error.message,
        userId: req.user.id
      });
      res.status(500).json({
        success: false,
        message: 'Failed to get disk usage'
      });
    }
  }

  async cleanupSystem(req, res) {
    try {
      const { cleanLogs = true, cleanOrphanedFiles = true, logsDaysOld = 30 } = req.body;
      const fileCleanup = require('../utils/fileCleanup');
      const db = require('../config/database');

      logger.info('Starting system cleanup', {
        cleanLogs,
        cleanOrphanedFiles,
        logsDaysOld,
        userId: req.user.id
      });

      const results = {};

      if (cleanLogs) {
        results.logs = await fileCleanup.cleanOldLogs(logsDaysOld);
      }

      if (cleanOrphanedFiles) {
        results.orphanedFiles = await fileCleanup.cleanOrphanedUploads(db);
      }

      logger.info('System cleanup completed', {
        results,
        userId: req.user.id
      });

      res.json({
        success: true,
        message: 'System cleanup completed',
        data: results
      });
    } catch (error) {
      logger.error('System cleanup failed', {
        error: error.message,
        stack: error.stack,
        userId: req.user.id
      });
      res.status(500).json({
        success: false,
        message: 'System cleanup failed'
      });
    }
  }
}

module.exports = new AdminController();
