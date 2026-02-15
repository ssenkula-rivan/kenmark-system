const db = require('../config/database');
const logger = require('../utils/logger');

class PricingService {
  async getActiveRate(jobTypeId) {
    try {
      const results = await db.query(
        'SELECT rate FROM pricing WHERE job_type_id = ? AND active = TRUE LIMIT 1',
        [jobTypeId]
      );

      if (results.length === 0) {
        throw new Error(`No active pricing found for job type ID: ${jobTypeId}`);
      }

      return parseFloat(results[0].rate);
    } catch (error) {
      logger.error('Failed to get active rate', { jobTypeId, error: error.message });
      throw error;
    }
  }

  async getAllPricing() {
    try {
      const results = await db.query(`
        SELECT 
          p.id,
          p.job_type_id,
          jt.name as job_type_name,
          jt.machine_type,
          jt.unit,
          p.rate,
          p.rate_unit,
          p.active,
          p.created_at,
          p.updated_at
        FROM pricing p
        INNER JOIN job_types jt ON p.job_type_id = jt.id
        ORDER BY jt.machine_type, jt.name
      `);

      return results;
    } catch (error) {
      logger.error('Failed to get all pricing', { error: error.message });
      throw error;
    }
  }

  async getPricingByJobType(jobTypeId) {
    try {
      const results = await db.query(`
        SELECT 
          p.id,
          p.job_type_id,
          jt.name as job_type_name,
          jt.machine_type,
          jt.unit,
          p.rate,
          p.rate_unit,
          p.active,
          p.created_at,
          p.updated_at
        FROM pricing p
        INNER JOIN job_types jt ON p.job_type_id = jt.id
        WHERE p.job_type_id = ?
      `, [jobTypeId]);

      return results;
    } catch (error) {
      logger.error('Failed to get pricing by job type', { jobTypeId, error: error.message });
      throw error;
    }
  }

  async createPricing(jobTypeId, rate, rateUnit, active = true) {
    try {
      const jobTypeCheck = await db.query(
        'SELECT id FROM job_types WHERE id = ?',
        [jobTypeId]
      );

      if (jobTypeCheck.length === 0) {
        throw new Error(`Job type not found: ${jobTypeId}`);
      }

      const result = await db.query(
        'INSERT INTO pricing (job_type_id, rate, rate_unit, active) VALUES (?, ?, ?, ?)',
        [jobTypeId, rate, rateUnit, active]
      );

      logger.info('Pricing created', { pricingId: result.insertId, jobTypeId, rate, rateUnit, active });
      return result.insertId;
    } catch (error) {
      logger.error('Failed to create pricing', { jobTypeId, rate, rateUnit, active, error: error.message });
      throw error;
    }
  }

  async updatePricing(pricingId, rate, active) {
    try {
      const existingPricing = await db.query(
        'SELECT * FROM pricing WHERE id = ?',
        [pricingId]
      );

      if (existingPricing.length === 0) {
        throw new Error(`Pricing not found: ${pricingId}`);
      }

      const updates = [];
      const params = [];

      if (rate !== undefined) {
        updates.push('rate = ?');
        params.push(rate);
      }

      if (active !== undefined) {
        updates.push('active = ?');
        params.push(active);
      }

      if (updates.length === 0) {
        throw new Error('No fields to update');
      }

      params.push(pricingId);

      await db.query(
        `UPDATE pricing SET ${updates.join(', ')} WHERE id = ?`,
        params
      );

      logger.info('Pricing updated', { pricingId, rate, active });
      return true;
    } catch (error) {
      logger.error('Failed to update pricing', { pricingId, rate, active, error: error.message });
      throw error;
    }
  }

  async deactivatePricing(pricingId) {
    try {
      await this.updatePricing(pricingId, undefined, false);
      logger.info('Pricing deactivated', { pricingId });
      return true;
    } catch (error) {
      logger.error('Failed to deactivate pricing', { pricingId, error: error.message });
      throw error;
    }
  }
}

module.exports = new PricingService();
