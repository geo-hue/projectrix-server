// utils/redis.ts
import { Redis } from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

// Configure Redis client with connection pool options
const redisOptions = {
  maxRetriesPerRequest: 3,
  connectTimeout: 10000,
  // Retry strategy with exponential backoff
  retryStrategy(times: number) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
};

export const redis = new Redis(
  process.env.REDIS_URL || 'redis://localhost:6379',
  redisOptions
);

// Add event handlers for better error recovery
redis.on('error', (err) => {
  console.error('Redis error:', err);
});

redis.on('connect', () => {
  console.log('Redis connected');
});

redis.on('reconnecting', () => {
  console.log('Redis reconnecting');
});