"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupUncaughtHandlers = exports.errorLogger = exports.productionErrorHandler = void 0;
const ErrorHandler_1 = __importDefault(require("../utils/ErrorHandler"));
/**
 * Enhanced error handler for production environment
 * Hides implementation details and provides user-friendly errors
 */
const productionErrorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    // In production, don't expose detailed error messages or stack traces
    if (process.env.NODE_ENV === 'production') {
        let error = { ...err };
        error.message = err.message;
        // MongoDB ObjectID errors
        if (err.name === 'CastError') {
            const message = `Resource not found`;
            error = new ErrorHandler_1.default(message, 400);
        }
        // MongoDB duplicate key errors
        if (err.code === 11000) {
            let fieldName = Object.keys(err.keyValue)[0];
            // Format field name for better readability
            fieldName = fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
            const message = `${fieldName} already exists`;
            error = new ErrorHandler_1.default(message, 400);
        }
        // Validation errors
        if (err.name === 'ValidationError') {
            const message = Object.values(err.errors).map((val) => val.message).join(', ');
            error = new ErrorHandler_1.default(message, 400);
        }
        // Firebase/Auth errors
        if (err.name?.includes('Auth') || err.code?.startsWith('auth/')) {
            const message = 'Authentication failed. Please log in again.';
            error = new ErrorHandler_1.default(message, 401);
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
exports.productionErrorHandler = productionErrorHandler;
/**
 * Log errors to a monitoring service in production
 */
const errorLogger = (err, req, res, next) => {
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
exports.errorLogger = errorLogger;
/**
 * Handle uncaught exceptions and promise rejections
 */
const setupUncaughtHandlers = () => {
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
exports.setupUncaughtHandlers = setupUncaughtHandlers;
