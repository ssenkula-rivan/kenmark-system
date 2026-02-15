const db = require('../config/database');
const logger = require('../utils/logger');

const migrations = [
  {
    name: '001_create_users_table',
    up: `CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      username VARCHAR(100) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('admin', 'worker') NOT NULL,
      machine_id INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_username (username),
      INDEX idx_role (role),
      INDEX idx_machine_id (machine_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    down: 'DROP TABLE IF EXISTS users;'
  },
  {
    name: '002_create_machines_table',
    up: `CREATE TABLE IF NOT EXISTS machines (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      type ENUM('large_format', 'digital_press') NOT NULL,
      status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_type (type),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    down: 'DROP TABLE IF EXISTS machines;'
  },
  {
    name: '003_create_job_types_table',
    up: `CREATE TABLE IF NOT EXISTS job_types (
      id INT AUTO_INCREMENT PRIMARY KEY,
      machine_type ENUM('large_format', 'digital_press') NOT NULL,
      name VARCHAR(255) NOT NULL,
      unit ENUM('sqm', 'piece') NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_machine_type_name (machine_type, name),
      INDEX idx_machine_type (machine_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    down: 'DROP TABLE IF EXISTS job_types;'
  },
  {
    name: '004_create_pricing_table',
    up: `CREATE TABLE IF NOT EXISTS pricing (
      id INT AUTO_INCREMENT PRIMARY KEY,
      job_type_id INT NOT NULL,
      rate DECIMAL(10, 2) NOT NULL,
      rate_unit ENUM('per_sqm', 'per_piece') NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (job_type_id) REFERENCES job_types(id) ON DELETE RESTRICT,
      INDEX idx_job_type_id (job_type_id),
      INDEX idx_active (active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    down: 'DROP TABLE IF EXISTS pricing;'
  },
  {
    name: '005_create_jobs_table',
    up: `CREATE TABLE IF NOT EXISTS jobs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      worker_id INT NOT NULL,
      machine_id INT NOT NULL,
      job_type_id INT NOT NULL,
      description TEXT NOT NULL,
      width_cm DECIMAL(10, 2) NULL,
      height_cm DECIMAL(10, 2) NULL,
      quantity INT NULL,
      rate DECIMAL(10, 2) NOT NULL,
      amount DECIMAL(10, 2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (worker_id) REFERENCES users(id) ON DELETE RESTRICT,
      FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE RESTRICT,
      FOREIGN KEY (job_type_id) REFERENCES job_types(id) ON DELETE RESTRICT,
      INDEX idx_worker_id (worker_id),
      INDEX idx_machine_id (machine_id),
      INDEX idx_job_type_id (job_type_id),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    down: 'DROP TABLE IF EXISTS jobs;'
  },
  {
    name: '006_create_audit_logs_table',
    up: `CREATE TABLE IF NOT EXISTS audit_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NULL,
      action VARCHAR(255) NOT NULL,
      details TEXT NULL,
      ip_address VARCHAR(45) NULL,
      user_agent TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_user_id (user_id),
      INDEX idx_action (action),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    down: 'DROP TABLE IF EXISTS audit_logs;'
  },
  {
    name: '007_add_users_machine_fk',
    up: `ALTER TABLE users
      ADD CONSTRAINT fk_users_machine
      FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE SET NULL;`,
    down: 'ALTER TABLE users DROP FOREIGN KEY fk_users_machine;'
  }
];

const runMigrations = async () => {
  logger.info('Starting database migrations...');
  
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    const executedMigrations = await db.query('SELECT name FROM migrations');
    const executedNames = executedMigrations.map(m => m.name);

    for (const migration of migrations) {
      if (!executedNames.includes(migration.name)) {
        logger.info(`Running migration: ${migration.name}`);
        await db.query(migration.up);
        await db.query('INSERT INTO migrations (name) VALUES (?)', [migration.name]);
        logger.info(`Migration ${migration.name} completed`);
      } else {
        logger.info(`Migration ${migration.name} already executed`);
      }
    }

    logger.info('All migrations completed successfully');
    return true;
  } catch (error) {
    logger.error('Migration failed', { error: error.message });
    throw error;
  }
};

module.exports = {
  runMigrations
};
