"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshUserLimits = exports.deleteUser = exports.updateUserPlan = exports.updateUserRole = exports.getUserById = exports.getUsers = void 0;
const catchAsyncErrors_1 = require("../middleware/catchAsyncErrors");
const ErrorHandler_1 = __importDefault(require("../utils/ErrorHandler"));
const userModel_1 = __importDefault(require("../models/userModel"));
const redis_1 = require("../utils/redis");
const pricingUtils_1 = require("../utils/pricingUtils");
// Get all users with filtering, sorting, and pagination
exports.getUsers = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        // Extract query parameters
        const { search, role, plan, sort = 'newest', page = 1, limit = 10 } = req.query;
        // Build query object
        const query = {};
        // Add search filter (searching in name, email, or username)
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            query.$or = [
                { name: searchRegex },
                { email: searchRegex },
                { username: searchRegex }
            ];
        }
        // Add role filter
        if (role && role !== 'all') {
            query.role = role;
        }
        // Add plan filter
        if (plan && plan !== 'all') {
            query.plan = plan;
        }
        // Determine sort order
        let sortOptions = {};
        switch (sort) {
            case 'newest':
                sortOptions = { createdAt: -1 };
                break;
            case 'oldest':
                sortOptions = { createdAt: 1 };
                break;
            case 'name':
                sortOptions = { name: 1 };
                break;
            case 'projects':
                sortOptions = { projectsGenerated: -1 };
                break;
            default:
                sortOptions = { createdAt: -1 };
        }
        // Calculate pagination
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const skip = (pageNum - 1) * limitNum;
        // Execute query with pagination
        const users = await userModel_1.default.find(query)
            .sort(sortOptions)
            .skip(skip)
            .limit(limitNum)
            .select('-password');
        // Get total count for pagination
        const totalUsers = await userModel_1.default.countDocuments(query);
        // Send response
        res.status(200).json({
            success: true,
            totalUsers,
            count: users.length,
            totalPages: Math.ceil(totalUsers / limitNum),
            currentPage: pageNum,
            users
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
// Get user by ID
exports.getUserById = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = await userModel_1.default.findById(id).select('-password');
        if (!user) {
            return next(new ErrorHandler_1.default('User not found', 404));
        }
        res.status(200).json({
            success: true,
            user
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
// Update user role
exports.updateUserRole = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { id } = req.params;
        const { role } = req.body;
        // Validate role
        if (!['user', 'admin'].includes(role)) {
            return next(new ErrorHandler_1.default('Invalid role value', 400));
        }
        // Get current admin user (for validation)
        if (!req.user) {
            return next(new ErrorHandler_1.default("Authentication required", 401));
        }
        const adminId = req.user._id;
        // Prevent admin from changing their own role
        if (id === adminId.toString()) {
            return next(new ErrorHandler_1.default('You cannot change your own role', 403));
        }
        // Update user role
        const user = await userModel_1.default.findByIdAndUpdate(id, { role }, { new: true, runValidators: true }).select('-password');
        if (!user) {
            return next(new ErrorHandler_1.default('User not found', 404));
        }
        // Update Redis cache
        await redis_1.redis.set(user.githubId, JSON.stringify(user), 'EX', 3600);
        res.status(200).json({
            success: true,
            message: `User role updated to ${role}`,
            user
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
// Update user plan
exports.updateUserPlan = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { id } = req.params;
        const { plan } = req.body;
        // Validate plan
        if (!['free', 'pro'].includes(plan)) {
            return next(new ErrorHandler_1.default('Invalid plan value', 400));
        }
        // Check if user exists
        const user = await userModel_1.default.findById(id);
        if (!user) {
            return next(new ErrorHandler_1.default('User not found', 404));
        }
        // If plan is changing, update limits appropriately
        if (user.plan !== plan) {
            user.plan = plan;
            // Reset limits based on the new plan
            if (plan === 'pro') {
                // Pro users get unlimited project generation and collaboration requests
                user.projectIdeasLeft = 999999;
                user.collaborationRequestsLeft = 999999;
                // Set plan expiry date (e.g., 1 month from now)
                const expiryDate = new Date();
                expiryDate.setMonth(expiryDate.getMonth() + 1);
                user.planExpiryDate = expiryDate;
            }
            else {
                // Free users get 3 project ideas and 3 collaboration requests per month
                user.projectIdeasLeft = 3;
                user.collaborationRequestsLeft = 3;
                // Remove plan expiry date
                user.planExpiryDate = undefined;
            }
        }
        // Save the updated user
        await user.save();
        // Update Redis cache
        await redis_1.redis.set(user.githubId, JSON.stringify(user), 'EX', 3600);
        res.status(200).json({
            success: true,
            message: `User plan updated to ${plan}`,
            user
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
// Delete user
exports.deleteUser = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!req.user) {
            return next(new ErrorHandler_1.default("Authentication required", 401));
        }
        // Get current admin user (for validation)
        const adminId = req.user._id;
        // Prevent admin from deleting themselves
        if (id === adminId.toString()) {
            return next(new ErrorHandler_1.default('You cannot delete your own account', 403));
        }
        // Find the user
        const user = await userModel_1.default.findById(id);
        if (!user) {
            return next(new ErrorHandler_1.default('User not found', 404));
        }
        // Remove user from Redis cache
        await redis_1.redis.del(user.githubId);
        // Delete the user
        await userModel_1.default.findByIdAndDelete(id);
        res.status(200).json({
            success: true,
            message: 'User deleted successfully'
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
// Refresh user limits
exports.refreshUserLimits = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { id } = req.params;
        // Find the user
        const user = await userModel_1.default.findById(id);
        if (!user) {
            return next(new ErrorHandler_1.default('User not found', 404));
        }
        // Re-initialize user plan limits
        (0, pricingUtils_1.initializeUserPlanLimits)(user);
        // Save the updated user
        await user.save();
        // Update Redis cache
        await redis_1.redis.set(user.githubId, JSON.stringify(user), 'EX', 3600);
        res.status(200).json({
            success: true,
            message: 'User limits refreshed successfully',
            user
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
