"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAuthenticated = exports.verifyFirebaseToken = exports.auth = void 0;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const redis_1 = require("./redis");
const userModel_1 = __importDefault(require("../models/userModel"));
const ErrorHandler_1 = __importDefault(require("./ErrorHandler"));
// Initialize Firebase Admin only once
if (!firebase_admin_1.default.apps.length) {
    // Check if environment variables are defined
    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
        throw new Error('Firebase configuration is missing. Check your environment variables.');
    }
    firebase_admin_1.default.initializeApp({
        credential: firebase_admin_1.default.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
    });
}
exports.auth = firebase_admin_1.default.auth();
const verifyFirebaseToken = async (token) => {
    try {
        console.log('🔍 Verifying Firebase token...');
        const decodedToken = await exports.auth.verifyIdToken(token);
        console.log('✅ Token verified. User ID:', decodedToken.uid);
        return decodedToken;
    }
    catch (error) {
        console.error('❌ Token verification failed:', error);
        throw error; // Keep the original error for better debugging
    }
};
exports.verifyFirebaseToken = verifyFirebaseToken;
// Remove the interface definition that was causing conflicts
// And also remove the global declaration
const isAuthenticated = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split('Bearer ')[1];
        if (!token) {
            return next(new ErrorHandler_1.default('Authentication token is required', 401));
        }
        // Verify Firebase token
        const decodedToken = await (0, exports.verifyFirebaseToken)(token);
        const userId = decodedToken.uid;
        // Try getting user from cache first (Redis)
        const cachedUser = await redis_1.redis.get(userId);
        let user = null;
        if (cachedUser) {
            try {
                user = JSON.parse(cachedUser);
                console.log('✅ User found in Redis cache');
            }
            catch (error) {
                console.error('Error parsing cached user:', error);
            }
        }
        if (!user) {
            // Get from database if not in cache
            user = await userModel_1.default.findOne({ githubId: userId });
            if (!user) {
                return next(new ErrorHandler_1.default('User not found. Please log in again.', 404));
            }
            // Cache user data - Set to 24 hours (86400 seconds)
            await redis_1.redis.set(userId, JSON.stringify(user), 'EX', 86400);
            console.log('✅ User cached in Redis');
        }
        // Use type assertion here to avoid TypeScript errors
        req.user = user;
        next();
    }
    catch (error) {
        console.error('Authentication error:', error);
        return next(new ErrorHandler_1.default('Authentication failed: ' + error.message, 401));
    }
};
exports.isAuthenticated = isAuthenticated;
