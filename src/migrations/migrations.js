const db = require('../config/database');
const logger = require('../utils/logger');

// Detect if we're using PostgreSQL or MySQL
const isPostgres = process.env.DATABASE_URL || process.env.DB_TYPE === 'postgres';

const migrations = isPostgres ? [
  // PostgreSQL migrations
  {
    name: '001_create_users_table',
    up: `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'worker')),
        machine_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_machine_id ON users(machine_id);
    `,
    down: 'DROP TABLE IF EXISTS users CASCADE;'
  },
  {
    name: '002_create_machines_table',
    up: `
      CREATE TABLE IF NOT EXISTS machines (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL CHECK (type IN ('large_format', 'digital_press')),
        status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_type ON machines(type);
      CREATE INDEX IF NOT EXISTS idx_status ON machines(status);
    `,
    down: 'DROP TABLE IF EXISTS machines CASCADE;'
  },
  {
    name: '003_create_job_types_table',
    up: `
      CREATE TABLE IF NOT EXISTS job_types (
        id SERIAL PRIMARY KEY,
        machine_type VARCHAR(50) NOT NULL CHECK (machine_type IN ('large_format', 'digital_press')),
        name VARCHAR(255) NOT NULL,
        unit VARCHAR(50) NOT NULL CHECK (unit IN ('sqm', 'piece')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (machine_type, name)
      );
      CREATE INDEX IF NOT EXISTS idx_machine_type ON job_types(machine_type);
    `,
    down: 'DROP TABLE IF EXISTS job_types CASCADE;'
  },
  {
    name: '004_create_pricing_table',
    up: `
      CREATE TABLE IF NOT EXISTS pricing (
        id SERIAL PRIMARY KEY,
        job_type_id INT NOT NULL,
        rate DECIMAL(10, 2) NOT NULL,
        rate_unit VARCHAR(50) NOT NULL CHECK (rate_unit IN ('per_sqm', 'per_piece')),
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (job_type_id) REFERENCES job_types(id) ON DELETE RESTRICT
      );
      CREATE INDEX IF NOT EXISTS idx_job_type_id ON pricing(job_type_id);
      CREATE INDEX IF NOT EXISTS idx_active ON pricing(active);
    `,
    down: 'DROP TABLE IF EXISTS pricing CASCADE;'
  },
  {
    name: '005_create_jobs_table',
    up: `
      CREATE TABLE IF NOT EXISTS jobs (
        id SERIAL PRIMARY KEY,
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
        FOREIGN KEY (job_type_id) REFERENCES job_types(id) ON DELETE RESTRICT
      );
      CREATE INDEX IF NOT EXISTS idx_worker_id ON jobs(worker_id);
      CREATE INDEX IF NOT EXISTS idx_machine_id ON jobs(machine_id);
      CREATE INDEX IF NOT EXISTS idx_job_type_id ON jobs(job_type_id);
      CREATE INDEX IF NOT EXISTS idx_created_at ON jobs(created_at);
    `,
    down: 'DROP TABLE IF EXISTS jobs CASCADE;'
  },
  {
    name: '006_create_audit_logs_table',
    up: `
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INT NULL,
        action VARCHAR(255) NOT NULL,
        details TEXT NULL,
        ip_address VARCHAR(45) NULL,
        user_agent TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_user_id ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_created_at ON audit_logs(created_at);
    `,
    down: 'DROP TABLE IF EXISTS audit_logs CASCADE;'
  },
  {
    name: '007_add_users_machine_fk',
    up: `
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_machine'
        ) THEN
          ALTER TABLE users ADD CONSTRAINT fk_users_machine 
          FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `,
    down: 'ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_machine;'
  },
  {
    name: '008_add_department_field',
    up: `
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'department'
        ) THEN
          ALTER TABLE users ADD COLUMN department VARCHAR(100) NULL;
        END IF;
      END $$;
    `,
    down: 'ALTER TABLE users DROP COLUMN IF EXISTS department;'
  },
  {
    name: '009_add_last_active',
    up: `
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'last_active'
        ) THEN
          ALTER TABLE users ADD COLUMN last_active TIMESTAMP NULL DEFAULT NULL;
          UPDATE users SET last_active = NOW();
        END IF;
      END $$;
    `,
    down: 'ALTER TABLE users DROP COLUMN IF EXISTS last_active;'
  },
  {
    name: '010_add_messaging_system',
    up: `
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        sender_id INT NOT NULL,
        receiver_id INT NOT NULL,
        message TEXT NULL,
        file_name VARCHAR(255) NULL,
        file_path VARCHAR(500) NULL,
        file_type VARCHAR(100) NULL,
        file_size INT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_sender ON messages(sender_id);
      CREATE INDEX IF NOT EXISTS idx_receiver ON messages(receiver_id);
      CREATE INDEX IF NOT EXISTS idx_created_at ON messages(created_at);
    `,
    down: 'DROP TABLE IF EXISTS messages CASCADE;'
  },
  {
    name: '011_add_digital_print_types',
    up: `
      INSERT INTO job_types (machine_type, name, unit) VALUES
      ('digital_press', 'A4 One-Sided', 'piece'),
      ('digital_press', 'A4 Back-to-Back', 'piece'),
      ('digital_press', 'A3 One-Sided', 'piece'),
      ('digital_press', 'A3 Back-to-Back', 'piece')
      ON CONFLICT (machine_type, name) DO NOTHING;
      
      INSERT INTO pricing (job_type_id, rate, rate_unit, active)
      SELECT id, 100.00, 'per_piece', true
      FROM job_types
      WHERE name IN ('A4 One-Sided', 'A4 Back-to-Back', 'A3 One-Sided', 'A3 Back-to-Back')
      ON CONFLICT DO NOTHING;
    `,
    down: `
      DELETE FROM pricing WHERE job_type_id IN (
        SELECT id FROM job_types 
        WHERE name IN ('A4 One-Sided', 'A4 Back-to-Back', 'A3 One-Sided', 'A3 Back-to-Back')
      );
      DELETE FROM job_types 
      WHERE name IN ('A4 One-Sided', 'A4 Back-to-Back', 'A3 One-Sided', 'A3 Back-to-Back');
    `
  },
  {
    name: '012_add_book_job_type',
    up: `
      INSERT INTO job_types (machine_type, name, unit) VALUES
      ('digital_press', 'Book', 'piece')
      ON CONFLICT (machine_type, name) DO NOTHING;
      
      INSERT INTO pricing (job_type_id, rate, rate_unit, active)
      SELECT id, 500.00, 'per_piece', true
      FROM job_types
      WHERE machine_type = 'digital_press' AND name = 'Book'
      ON CONFLICT DO NOTHING;
    `,
    down: `
      DELETE FROM pricing WHERE job_type_id IN (
        SELECT id FROM job_types WHERE name = 'Book'
      );
      DELETE FROM job_types WHERE name = 'Book';
    `
  }
] : [
  // MySQL migrations (original)
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
  },
  {
    name: '008_add_department_field',
    up: `ALTER TABLE users ADD COLUMN department VARCHAR(100) NULL AFTER role;`,
    down: 'ALTER TABLE users DROP COLUMN department;'
  },
  {
    name: '009_add_last_active',
    up: `
      ALTER TABLE users ADD COLUMN last_active TIMESTAMP NULL DEFAULT NULL;
      UPDATE users SET last_active = NOW();
    `,
    down: 'ALTER TABLE users DROP COLUMN last_active;'
  },
  {
    name: '010_add_messaging_system',
    up: `CREATE TABLE IF NOT EXISTS messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sender_id INT NOT NULL,
      receiver_id INT NOT NULL,
      message TEXT NULL,
      file_name VARCHAR(255) NULL,
      file_path VARCHAR(500) NULL,
      file_type VARCHAR(100) NULL,
      file_size INT NULL,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_sender (sender_id),
      INDEX idx_receiver (receiver_id),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    down: 'DROP TABLE IF EXISTS messages;'
  },
  {
    name: '011_add_digital_print_types',
    up: `
      INSERT INTO job_types (machine_type, name, unit) VALUES
      ('digital_press', 'A4 One-Sided', 'piece'),
      ('digital_press', 'A4 Back-to-Back', 'piece'),
      ('digital_press', 'A3 One-Sided', 'piece'),
      ('digital_press', 'A3 Back-to-Back', 'piece')
      ON DUPLICATE KEY UPDATE name=name;
      
      INSERT INTO pricing (job_type_id, rate, rate_unit, active)
      SELECT id, 100.00, 'per_piece', true
      FROM job_types
      WHERE name IN ('A4 One-Sided', 'A4 Back-to-Back', 'A3 One-Sided', 'A3 Back-to-Back')
      ON DUPLICATE KEY UPDATE rate=rate;
    `,
    down: `
      DELETE FROM pricing WHERE job_type_id IN (
        SELECT id FROM job_types 
        WHERE name IN ('A4 One-Sided', 'A4 Back-to-Back', 'A3 One-Sided', 'A3 Back-to-Back')
      );
      DELETE FROM job_types 
      WHERE name IN ('A4 One-Sided', 'A4 Back-to-Back', 'A3 One-Sided', 'A3 Back-to-Back');
    `
  },
  {
    name: '012_add_book_job_type',
    up: `
      INSERT INTO job_types (machine_type, name, unit) VALUES
      ('digital_press', 'Book', 'piece')
      ON DUPLICATE KEY UPDATE name=name;
      
      INSERT INTO pricing (job_type_id, rate, rate_unit, active)
      SELECT id, 500.00, 'per_piece', true
      FROM job_types
      WHERE machine_type = 'digital_press' AND name = 'Book'
      ON DUPLICATE KEY UPDATE rate=rate;
    `,
    down: `
      DELETE FROM pricing WHERE job_type_id IN (
        SELECT id FROM job_types WHERE name = 'Book'
      );
      DELETE FROM job_types WHERE name = 'Book';
    `
  }
];

const runMigrations = async () => {
  logger.info('Starting database migrations...');
  
  try {
    // Create migrations table with appropriate syntax
    if (isPostgres) {
      await db.query(`
        CREATE TABLE IF NOT EXISTS migrations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) UNIQUE NOT NULL,
          executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } else {
      await db.query(`
        CREATE TABLE IF NOT EXISTS migrations (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) UNIQUE NOT NULL,
          executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB;
      `);
    }

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
