#!/usr/bin/env node
require('../config/env');
const { runMigrations } = require('./migrations');
const db = require('../config/database');
const logger = require('../utils/logger');

const seedDatabase = async () => {
  const bcrypt = require('bcryptjs');
  
  logger.info('Starting database seeding...');
  
  try {
    // Check machines
    const machines = await db.query('SELECT COUNT(*) as count FROM machines');
    const machineCount = parseInt(machines[0].count);
    
    if (machineCount === 0) {
      logger.info('Seeding machines...');
      await db.query(`
        INSERT INTO machines (name, type, status) VALUES
        ('LARGE_FORMAT_PRINTER', 'large_format', 'active'),
        ('DIGITAL_COLOR_PRESS_700', 'digital_press', 'active')
      `);
    }

    const machineIds = await db.query('SELECT id, type FROM machines');
    const largeFormatMachineId = machineIds.find(m => m.type === 'large_format')?.id;
    const digitalPressMachineId = machineIds.find(m => m.type === 'digital_press')?.id;

    // Check job types
    const jobTypes = await db.query('SELECT COUNT(*) as count FROM job_types');
    const jobTypeCount = parseInt(jobTypes[0].count);
    
    if (jobTypeCount === 0) {
      logger.info('Seeding job types...');
      await db.query(`
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

    const jobTypeRecords = await db.query('SELECT id, machine_type, unit FROM job_types');
    
    // Check pricing
    const pricing = await db.query('SELECT COUNT(*) as count FROM pricing');
    const pricingCount = parseInt(pricing[0].count);
    
    if (pricingCount === 0) {
      logger.info('Seeding pricing...');
      
      for (const jobType of jobTypeRecords) {
        const rate = jobType.unit === 'sqm' ? 50.00 : 0.50;
        const rateUnit = jobType.unit === 'sqm' ? 'per_sqm' : 'per_piece';
        await db.query(
          'INSERT INTO pricing (job_type_id, rate, rate_unit, active) VALUES (?, ?, ?, ?)',
          [jobType.id, rate, rateUnit, true]
        );
      }
    }

    // Check users
    const users = await db.query('SELECT COUNT(*) as count FROM users');
    const userCount = parseInt(users[0].count);
    
    if (userCount === 0) {
      logger.info('Seeding users...');
      const adminPasswordHash = await bcrypt.hash('admin123', 12);
      const worker1PasswordHash = await bcrypt.hash('worker123', 12);
      const worker2PasswordHash = await bcrypt.hash('worker123', 12);
      
      await db.query(`
        INSERT INTO users (name, username, password_hash, role, machine_id) VALUES
        (?, ?, ?, ?, ?),
        (?, ?, ?, ?, ?),
        (?, ?, ?, ?, ?)
      `, [
        'Admin User', 'admin', adminPasswordHash, 'admin', null,
        'Worker One', 'worker1', worker1PasswordHash, 'worker', largeFormatMachineId,
        'Worker Two', 'worker2', worker2PasswordHash, 'worker', digitalPressMachineId
      ]);
      
      logger.warn('DEFAULT CREDENTIALS CREATED - CHANGE IMMEDIATELY IN PRODUCTION:');
      logger.warn('Admin: username=admin, password=admin123');
      logger.warn('Worker1: username=worker1, password=worker123');
      logger.warn('Worker2: username=worker2, password=worker123');
    }

    logger.info('Database seeding completed successfully');
    return true;
  } catch (error) {
    logger.error('Seeding failed', { error: error.message, stack: error.stack });
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
