import admin from 'firebase-admin';
import { Request, Response, NextFunction } from 'express';
import { redis } from './redis';
import User from '../models/userModel';
import ErrorHandler from './ErrorHandler';

// Initialize Firebase Admin only once
if (!admin.apps.length) {
  // Check if environment variables are defined
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    throw new Error('Firebase configuration is missing. Check your environment variables.');
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

export const auth = admin.auth();

export const verifyFirebaseToken = async (token: string) => {
  try {
    console.log('🔍 Verifying Firebase token...');
    const decodedToken = await auth.verifyIdToken(token);
    console.log('✅ Token verified. User ID:', decodedToken.uid);
    return decodedToken;
  } catch (error) {
    console.error('❌ Token verification failed:', error);
    throw error; // Keep the original error for better debugging
  }
};

// Remove the interface definition that was causing conflicts
// And also remove the global declaration

export const isAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    
    if (!token) {
      return next(new ErrorHandler('Authentication token is required', 401));
    }

    // Verify Firebase token
    const decodedToken = await verifyFirebaseToken(token);
    const userId = decodedToken.uid;

    // Try getting user from cache first (Redis)
    const cachedUser = await redis.get(userId);
    let user = null;

    if (cachedUser) {
      try {
        user = JSON.parse(cachedUser);
        console.log('✅ User found in Redis cache');
      } catch (error) {
        console.error('Error parsing cached user:', error);
      }
    }
    
    if (!user) {
      // Get from database if not in cache
      user = await User.findOne({ githubId: userId });
      
      if (!user) {
        return next(new ErrorHandler('User not found. Please log in again.', 404));
      }
      
      // Cache user data - Set to 24 hours (86400 seconds)
      await redis.set(userId, JSON.stringify(user), 'EX', 86400);
      console.log('✅ User cached in Redis');
    }

    // Use type assertion here to avoid TypeScript errors
    req.user = user as any;
    next();
  } catch (error: any) {
    console.error('Authentication error:', error);
    return next(new ErrorHandler('Authentication failed: ' + error.message, 401));
  }
};