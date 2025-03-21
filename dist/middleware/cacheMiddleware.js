"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invalidateCache = exports.technologiesCache = exports.userProfileCache = exports.projectListingCache = exports.cacheMiddleware = void 0;
const redis_1 = require("../utils/redis");
/**
 * Middleware to cache API responses
 * @param options Cache options
 */
const cacheMiddleware = (options) => {
    return async (req, res, next) => {
        // Skip caching for non-GET requests
        if (req.method !== 'GET') {
            return next();
        }
        // Generate cache key
        const cacheKey = options.keyGenerator
            ? options.keyGenerator(req)
            : `cache:${req.originalUrl || req.url}`;
        try {
            // Check if cache exists
            const cachedResponse = await redis_1.redis.get(cacheKey);
            if (cachedResponse) {
                // Return cached response
                const parsedResponse = JSON.parse(cachedResponse);
                return res.status(200).json(parsedResponse);
            }
            // If no cache, capture the response
            const originalSend = res.send;
            // Override send method to cache the response
            res.send = function (body) {
                // Only cache successful responses
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    // Parse response body
                    let responseBody;
                    try {
                        responseBody = JSON.parse(body.toString());
                        // Store in Redis cache
                        redis_1.redis.set(cacheKey, JSON.stringify(responseBody), 'EX', options.duration).catch(err => console.error('Redis cache error:', err));
                    }
                    catch (e) {
                        // If body can't be parsed as JSON, don't cache
                        console.error('Cannot cache non-JSON response');
                    }
                }
                // Call original send method
                return originalSend.call(this, body);
            };
            next();
        }
        catch (error) {
            // If Redis fails, continue without caching
            console.error('Cache middleware error:', error);
            next();
        }
    };
};
exports.cacheMiddleware = cacheMiddleware;
/**
 * Cache middleware for public project listings
 */
exports.projectListingCache = (0, exports.cacheMiddleware)({
    duration: 60 * 5, // 5 minutes
    keyGenerator: (req) => {
        // Create a key based on URL and query parameters
        const queryParams = new URLSearchParams(req.query).toString();
        return `cache:projects:${queryParams || 'all'}`;
    }
});
/**
 * Cache middleware for public user profiles
 */
exports.userProfileCache = (0, exports.cacheMiddleware)({
    duration: 60 * 15, // 15 minutes
    keyGenerator: (req) => {
        return `cache:profile:${req.params.username}`;
    }
});
/**
 * Cache middleware for technology and role lists
 */
exports.technologiesCache = (0, exports.cacheMiddleware)({
    duration: 60 * 60, // 1 hour
});
/**
 * Invalidate cache by pattern
 * @param pattern Cache key pattern to invalidate
 */
const invalidateCache = async (pattern) => {
    try {
        // Use Redis SCAN to find keys matching the pattern
        let cursor = '0';
        do {
            const [nextCursor, keys] = await redis_1.redis.scan(cursor, 'MATCH', pattern, 'COUNT', '100');
            cursor = nextCursor;
            // Delete found keys if any
            if (keys.length > 0) {
                await redis_1.redis.del(...keys);
                console.log(`Invalidated ${keys.length} cache keys matching: ${pattern}`);
            }
        } while (cursor !== '0');
    }
    catch (error) {
        console.error('Cache invalidation error:', error);
    }
};
exports.invalidateCache = invalidateCache;
