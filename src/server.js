const app = require('./app');
const db = require('./config/database');
const config = require('./config/env');
const logger = require('./utils/logger');
const backupScheduler = require('./services/backupScheduler');

let server;

const startServer = async () => {
  try {
    logger.info('Starting Kenmark System Backend Server...');

    logger.info('Testing database connection...');
    await db.testConnection();
    logger.info('Database connection successful');

    logger.info('Creating database connection pool...');
    db.createPool();
    logger.info('Database connection pool created');

    // Start backup scheduler in production
    if (config.server.env === 'production') {
      backupScheduler.start();
    }

    server = app.listen(config.server.port, '0.0.0.0', () => {
      logger.info(`Server is running on port ${config.server.port}`);
      logger.info(`Environment: ${config.server.env}`);
      logger.info(`CORS Origin: ${config.cors.origin}`);
      
      // Signal PM2 that app is ready
      if (process.send) {
        process.send('ready');
      }
    });

    server.on('error', (error) => {
      if (error.syscall !== 'listen') {
        throw error;
      }

      switch (error.code) {
        case 'EACCES':
          logger.error(`Port ${config.server.port} requires elevated privileges`);
          process.exit(1);
          break;
        case 'EADDRINUSE':
          logger.error(`Port ${config.server.port} is already in use`);
          process.exit(1);
          break;
        default:
          throw error;
      }
    });
  } catch (error) {
    logger.error('Failed to start server', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
};

const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received, starting graceful shutdown...`);

  // Stop backup scheduler
  backupScheduler.stop();

  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed');

      try {
        await db.closePool();
        logger.info('Database connection pool closed');
        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown', {
          error: error.message,
          stack: error.stack
        });
        process.exit(1);
      }
    });

    setTimeout(() => {
      logger.error('Forced shutdown due to timeout');
      process.exit(1);
    }, 30000);
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception - System will attempt to recover', {
    error: error.message,
    stack: error.stack
  });
  
  // Don't exit immediately - try to recover
  setTimeout(() => {
    logger.info('Attempting to continue after uncaught exception...');
  }, 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection - System will attempt to recover', {
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise
  });
  
  // Don't exit - log and continue
});

// Handle memory warnings
if (process.memoryUsage) {
  setInterval(() => {
    const usage = process.memoryUsage();
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
    
    if (heapUsedMB > 400) { // Warning at 400MB
      logger.warn('High memory usage detected', {
        heapUsed: `${heapUsedMB}MB`,
        heapTotal: `${heapTotalMB}MB`
      });
    }
  }, 60000); // Check every minute
}

startServer();
