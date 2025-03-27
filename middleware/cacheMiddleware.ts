import { Request, Response, NextFunction } from 'express';
import { redis } from '../utils/redis';

interface CacheOptions {
  duration: number; // Cache duration in seconds
  keyGenerator?: (req: Request) => string;
}

/**
 * Middleware to cache API responses
 * @param options Cache options
 */
export const cacheMiddleware = (options: CacheOptions) => {
  return async (req: Request, res: Response, next: NextFunction) => {
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
      const cachedResponse = await redis.get(cacheKey);
      
      if (cachedResponse) {
        // Return cached response
        const parsedResponse = JSON.parse(cachedResponse);
        return res.status(200).json(parsedResponse);
      }
      
      // If no cache, capture the response
      const originalSend = res.send;
      
      // Override send method to cache the response
      res.send = function(body): Response {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          // Parse response body
          let responseBody;
          try {
            responseBody = JSON.parse(body.toString());
            
            // Store in Redis cache
            redis.set(
              cacheKey, 
              JSON.stringify(responseBody), 
              'EX', 
              options.duration
            ).catch(err => console.error('Redis cache error:', err));
          } catch (e) {
            // If body can't be parsed as JSON, don't cache
            console.error('Cannot cache non-JSON response');
          }
        }
        
        // Call original send method
        return originalSend.call(this, body);
      };
      
      next();
    } catch (error) {
      // If Redis fails, continue without caching
      console.error('Cache middleware error:', error);
      next();
    }
  };
};

/**
 * Cache middleware for public project listings
 */
export const projectListingCache = cacheMiddleware({
  duration: 60 * 5, // 5 minutes
  keyGenerator: (req: Request) => {
    // Create a key based on URL and query parameters
    const queryParams = new URLSearchParams(req.query as any).toString();
    return `cache:projects:${queryParams || 'all'}`;
  }
});

/**
 * Cache middleware for public user profiles
 */
export const userProfileCache = cacheMiddleware({
  duration: 60 * 15, // 15 minutes
  keyGenerator: (req: Request) => {
    return `cache:profile:${req.params.username}`;
  }
});

/**
 * Cache middleware for technology and role lists
 */
export const technologiesCache = cacheMiddleware({
  duration: 60 * 60, // 1 hour
});

/**
 * Invalidate cache by pattern
 * @param pattern Cache key pattern to invalidate
 */
export const invalidateCache = async (pattern: string): Promise<void> => {
  try {
    // Use Redis SCAN to find keys matching the pattern
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor, 
        'MATCH', 
        pattern, 
        'COUNT', 
        '100'
      );
      
      cursor = nextCursor;
      
      // Delete found keys if any
      if (keys.length > 0) {
        await redis.del(...keys);
        console.log(`Invalidated ${keys.length} cache keys matching: ${pattern}`);
      }
    } while (cursor !== '0');
  } catch (error) {
    console.error('Cache invalidation error:', error);
  }
};

export const staticCacheControl = (req: Request, res: Response, next: NextFunction) => {
  // Set Cache-Control headers for API responses that don't change often
  if (req.method === 'GET') {
    if (req.path.includes('/published-projects/technologies') || 
        req.path.includes('/published-projects/roles')) {
      res.set('Cache-Control', 'public, max-age=3600'); // 1 hour
    }
  }
  next();
};