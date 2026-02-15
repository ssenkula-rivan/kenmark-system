const db = require('../config/database');
const calculationService = require('../services/calculationService');
const pricingService = require('../services/pricingService');
const logger = require('../utils/logger');

class JobsController {
  async createJob(req, res) {
    try {
      const { job_type_id, description, width_cm, height_cm, quantity, rate: manualRate } = req.body;
      const workerId = req.user.id;
      const machineId = req.user.machineId;

      if (!machineId) {
        return res.status(400).json({
          success: false,
          message: 'Worker has no assigned machine'
        });
      }

      if (!job_type_id || !description) {
        return res.status(400).json({
          success: false,
          message: 'Job type and description are required'
        });
      }

      if (!manualRate || parseFloat(manualRate) <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Valid rate is required'
        });
      }

      const jobTypes = await db.query(`
        SELECT jt.*, m.type as machine_type 
        FROM job_types jt
        INNER JOIN machines m ON jt.machine_type = m.type
        WHERE jt.id = ? AND m.id = ?
      `, [job_type_id, machineId]);

      if (jobTypes.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid job type for assigned machine'
        });
      }

      const jobType = jobTypes[0];
      const rate = parseFloat(manualRate);

      const dimensions = {
        width_cm: width_cm ? parseFloat(width_cm) : null,
        height_cm: height_cm ? parseFloat(height_cm) : null,
        quantity: quantity ? parseInt(quantity, 10) : null
      };

      // Calculate amount
      const calculation = calculationService.calculateJobAmount(
        jobType.machine_type,
        dimensions,
        rate
      );

      const result = await db.query(`
        INSERT INTO jobs 
        (worker_id, machine_id, job_type_id, description, width_cm, height_cm, quantity, rate, amount) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        workerId,
        machineId,
        job_type_id,
        description,
        dimensions.width_cm,
        dimensions.height_cm,
        dimensions.quantity,
        rate,
        calculation.amount
      ]);

      logger.info('Job created', {
        jobId: result.insertId,
        workerId,
        machineId,
        jobTypeId: job_type_id,
        amount: calculation.amount
      });

      return res.status(201).json({
        success: true,
        message: 'Job created successfully',
        data: {
          jobId: result.insertId,
          amount: calculation.amount
        }
      });
    } catch (error) {
      logger.error('Job creation failed', {
        error: error.message,
        stack: error.stack,
        userId: req.user.id
      });
      return res.status(500).json({
        success: false,
        message: error.message || 'Job creation failed'
      });
    }
  }

  async getMyJobs(req, res) {
    try {
      const workerId = req.user.id;
      const { startDate, endDate, limit = 100, offset = 0 } = req.query;

      let query = `
        SELECT 
          j.id,
          j.description,
          jt.name as job_type_name,
          jt.unit,
          m.name as machine_name,
          j.width_cm,
          j.height_cm,
          j.quantity,
          j.rate,
          j.amount,
          j.created_at
        FROM jobs j
        INNER JOIN job_types jt ON j.job_type_id = jt.id
        INNER JOIN machines m ON j.machine_id = m.id
        WHERE j.worker_id = ?
      `;

      const params = [workerId];

      if (startDate && endDate) {
        query += ' AND j.created_at BETWEEN ? AND ?';
        params.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
      }

      const limitNum = parseInt(limit, 10);
      const offsetNum = parseInt(offset, 10);
      query += ` ORDER BY j.created_at DESC LIMIT ${limitNum} OFFSET ${offsetNum}`;

      const jobs = await db.query(query, params);

      const countQuery = `
        SELECT COUNT(*) as total
        FROM jobs
        WHERE worker_id = ?
        ${startDate && endDate ? 'AND created_at BETWEEN ? AND ?' : ''}
      `;

      const countParams = startDate && endDate
        ? [workerId, `${startDate} 00:00:00`, `${endDate} 23:59:59`]
        : [workerId];

      const countResult = await db.query(countQuery, countParams);
      const total = countResult[0].total;

      return res.status(200).json({
        success: true,
        data: {
          jobs,
          pagination: {
            total,
            limit: parseInt(limit, 10),
            offset: parseInt(offset, 10),
            hasMore: parseInt(offset, 10) + jobs.length < total
          }
        }
      });
    } catch (error) {
      logger.error('Failed to get worker jobs', {
        error: error.message,
        stack: error.stack,
        userId: req.user.id
      });
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve jobs'
      });
    }
  }

  async getMyDailyTotal(req, res) {
    try {
      const workerId = req.user.id;
      const { date } = req.query;
      const targetDate = date || new Date().toISOString().split('T')[0];

      const startDate = `${targetDate} 00:00:00`;
      const endDate = `${targetDate} 23:59:59`;

      const results = await db.query(`
        SELECT 
          COUNT(id) as job_count,
          SUM(amount) as total_amount
        FROM jobs
        WHERE worker_id = ? AND created_at BETWEEN ? AND ?
      `, [workerId, startDate, endDate]);

      const jobCountByType = await db.query(`
        SELECT 
          jt.name as job_type_name,
          COUNT(j.id) as count,
          SUM(j.amount) as total
        FROM jobs j
        INNER JOIN job_types jt ON j.job_type_id = jt.id
        WHERE j.worker_id = ? AND j.created_at BETWEEN ? AND ?
        GROUP BY jt.name
      `, [workerId, startDate, endDate]);

      return res.status(200).json({
        success: true,
        data: {
          date: targetDate,
          jobCount: results[0].job_count,
          totalAmount: parseFloat(results[0].total_amount || 0),
          byJobType: jobCountByType.map(jt => ({
            jobTypeName: jt.job_type_name,
            count: jt.count,
            total: parseFloat(jt.total)
          }))
        }
      });
    } catch (error) {
      logger.error('Failed to get daily total', {
        error: error.message,
        stack: error.stack,
        userId: req.user.id
      });
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve daily total'
      });
    }
  }

  async getJobTypes(req, res) {
    try {
      const machineId = req.user.machineId;

      if (!machineId) {
        return res.status(400).json({
          success: false,
          message: 'Worker has no assigned machine'
        });
      }

      const results = await db.query(`
        SELECT 
          jt.id,
          jt.name,
          jt.unit,
          p.rate,
          p.rate_unit
        FROM job_types jt
        INNER JOIN machines m ON jt.machine_type = m.type
        INNER JOIN pricing p ON jt.id = p.job_type_id AND p.active = TRUE
        WHERE m.id = ?
        ORDER BY jt.name
      `, [machineId]);

      return res.status(200).json({
        success: true,
        data: results
      });
    } catch (error) {
      logger.error('Failed to get job types', {
        error: error.message,
        stack: error.stack,
        userId: req.user.id
      });
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve job types'
      });
    }
  }
}

module.exports = new JobsController();
