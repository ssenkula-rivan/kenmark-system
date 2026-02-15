const mysql = require('mysql2/promise');
const { Pool } = require('pg');
const logger = require('../utils/logger');

let pool = null;
const isPostgres = process.env.DATABASE_URL || process.env.DB_TYPE === 'postgres';

const createPool = () => {
  if (pool) {
    return pool;
  }

  if (isPostgres) {
    // PostgreSQL configuration (for Render)
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    pool.on('connect', () => {
      logger.info('New PostgreSQL connection established');
    });

    pool.on('error', (err) => {
      logger.error('PostgreSQL pool error', { error: err.message });
    });
  } else {
    // MySQL configuration (for local development)
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT, 10),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 100,
      maxIdle: 50,
      idleTimeout: 60000,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      timezone: 'Z',
      dateStrings: false,
      supportBigNumbers: true,
      bigNumberStrings: false,
      multipleStatements: false
    });

    pool.on('connection', (connection) => {
      logger.info('New MySQL connection established', { connectionId: connection.threadId });
    });

    pool.on('acquire', (connection) => {
      logger.debug('Connection acquired from pool', { connectionId: connection.threadId });
    });

    pool.on('release', (connection) => {
      logger.debug('Connection released to pool', { connectionId: connection.threadId });
    });
  }

  return pool;
};

const getConnection = async () => {
  try {
    const poolInstance = createPool();
    if (isPostgres) {
      return await poolInstance.connect();
    } else {
      return await poolInstance.getConnection();
    }
  } catch (error) {
    logger.error('Failed to get database connection', { error: error.message });
    throw error;
  }
};

const query = async (sql, params = []) => {
  const connection = await getConnection();
  try {
    if (isPostgres) {
      // Convert MySQL ? placeholders to PostgreSQL $1, $2, etc.
      let pgSql = sql;
      let paramIndex = 1;
      pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);
      
      const result = await connection.query(pgSql, params);
      return result.rows;
    } else {
      const [results] = await connection.execute(sql, params);
      return results;
    }
  } catch (error) {
    logger.error('Database query failed', { sql, error: error.message });
    throw error;
  } finally {
    if (isPostgres) {
      connection.release();
    } else {
      connection.release();
    }
  }
};

const transaction = async (callback) => {
  const connection = await getConnection();
  try {
    if (isPostgres) {
      await connection.query('BEGIN');
      const result = await callback(connection);
      await connection.query('COMMIT');
      return result;
    } else {
      await connection.beginTransaction();
      const result = await callback(connection);
      await connection.commit();
      return result;
    }
  } catch (error) {
    if (isPostgres) {
      await connection.query('ROLLBACK');
    } else {
      await connection.rollback();
    }
    logger.error('Transaction rolled back', { error: error.message });
    throw error;
  } finally {
    if (isPostgres) {
      connection.release();
    } else {
      connection.release();
    }
  }
};

const testConnection = async () => {
  try {
    const connection = await getConnection();
    if (isPostgres) {
      await connection.query('SELECT 1');
    } else {
      await connection.ping();
    }
    if (isPostgres) {
      connection.release();
    } else {
      connection.release();
    }
    logger.info('Database connection test successful');
    return true;
  } catch (error) {
    logger.error('Database connection test failed', { error: error.message });
    throw error;
  }
};

const closePool = async () => {
  if (pool) {
    if (isPostgres) {
      await pool.end();
    } else {
      await pool.end();
    }
    pool = null;
    logger.info('Database connection pool closed');
  }
};

module.exports = {
  createPool,
  getConnection,
  query,
  transaction,
  testConnection,
  closePool
};
