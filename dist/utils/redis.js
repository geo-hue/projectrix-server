"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
// utils/redis.ts
const ioredis_1 = require("ioredis");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Configure Redis client with connection pool options
const redisOptions = {
    maxRetriesPerRequest: 3,
    connectTimeout: 10000,
    // Retry strategy with exponential backoff
    retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
    }
};
exports.redis = new ioredis_1.Redis(process.env.REDIS_URL || 'redis://localhost:6379', redisOptions);
// Add event handlers for better error recovery
exports.redis.on('error', (err) => {
    console.error('Redis error:', err);
});
exports.redis.on('connect', () => {
    console.log('Redis connected');
});
exports.redis.on('reconnecting', () => {
    console.log('Redis reconnecting');
});
