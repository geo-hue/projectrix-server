import { Request, Response, NextFunction } from 'express';
import ErrorHandler from '../utils/ErrorHandler';

/**
 * Enhanced error handler for production environment
 * Hides implementation details and provides user-friendly errors
 */
export const productionErrorHandler = (
  err: any, 
  req: Request, 
  res: Response, 
  next: NextFunction
): void => {
  err.statusCode = err.statusCode || 500;
  
  // In production, don't expose detailed error messages or stack traces
  if (process.env.NODE_ENV === 'production') {
    let error = { ...err };
    error.message = err.message;
    
    // MongoDB ObjectID errors
    if (err.name === 'CastError') {
      const message = `Resource not found`;
      error = new ErrorHandler(message, 400);
    }
    
    // MongoDB duplicate key errors
    if (err.code === 11000) {
      let fieldName = Object.keys(err.keyValue)[0];
      // Format field name for better readability
      fieldName = fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
      const message = `${fieldName} already exists`;
      error = new ErrorHandler(message, 400);
    }
    
    // Validation errors
    if (err.name === 'ValidationError') {
      const message = Object.values(err.errors).map((val: any) => val.message).join(', ');
      error = new ErrorHandler(message, 400);
    }
    
    // Firebase/Auth errors
    if (err.name?.includes('Auth') || err.code?.startsWith('auth/')) {
      const message = 'Authentication failed. Please log in again.';
      error = new ErrorHandler(message, 401);
    }
    
    // Send generic error messages in production
    if (error.statusCode === 500) {
      res.status(500).json({
        success: false,
        message: 'Internal server error. Our team has been notified.'
      });
      return;
    }
    
    // Send the error message for other status codes
    res.status(error.statusCode).json({
      success: false,
      message: error.message
    });
    return;
  }
  
  // In development, send detailed error information
  res.status(err.statusCode).json({
    success: false,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    error: err
  });
};

/**
 * Log errors to a monitoring service in production
 */
export const errorLogger = (err: any, req: Request, res: Response, next: NextFunction) => {
  // Log the error
  console.error('ERROR:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });
  
  // Send this to a monitoring service
  // like Sentry, LogRocket, New Relic, etc.
  if (process.env.NODE_ENV === 'production') {
    // Example Sentry integration (add the Sentry SDK to your dependencies)
    // Sentry.captureException(err);
  }
  
  next(err);
};

/**
 * Handle uncaught exceptions and promise rejections
 */
export const setupUncaughtHandlers = () => {
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('UNCAUGHT EXCEPTION:', error);
    console.log('Shutting down due to uncaught exception');
  
    process.exit(1);
  });
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (error) => {
    console.error('UNHANDLED REJECTION:', error);
    console.log('Shutting down due to unhandled promise rejection');
    // Notify monitoring service
    process.exit(1);
  });
};