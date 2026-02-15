const mysql = require('mysql2/promise');
const logger = require('../utils/logger');

let pool = null;

const createPool = () => {
  if (pool) {
    return pool;
  }

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
    logger.info('New database connection established', { connectionId: connection.threadId });
  });

  pool.on('acquire', (connection) => {
    logger.debug('Connection acquired from pool', { connectionId: connection.threadId });
  });

  pool.on('release', (connection) => {
    logger.debug('Connection released to pool', { connectionId: connection.threadId });
  });

  return pool;
};

const getConnection = async () => {
  try {
    const poolInstance = createPool();
    const connection = await poolInstance.getConnection();
    return connection;
  } catch (error) {
    logger.error('Failed to get database connection', { error: error.message });
    throw error;
  }
};

const query = async (sql, params = []) => {
  const connection = await getConnection();
  try {
    const [results] = await connection.execute(sql, params);
    return results;
  } catch (error) {
    logger.error('Database query failed', { sql, error: error.message });
    throw error;
  } finally {
    connection.release();
  }
};

const transaction = async (callback) => {
  const connection = await getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    logger.error('Transaction rolled back', { error: error.message });
    throw error;
  } finally {
    connection.release();
  }
};

const testConnection = async () => {
  try {
    const connection = await getConnection();
    await connection.ping();
    connection.release();
    logger.info('Database connection test successful');
    return true;
  } catch (error) {
    logger.error('Database connection test failed', { error: error.message });
    throw error;
  }
};

const closePool = async () => {
  if (pool) {
    await pool.end();
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
