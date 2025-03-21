"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
// app.ts (Updated with production optimizations)
require('dotenv').config();
const express_1 = __importDefault(require("express"));
exports.app = (0, express_1.default)();
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const helmet_1 = __importDefault(require("helmet"));
const error_1 = require("./middleware/error");
const errorHandlerProduction_1 = require("./middleware/errorHandlerProduction");
const compression_1 = require("./middleware/compression");
const rateLimiter_1 = require("./middleware/rateLimiter");
const errorHandlerProduction_2 = require("./middleware/errorHandlerProduction");
// Import routes
const userRoute_1 = __importDefault(require("./routes/userRoute"));
const generateRoute_1 = __importDefault(require("./routes/generateRoute"));
const userProfileRoutes_1 = __importDefault(require("./routes/userProfileRoutes"));
const collaborationRoutes_1 = __importDefault(require("./routes/collaborationRoutes"));
const publishedProjectsRoutes_1 = __importDefault(require("./routes/publishedProjectsRoutes"));
const feedbackRoutes_1 = __importDefault(require("./routes/feedbackRoutes"));
const discordRoutes_1 = __importDefault(require("./routes/discordRoutes"));
const activityRoutes_1 = __importDefault(require("./routes/activityRoutes"));
const adminUsersRoutes_1 = __importDefault(require("./routes/adminUsersRoutes"));
const analyticsRoutes_1 = __importDefault(require("./routes/analyticsRoutes"));
const paymentRoutes_1 = __importDefault(require("./routes/paymentRoutes"));
const githubRoutes_1 = __importDefault(require("./routes/githubRoutes"));
const emailRoutes_1 = __importDefault(require("./routes/emailRoutes"));
// Set up uncaught exception handler
(0, errorHandlerProduction_2.setupUncaughtHandlers)();
// Apply compression middleware early in the stack
exports.app.use(compression_1.compressionMiddleware);
// Set security headers
exports.app.use((0, helmet_1.default)());
exports.app.use(compression_1.securityHeaders);
// Only log requests in development mode
if (process.env.NODE_ENV === 'development') {
    const { requestLogger } = require('./middleware/requestLogger');
    exports.app.use(requestLogger);
}
// Set up rate limiters for special routes
// For webhooks, no rate limiting
exports.app.post("/api/v1/webhooks/stripe", express_1.default.raw({ type: 'application/json' }), (req, res) => {
    const { stripeWebhook } = require('./controller/paymentController');
    stripeWebhook(req, res);
});
exports.app.post("/api/v1/webhook/flutterwave", express_1.default.json(), (req, res) => {
    const { flutterwaveWebhook } = require('./controller/paymentController');
    flutterwaveWebhook(req, res);
});
// Body parsing middleware
exports.app.use(express_1.default.json({ limit: "50mb" }));
exports.app.use((0, cookie_parser_1.default)());
// Configure CORS more securely for production
const corsOptions = {
    origin: process.env.NODE_ENV === 'production'
        ? [process.env.ORIGIN || 'https://projectrix.app']
        : process.env.ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400, // 24 hours cache preflight requests
};
exports.app.use((0, cors_1.default)(corsOptions));
// Set performance headers
exports.app.use(compression_1.setPerformanceHeaders);
// Apply rate limiters to different routes
exports.app.use('/api/v1/auth', rateLimiter_1.authRateLimiter);
exports.app.use('/api/v1/generate', rateLimiter_1.projectGenerationRateLimiter);
// Mount API routes
exports.app.use("/api/v1", userRoute_1.default);
exports.app.use("/api/v1", generateRoute_1.default);
exports.app.use("/api/v1", userProfileRoutes_1.default);
exports.app.use("/api/v1", githubRoutes_1.default);
exports.app.use("/api/v1", collaborationRoutes_1.default);
exports.app.use("/api/v1", paymentRoutes_1.default);
exports.app.use("/api/v1", publishedProjectsRoutes_1.default);
exports.app.use("/api/v1", feedbackRoutes_1.default);
exports.app.use("/api/v1", discordRoutes_1.default);
exports.app.use("/api/v1", emailRoutes_1.default);
exports.app.use("/api/v1", activityRoutes_1.default);
exports.app.use("/api/v1", analyticsRoutes_1.default);
exports.app.use("/api/v1", adminUsersRoutes_1.default);
// Simple health check endpoint
exports.app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        timestamp: new Date().toISOString()
    });
});
// Handle 404 errors - must be after all valid routes
exports.app.all("*", (req, res, next) => {
    const err = new Error(`Route ${req.originalUrl} not found`);
    err.statusCode = 404;
    next(err);
});
// Error handling middleware chain
exports.app.use(errorHandlerProduction_1.errorLogger);
exports.app.use((err, req, res, next) => {
    const { handleAIError } = require('./utils/aiErrorHandler');
    handleAIError(err, req, res, next);
});
exports.app.use((err, req, res, next) => {
    (0, errorHandlerProduction_1.productionErrorHandler)(err, req, res, next);
});
exports.app.use(error_1.ErrorMiddleware);
