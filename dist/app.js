"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
require('dotenv').config();
const express_1 = __importDefault(require("express"));
exports.app = (0, express_1.default)();
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const error_1 = require("./middleware/error");
const userRoute_1 = __importDefault(require("./routes/userRoute"));
const generateRoute_1 = __importDefault(require("./routes/generateRoute"));
const requestLogger_1 = require("./middleware/requestLogger");
const userProfileRoutes_1 = __importDefault(require("./routes/userProfileRoutes"));
const collaborationRoutes_1 = __importDefault(require("./routes/collaborationRoutes"));
const publishedProjectsRoutes_1 = __importDefault(require("./routes/publishedProjectsRoutes"));
const feedbackRoutes_1 = __importDefault(require("./routes/feedbackRoutes"));
const discordRoutes_1 = __importDefault(require("./routes/discordRoutes"));
const activityRoutes_1 = __importDefault(require("./routes/activityRoutes"));
const aiErrorHandler_1 = require("./utils/aiErrorHandler");
const adminUsersRoutes_1 = __importDefault(require("./routes/adminUsersRoutes"));
const analyticsRoutes_1 = __importDefault(require("./routes/analyticsRoutes"));
const paymentRoutes_1 = __importDefault(require("./routes/paymentRoutes"));
const githubRoutes_1 = __importDefault(require("./routes/githubRoutes"));
const emailRoutes_1 = __importDefault(require("./routes/emailRoutes"));
const promoCodeRoutes_1 = __importDefault(require("./routes/promoCodeRoutes"));
const rateLimiter_1 = require("./middleware/rateLimiter");
const compression_1 = require("./middleware/compression");
const cacheMiddleware_1 = require("./middleware/cacheMiddleware");
exports.app.post("/api/v1/webhooks/stripe", express_1.default.raw({ type: 'application/json' }), (req, res) => {
    const { stripeWebhook } = require('./controller/paymentController');
    stripeWebhook(req, res);
});
exports.app.post("/api/v1/webhook/flutterwave", express_1.default.json(), (req, res) => {
    const { flutterwaveWebhook } = require('./controller/paymentController');
    flutterwaveWebhook(req, res);
});
exports.app.use(express_1.default.json({ limit: "50mb" }));
exports.app.use((0, cookie_parser_1.default)());
exports.app.use((0, cors_1.default)({
    origin: process.env.ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
}));
exports.app.use(compression_1.compressionMiddleware);
exports.app.use(compression_1.securityHeaders);
exports.app.use(requestLogger_1.requestLogger);
exports.app.use(cacheMiddleware_1.staticCacheControl);
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
exports.app.use("/api/v1", promoCodeRoutes_1.default);
exports.app.use("/api/v1", analyticsRoutes_1.default);
exports.app.use("/api/v1", adminUsersRoutes_1.default);
exports.app.use("/api/v1/generate", rateLimiter_1.projectGenerationRateLimiter);
exports.app.get("/test", (req, res, next) => {
    res.status(200).json({
        success: "true",
        message: "API is working"
    });
});
exports.app.all("*", (req, res, next) => {
    const err = new Error(`Route ${req.originalUrl} not found`);
    err.statusCode = 404;
    next(err);
});
exports.app.use((err, req, res, next) => {
    (0, aiErrorHandler_1.handleAIError)(err, req, res, next);
});
exports.app.use(error_1.ErrorMiddleware);
