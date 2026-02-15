const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const config = require('./config/env');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const updateActivity = require('./middleware/updateActivity');

// Import routes
const authRoutes = require('./routes/authRoutes');
const registerRoutes = require('./routes/registerRoutes');
const jobsRoutes = require('./routes/jobsRoutes');
const adminRoutes = require('./routes/adminRoutes');
const messagesRoutes = require('./routes/messagesRoutes');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.cors.origin,
  credentials: true
}));
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: {
    success: false,
    message: 'Too many requests, please try again later'
  }
});
app.use(limiter);

// Body parsing with increased limits for heavy files
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging
app.use((req, res, next) => {
  logger.debug('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip
  });
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: config.server.env
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api', registerRoutes);
app.use('/api/jobs', updateActivity, jobsRoutes);
app.use('/api/admin', updateActivity, adminRoutes);
app.use('/api/messages', updateActivity, messagesRoutes);

// Heartbeat endpoint for activity tracking
const { authenticate } = require('./middleware/auth');
app.post('/api/heartbeat', authenticate, updateActivity, (req, res) => {
  res.json({ success: true, timestamp: new Date().toISOString() });
});

// Client error logging endpoint
app.post('/api/client-error', express.json(), (req, res) => {
  const { error, errorInfo, url, timestamp } = req.body;
  logger.error('Client-side error', {
    error,
    errorInfo,
    url,
    timestamp,
    userAgent: req.headers['user-agent'],
    ip: req.ip
  });
  res.json({ success: true });
});

// Serve static files from frontend build in production
if (config.server.env === 'production') {
  const path = require('path');
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
  
  // Serve index.html for all non-API routes (SPA support)
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
    } else {
      res.status(404).json({
        success: false,
        message: 'Route not found'
      });
    }
  });
} else {
  // 404 handler for development
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: 'Route not found'
    });
  });
}

// Error handling
app.use(errorHandler);

module.exports = app;
