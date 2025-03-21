// middleware/rateLimiter.ts
import { Request, Response, NextFunction } from 'express';
import { redis } from '../utils/redis';
import ErrorHandler from '../utils/ErrorHandler';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  standardHeaders: boolean;
  keyGenerator?: (req: Request) => string;
}

/**
 * Create a rate limiter middleware
 * @param options Rate limit options
 */
export const createRateLimiter = (options: RateLimitOptions) => {
  const { windowMs, max, standardHeaders } = options;
  
  return async (req: Request, res: Response, next: NextFunction) => {
    // Get client IP or custom key
    const key = options.keyGenerator 
      ? options.keyGenerator(req) 
      : `ratelimit:${req.ip}:${req.path}`;
      
    try {
      // Get current count from Redis
      const current = await redis.get(key);
      const count = current ? parseInt(current, 10) : 0;
      
      // Set the key if it doesn't exist yet with expiry
      if (count === 0) {
        await redis.set(key, '1', 'EX', windowMs / 1000);
      } else if (count < max) {
        // Increment the counter
        await redis.incr(key);
      } else {
        // Too many requests
        if (standardHeaders) {
          // Get TTL of the key in seconds
          const ttl = await redis.ttl(key);
          
          // Set rate limit headers
          res.setHeader('RateLimit-Limit', max.toString());
          res.setHeader('RateLimit-Remaining', '0');
          res.setHeader('RateLimit-Reset', Math.ceil(Date.now() / 1000 + ttl).toString());
          res.setHeader('Retry-After', ttl.toString());
        }
        
        return next(new ErrorHandler('Too many requests, please try again later.', 429));
      }
      
      // Set headers if enabled
      if (standardHeaders) {
        const remaining = Math.max(0, max - (count + 1));
        // Get TTL of the key in seconds
        const ttl = await redis.ttl(key);
        
        res.setHeader('RateLimit-Limit', max.toString());
        res.setHeader('RateLimit-Remaining', remaining.toString());
        res.setHeader('RateLimit-Reset', Math.ceil(Date.now() / 1000 + ttl).toString());
      }
      
      next();
    } catch (error) {
      // If Redis fails, allow the request to pass through
      console.error('Rate limiter error:', error);
      next();
    }
  };
};

/**
 * Create API rate limiter - stricter limits for API endpoints
 */
export const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  standardHeaders: true
});

/**
 * Create project generation rate limiter - limit AI resource usage
 */
export const projectGenerationRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 generation requests per minute
  standardHeaders: true,
  keyGenerator: (req: Request) => {
    // Use user ID from authenticated user if available
    return req.user 
      ? `ratelimit:generate:${req.user._id}` 
      : `ratelimit:generate:${req.ip}`;
  }
});

/**
 * Create authentication rate limiter - prevent brute force
 */
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 auth requests per 15 minutes
  standardHeaders: true,
  keyGenerator: (req: Request) => `ratelimit:auth:${req.ip}`
});