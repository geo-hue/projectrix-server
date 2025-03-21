// middleware/compression.ts
import compression from 'compression';
import { Request, Response } from 'express';

/**
 * Configure compression middleware with optimal settings
 * We use a filter to only compress responses over a certain size
 */
export const compressionMiddleware = compression({
  // Only compress responses larger than 1KB
  threshold: 1024,
  
  // Compression filter function - determine which responses to compress
  filter: (req: Request, res: Response) => {
    // Don't compress if client explicitly doesn't want it
    if (req.headers['x-no-compression']) {
      return false;
    }
    
    // Use compression for all other requests
    return compression.filter(req, res);
  },
  
  // Set compression level (1 = fastest, 9 = best compression)
  level: 6,
  
  // Enable memory cache for better performance
  memLevel: 8
});

// Helper to set performance-related headers
export const setPerformanceHeaders = (req: Request, res: Response, next: Function) => {
  // Enable keep-alive connections
  res.setHeader('Connection', 'keep-alive');
  
  // Set Cache-Control for static assets if not already set
  if (req.url.match(/\.(js|css|jpg|jpeg|png|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
    if (!res.getHeader('Cache-Control')) {
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
    }
  }
  
  next();
};

// Security headers middleware
export const securityHeaders = (req: Request, res: Response, next: Function) => {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  
  // Strict Transport Security
  if (process.env.NODE_ENV === 'production') {
    res.setHeader(
      'Strict-Transport-Security', 
      'max-age=31536000; includeSubDomains; preload'
    );
  }
  
  next();
};