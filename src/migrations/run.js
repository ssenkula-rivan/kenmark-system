#!/usr/bin/env node
require('../config/env');
const { runMigrations } = require('./migrations');
const db = require('../config/database');
const logger = require('../utils/logger');

const seedDatabase = async () => {
  const bcrypt = require('bcryptjs');
  
  logger.info('Starting database seeding...');
  
  try {
    await db.transaction(async (connection) => {
      const [machines] = await connection.execute('SELECT COUNT(*) as count FROM machines');
      
      if (machines[0].count === 0) {
        logger.info('Seeding machines...');
        await connection.execute(`
          INSERT INTO machines (name, type, status) VALUES
          ('LARGE_FORMAT_PRINTER', 'large_format', 'active'),
          ('DIGITAL_COLOR_PRESS_700', 'digital_press', 'active')
        `);
      }

      const [machineIds] = await connection.execute('SELECT id, type FROM machines');
      const largeFormatMachineId = machineIds.find(m => m.type === 'large_format')?.id;
      const digitalPressMachineId = machineIds.find(m => m.type === 'digital_press')?.id;

      const [jobTypes] = await connection.execute('SELECT COUNT(*) as count FROM job_types');
      
      if (jobTypes[0].count === 0) {
        logger.info('Seeding job types...');
        await connection.execute(`
          INSERT INTO job_types (machine_type, name, unit) VALUES
          ('large_format', 'Banner', 'sqm'),
          ('large_format', 'Vinyl Sticker', 'sqm'),
          ('large_format', 'Poster', 'sqm'),
          ('large_format', 'Canvas Print', 'sqm'),
          ('digital_press', 'Business Cards', 'piece'),
          ('digital_press', 'Flyers', 'piece'),
          ('digital_press', 'Brochures', 'piece'),
          ('digital_press', 'Booklets', 'piece')
        `);
      }

      const [jobTypeRecords] = await connection.execute('SELECT id, machine_type, unit FROM job_types');
      
      const [pricing] = await connection.execute('SELECT COUNT(*) as count FROM pricing');
      
      if (pricing[0].count === 0) {
        logger.info('Seeding pricing...');
        const pricingInserts = [];
        
        for (const jobType of jobTypeRecords) {
          const rate = jobType.unit === 'sqm' ? 50.00 : 0.50;
          const rateUnit = jobType.unit === 'sqm' ? 'per_sqm' : 'per_piece';
          pricingInserts.push([jobType.id, rate, rateUnit, true]);
        }
        
        await connection.query(
          'INSERT INTO pricing (job_type_id, rate, rate_unit, active) VALUES ?',
          [pricingInserts]
        );
      }

      const [users] = await connection.execute('SELECT COUNT(*) as count FROM users');
      
      if (users[0].count === 0) {
        logger.info('Seeding users...');
        const adminPasswordHash = await bcrypt.hash('admin123', 12);
        const worker1PasswordHash = await bcrypt.hash('worker123', 12);
        const worker2PasswordHash = await bcrypt.hash('worker123', 12);
        
        await connection.execute(`
          INSERT INTO users (name, username, password_hash, role, machine_id) VALUES
          ('Admin User', 'admin', ?, 'admin', NULL),
          ('Worker One', 'worker1', ?, 'worker', ?),
          ('Worker Two', 'worker2', ?, 'worker', ?)
        `, [
          adminPasswordHash,
          worker1PasswordHash,
          largeFormatMachineId,
          worker2PasswordHash,
          digitalPressMachineId
        ]);
        
        logger.warn('DEFAULT CREDENTIALS CREATED - CHANGE IMMEDIATELY IN PRODUCTION:');
        logger.warn('Admin: username=admin, password=admin123');
        logger.warn('Worker1: username=worker1, password=worker123');
        logger.warn('Worker2: username=worker2, password=worker123');
      }
    });

    logger.info('Database seeding completed successfully');
    return true;
  } catch (error) {
    logger.error('Seeding failed', { error: error.message });
    throw error;
  }
};

const run = async () => {
  try {
    logger.info('Testing database connection...');
    await db.testConnection();

    logger.info('Running migrations...');
    await runMigrations();

    if (process.argv.includes('--seed')) {
      logger.info('Running seed...');
      await seedDatabase();
    }

    logger.info('Migration process completed successfully');
    await db.closePool();
    process.exit(0);
  } catch (error) {
    logger.error('Migration process failed', { error: error.message, stack: error.stack });
    await db.closePool();
    process.exit(1);
  }
};

run();
