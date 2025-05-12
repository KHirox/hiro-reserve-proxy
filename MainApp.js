// KHirox Reverse Proxy - Main Application File
// Enhanced with modern JavaScript features and better structure

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import { logger } from './core/utils/logger.js';
import { monitorSystem } from './core/utils/system.js';
import { cacheManager } from './core/cache/manager.js';

// ES Modules compatible path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Express application
const app = express();

// =============================================
// Security Middleware
// =============================================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 63072000, // 2 years in seconds
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: { policy: 'same-origin' }
}));

// Compression middleware
app.use(compression({
  level: 6,
  threshold: '1kb',
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// =============================================
// Dynamic Module Imports
// =============================================
const loadModule = async (modulePath) => {
  try {
    const module = await import(join(__dirname, modulePath));
    logger.debug(`Successfully loaded module: ${modulePath}`);
    return module.default || module;
  } catch (error) {
    logger.error(`Failed to load module: ${modulePath}`, { error });
    throw error;
  }
};

// =============================================
// Application Initialization
// =============================================
const initializeApp = async () => {
  try {
    // Load middleware and routes
    const requestLogger = await loadModule('./middleware/request-logger.js');
    const indexRouter = await loadModule('./routes/index.js');
    const cacheProxyRouter = await loadModule('./routes/cache-proxy.js');
    const errorHandler = await loadModule('./middleware/error-handler.js');

    // Apply middleware
    app.use(requestLogger);
    
    // Apply routes
    app.use('/', indexRouter);
    app.use('/:ip/cache/*', cacheProxyRouter);
    
    // Error handling (must be last)
    app.use(errorHandler);

    // Initialize system monitoring
    monitorSystem();
    
    // Verify cache connection
    await cacheManager.ping();
    
    logger.info('KHirox Reverse Proxy initialized successfully');
  } catch (error) {
    logger.error('Application initialization failed', { error });
    process.exit(1);
  }
};

// Initialize the application
await initializeApp();

// Export the configured app
export default app;