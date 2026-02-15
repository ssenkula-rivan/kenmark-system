const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const config = require('./config/env');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const updateActivity = require('./middleware/updateActivity');
const { rateLimiter } = require('./middleware/rateLimiter');
const { sanitizeInput } = require('./middleware/sanitizer');
const { 
  securityHeaders, 
  corsMiddleware, 
  securityLogger, 
  suspiciousActivityDetector 
} = require('./middleware/security');

// Import routes
const authRoutes = require('./routes/authRoutes');
const registerRoutes = require('./routes/registerRoutes');
const jobsRoutes = require('./routes/jobsRoutes');
const adminRoutes = require('./routes/adminRoutes');
const messagesRoutes = require('./routes/messagesRoutes');

const app = express();

// Trust proxy (for Render and other reverse proxies)
app.set('trust proxy', 1);

// Security headers (must be first)
app.use(securityHeaders);

// CORS with strict origin checking
app.use(corsMiddleware);

// Helmet for additional security
app.use(helmet({
  contentSecurityPolicy: false, // We set our own CSP
  crossOriginEmbedderPolicy: false
}));

// Compression
app.use(compression());

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security logging
app.use(securityLogger);

// Suspicious activity detection
app.use(suspiciousActivityDetector);

// Input sanitization
app.use(sanitizeInput);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: config.server.env
  });
});

// API Routes with rate limiting
app.use('/api/auth', rateLimiter('login'), authRoutes);
app.use('/api', rateLimiter('api'), registerRoutes);
app.use('/api/jobs', rateLimiter('api'), updateActivity, jobsRoutes);
app.use('/api/admin', rateLimiter('strict'), updateActivity, adminRoutes);
app.use('/api/messages', rateLimiter('upload'), updateActivity, messagesRoutes);

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
