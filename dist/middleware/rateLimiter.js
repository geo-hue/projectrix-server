"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRateLimiter = exports.projectGenerationRateLimiter = exports.apiRateLimiter = exports.createRateLimiter = void 0;
const redis_1 = require("../utils/redis");
const ErrorHandler_1 = __importDefault(require("../utils/ErrorHandler"));
/**
 * Create a rate limiter middleware
 * @param options Rate limit options
 */
const createRateLimiter = (options) => {
    const { windowMs, max, standardHeaders } = options;
    return async (req, res, next) => {
        // Get client IP or custom key
        const key = options.keyGenerator
            ? options.keyGenerator(req)
            : `ratelimit:${req.ip}:${req.path}`;
        try {
            // Get current count from Redis
            const current = await redis_1.redis.get(key);
            const count = current ? parseInt(current, 10) : 0;
            // Set the key if it doesn't exist yet with expiry
            if (count === 0) {
                await redis_1.redis.set(key, '1', 'EX', windowMs / 1000);
            }
            else if (count < max) {
                // Increment the counter
                await redis_1.redis.incr(key);
            }
            else {
                // Too many requests
                if (standardHeaders) {
                    // Get TTL of the key in seconds
                    const ttl = await redis_1.redis.ttl(key);
                    // Set rate limit headers
                    res.setHeader('RateLimit-Limit', max.toString());
                    res.setHeader('RateLimit-Remaining', '0');
                    res.setHeader('RateLimit-Reset', Math.ceil(Date.now() / 1000 + ttl).toString());
                    res.setHeader('Retry-After', ttl.toString());
                }
                return next(new ErrorHandler_1.default('Too many requests, please try again later.', 429));
            }
            // Set headers if enabled
            if (standardHeaders) {
                const remaining = Math.max(0, max - (count + 1));
                // Get TTL of the key in seconds
                const ttl = await redis_1.redis.ttl(key);
                res.setHeader('RateLimit-Limit', max.toString());
                res.setHeader('RateLimit-Remaining', remaining.toString());
                res.setHeader('RateLimit-Reset', Math.ceil(Date.now() / 1000 + ttl).toString());
            }
            next();
        }
        catch (error) {
            // If Redis fails, allow the request to pass through
            console.error('Rate limiter error:', error);
            next();
        }
    };
};
exports.createRateLimiter = createRateLimiter;
/**
 * Create API rate limiter - stricter limits for API endpoints
 */
exports.apiRateLimiter = (0, exports.createRateLimiter)({
    windowMs: 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute
    standardHeaders: true
});
/**
 * Create project generation rate limiter - limit AI resource usage
 */
exports.projectGenerationRateLimiter = (0, exports.createRateLimiter)({
    windowMs: 60 * 1000, // 1 minute
    max: 5, // 5 generation requests per minute
    standardHeaders: true,
    keyGenerator: (req) => {
        // Use user ID from authenticated user if available
        return req.user
            ? `ratelimit:generate:${req.user._id}`
            : `ratelimit:generate:${req.ip}`;
    }
});
/**
 * Create authentication rate limiter - prevent brute force
 */
exports.authRateLimiter = (0, exports.createRateLimiter)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30, // 30 auth requests per 15 minutes
    standardHeaders: true,
    keyGenerator: (req) => `ratelimit:auth:${req.ip}`
});
