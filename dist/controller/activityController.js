"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearAllActivities = exports.deleteActivity = exports.markAllAsRead = exports.markActivityAsRead = exports.getUnreadCount = exports.getUserActivities = exports.createActivity = void 0;
const catchAsyncErrors_1 = require("../middleware/catchAsyncErrors");
const ErrorHandler_1 = __importDefault(require("../utils/ErrorHandler"));
const activity_model_1 = __importDefault(require("../models/activity.model"));
// Create an activity record
const createActivity = async (userId, type, message, entityId, entityType, entityName) => {
    try {
        const activity = await activity_model_1.default.create({
            userId,
            type,
            message,
            entityId,
            entityType,
            entityName,
            read: false,
            createdAt: new Date()
        });
        // Emit socket event for real-time notification
        const io = global.io;
        if (io) {
            io.to(userId.toString()).emit('new_activity', {
                activity: {
                    _id: activity._id,
                    type: activity.type,
                    message: activity.message,
                    entityId: activity.entityId,
                    entityType: activity.entityType,
                    entityName: activity.entityName,
                    read: activity.read,
                    createdAt: activity.createdAt
                }
            });
        }
        return activity;
    }
    catch (error) {
        console.error('Error creating activity:', error);
        return null;
    }
};
exports.createActivity = createActivity;
// Get user's activities
exports.getUserActivities = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        if (!req.user) {
            return next(new ErrorHandler_1.default("Authentication required", 401));
        }
        const userId = req.user._id;
        const { page = 1, limit = 20, filter } = req.query;
        // Prepare query
        const query = { userId };
        // Add filter if provided
        if (filter) {
            query.type = filter;
        }
        const options = {
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            sort: { createdAt: -1 }
        };
        // Get total count
        const total = await activity_model_1.default.countDocuments(query);
        // Get paginated activities
        const activities = await activity_model_1.default.find(query)
            .sort({ createdAt: -1 })
            .skip((options.page - 1) * options.limit)
            .limit(options.limit);
        res.status(200).json({
            success: true,
            activities,
            pagination: {
                total,
                page: options.page,
                limit: options.limit,
                pages: Math.ceil(total / options.limit)
            }
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
// Get unread notifications count
exports.getUnreadCount = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        if (!req.user) {
            return next(new ErrorHandler_1.default("Authentication required", 401));
        }
        const userId = req.user._id;
        const count = await activity_model_1.default.countDocuments({ userId, read: false });
        res.status(200).json({
            success: true,
            unreadCount: count
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
// Mark activity as read
exports.markActivityAsRead = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { activityId } = req.params;
        if (!req.user) {
            return next(new ErrorHandler_1.default("Authentication required", 401));
        }
        const userId = req.user._id;
        const activity = await activity_model_1.default.findOne({ _id: activityId, userId });
        if (!activity) {
            return next(new ErrorHandler_1.default("Activity not found", 404));
        }
        activity.read = true;
        await activity.save();
        res.status(200).json({
            success: true,
            message: "Activity marked as read"
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
// Mark all activities as read
exports.markAllAsRead = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        if (!req.user) {
            return next(new ErrorHandler_1.default("Authentication required", 401));
        }
        const userId = req.user._id;
        await activity_model_1.default.updateMany({ userId, read: false }, { read: true });
        res.status(200).json({
            success: true,
            message: "All activities marked as read"
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
// Delete an activity
exports.deleteActivity = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { activityId } = req.params;
        if (!req.user) {
            return next(new ErrorHandler_1.default("Authentication required", 401));
        }
        const userId = req.user._id;
        const activity = await activity_model_1.default.findOne({ _id: activityId, userId });
        if (!activity) {
            return next(new ErrorHandler_1.default("Activity not found", 404));
        }
        await activity.deleteOne();
        res.status(200).json({
            success: true,
            message: "Activity deleted successfully"
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
exports.clearAllActivities = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        if (!req.user) {
            return next(new ErrorHandler_1.default("Authentication required", 401));
        }
        const userId = req.user._id;
        // Delete all activities for this user
        await activity_model_1.default.deleteMany({ userId });
        res.status(200).json({
            success: true,
            message: "All notifications cleared successfully"
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
