"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshToken = exports.validateToken = exports.refreshUserCache = exports.updateUserPreferences = exports.getUserProfile = exports.logout = exports.githubAuth = void 0;
const catchAsyncErrors_1 = require("../middleware/catchAsyncErrors");
const ErrorHandler_1 = __importDefault(require("../utils/ErrorHandler"));
const redis_1 = require("../utils/redis");
const fbauth_1 = require("../utils/fbauth");
const userModel_1 = __importDefault(require("../models/userModel"));
const pricingUtils_1 = require("../utils/pricingUtils");
const emailController_1 = require("./emailController");
const axios_1 = __importDefault(require("axios"));
// Register or login user with GitHub
exports.githubAuth = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        console.log('Starting GitHub auth process...');
        const { token } = req.body;
        if (!token) {
            return next(new ErrorHandler_1.default('Please provide a token', 400));
        }
        try {
            // Verify Firebase token and get user data
            const decodedToken = await (0, fbauth_1.verifyFirebaseToken)(token);
            if (!decodedToken) {
                return next(new ErrorHandler_1.default('Invalid token', 401));
            }
            // Extract user information from decoded token
            const { uid: githubId, email, name: displayName, picture: photoURL, } = decodedToken;
            // Use email username or a fallback if none exists
            let username = email ? email.split('@')[0] : `user_${githubId.substring(0, 8)}`;
            // Important: Get the actual GitHub username by making a request to GitHub API
            let githubUsername = username;
            // Get GitHub identity from Firebase
            const githubIdentities = decodedToken.firebase?.identities?.['github.com'];
            if (githubIdentities && githubIdentities.length > 0) {
                // Try to get the actual GitHub username
                try {
                    // Get the GitHub user ID from Firebase identities
                    const githubUserId = githubIdentities[0];
                    // Make a request to GitHub API to get the username
                    const githubUserResponse = await axios_1.default.get(`https://api.github.com/user/${githubUserId}`, {
                        headers: {
                            Accept: 'application/vnd.github.v3+json',
                        }
                    });
                    if (githubUserResponse.data && githubUserResponse.data.login) {
                        githubUsername = githubUserResponse.data.login;
                        console.log(`Fetched GitHub username: ${githubUsername}`);
                    }
                }
                catch (githubError) {
                    console.error('Error fetching GitHub username:', githubError);
                    // Continue with the default username if GitHub API call fails
                }
            }
            // Check if user already exists
            let user = await userModel_1.default.findOne({ githubId });
            let isNewUser = false;
            if (!user) {
                console.log('Creating new user...');
                isNewUser = true;
                // Create new user with default project limits
                const userData = {
                    name: displayName || username,
                    email: email || `${username}@github.com`,
                    avatar: photoURL || `https://avatars.githubusercontent.com/${githubUsername}`,
                    githubId,
                    username, // This is the local username for our app
                    githubUsername, // Store the actual GitHub username separately - NEW FIELD
                    skills: [],
                    projectIdeasLeft: 3, // Default number of free projects
                    projectsGenerated: 0,
                    publishedProjectsCount: 0,
                    collaborationRequestsLeft: 3,
                    createdAt: new Date(),
                    lastLogin: new Date(),
                    role: 'user',
                    plan: 'free',
                    newsletterSubscribed: true,
                    emailVerified: !!email,
                };
                // Initialize user plan limits
                (0, pricingUtils_1.initializeUserPlanLimits)(userData);
                user = await userModel_1.default.create(userData);
                console.log('New user created:', user._id);
                // Send welcome email for new users
                if (email) {
                    const userId = user._id;
                    // Send welcome email asynchronously (don't await)
                    (0, emailController_1.sendUserWelcomeEmail)(userId.toString())
                        .then((result) => {
                        console.log(`Welcome email sent to ${email}: ${result ? 'Success' : 'Failed'}`);
                    })
                        .catch((error) => {
                        console.error('Error sending welcome email:', error);
                    });
                }
            }
            else {
                console.log('Existing user found:', user._id);
                // Update GitHub username if it has changed or wasn't set before
                if (!user.githubUsername || user.githubUsername !== githubUsername) {
                    user.githubUsername = githubUsername;
                    console.log(`Updated GitHub username to: ${githubUsername}`);
                }
                await user.save();
            }
            // Calculate token expiration time
            // Firebase tokens expire in 1 hour by default
            const tokenExpiresIn = 3600; // 1 hour in seconds
            // Cache user data in Redis - 1 hour (3600 seconds) to match token expiry
            await redis_1.redis.set(githubId, JSON.stringify(user), 'EX', tokenExpiresIn);
            res.status(200).json({
                success: true,
                user,
                tokenExpiresIn, // Include token expires info for frontend
                isNewUser, // Include flag indicating if user is new
            });
        }
        catch (verificationError) {
            console.error('Token Verification Error:', {
                name: verificationError.name,
                message: verificationError.message,
                code: verificationError.code,
            });
            return next(new ErrorHandler_1.default(`Token verification failed: ${verificationError.message}`, 401));
        }
    }
    catch (error) {
        console.error('GitHub Auth Error:', {
            name: error.name,
            message: error.message,
            code: error.code,
        });
        return next(new ErrorHandler_1.default(error.message || 'Authentication failed', error.statusCode || 400));
    }
});
// Logout user
exports.logout = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        // User is already authenticated via the middleware
        const user = req.user;
        if (!user) {
            return next(new ErrorHandler_1.default('Not authenticated', 401));
        }
        // Get the token from authorization header
        const token = req.headers.authorization?.split('Bearer ')[1];
        // Remove user data from Redis
        await redis_1.redis.del(user.githubId);
        console.log('User removed from Redis cache');
        // Add the token to a blacklist in Redis to prevent reuse
        // The handleLogout middleware should have already blacklisted the token,
        // but we'll add an additional check here
        if (token) {
            const tokenInfo = await (0, fbauth_1.verifyFirebaseToken)(token).catch(() => null);
            if (tokenInfo && tokenInfo.exp) {
                // Calculate token time to live in seconds
                const ttl = tokenInfo.exp - Math.floor(Date.now() / 1000);
                if (ttl > 0) {
                    // Store token in blacklist with the same expiry as the token
                    await redis_1.redis.set(`blacklist:${token}`, '1', 'EX', ttl);
                    console.log(`Token blacklisted for ${ttl} seconds`);
                }
            }
        }
        res.status(200).json({
            success: true,
            message: 'Logged out successfully',
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message || 'Logout failed', 400));
    }
});
// Get user profile
exports.getUserProfile = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const user = req.user;
        if (!user) {
            return next(new ErrorHandler_1.default('Please login to access this resource', 401));
        }
        // Get fresh user data from database to ensure it's up-to-date
        const freshUser = await userModel_1.default.findById(user._id);
        if (!freshUser) {
            return next(new ErrorHandler_1.default('User not found', 404));
        }
        res.status(200).json({
            success: true,
            user: freshUser,
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
});
// Update user preferences
exports.updateUserPreferences = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const user = req.user;
        if (!user) {
            return next(new ErrorHandler_1.default('Please login to update preferences', 401));
        }
        const { skills, bio, isAvailable, contactPreferences } = req.body;
        // Only update fields that are provided in the request
        const updateData = {};
        if (skills !== undefined)
            updateData.skills = skills;
        if (bio !== undefined)
            updateData.bio = bio;
        if (isAvailable !== undefined)
            updateData.isAvailable = isAvailable;
        if (contactPreferences !== undefined)
            updateData.contactPreferences = contactPreferences;
        // Update user in database
        const updatedUser = await userModel_1.default.findByIdAndUpdate(user._id, updateData, { new: true, runValidators: true });
        if (!updatedUser) {
            return next(new ErrorHandler_1.default('User not found', 404));
        }
        // Update Redis cache with fresh user data - 1 hour expiry
        await redis_1.redis.set(user.githubId, JSON.stringify(updatedUser), 'EX', 3600);
        res.status(200).json({
            success: true,
            user: updatedUser
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
});
// For refreshing user data in the Redis cache
exports.refreshUserCache = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const user = req.user;
        if (!user) {
            return next(new ErrorHandler_1.default('Not authenticated', 401));
        }
        // Get fresh user data from database
        const freshUser = await userModel_1.default.findById(user._id);
        if (!freshUser) {
            return next(new ErrorHandler_1.default('User not found', 404));
        }
        // Update Redis cache with fresh user data - 1 hour expiry
        await redis_1.redis.set(user.githubId, JSON.stringify(freshUser), 'EX', 3600);
        res.status(200).json({
            success: true,
            user: freshUser,
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message || 'Failed to refresh user cache', 400));
    }
});
// Validate token
exports.validateToken = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        // Token validation is already handled by isAuthenticated middleware
        // This route simply confirms that the token is valid
        res.status(200).json({
            success: true,
            message: 'Token is valid',
            user: req.user
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message || 'Token validation failed', 400));
    }
});
// Refresh token
exports.refreshToken = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { token } = req.body;
        if (!token) {
            return next(new ErrorHandler_1.default('Please provide a token', 400));
        }
        // Verify current token
        const decodedToken = await (0, fbauth_1.verifyFirebaseToken)(token);
        const userId = decodedToken.uid;
        console.log('Decoded Firebase Token:', decodedToken);
        // Check if user exists
        const user = await userModel_1.default.findOne({ githubId: userId });
        if (!user) {
            return next(new ErrorHandler_1.default('User not found', 404));
        }
        // Update Redis cache with fresh token expiry - 1 hour
        await redis_1.redis.set(userId, JSON.stringify(user), 'EX', 3600);
        res.status(200).json({
            success: true,
            message: 'Token refreshed successfully',
            user,
            tokenExpiresIn: 3600 // 1 hour in seconds
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message || 'Token refresh failed', 400));
    }
});
