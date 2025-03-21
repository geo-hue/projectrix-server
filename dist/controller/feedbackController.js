"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateFeedbackStatus = exports.getAllFeedback = exports.upvoteFeedback = exports.getPublicFeedback = exports.getMyFeedback = exports.submitFeedback = void 0;
const catchAsyncErrors_1 = require("../middleware/catchAsyncErrors");
const ErrorHandler_1 = __importDefault(require("../utils/ErrorHandler"));
const feedback_model_1 = __importDefault(require("../models/feedback.model"));
const activityUtils_1 = require("../utils/activityUtils");
// Submit new feedback
exports.submitFeedback = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        if (!req.user) {
            return next(new ErrorHandler_1.default("Authentication required", 401));
        }
        const { category, title, description, rating, tags } = req.body;
        // Validate required fields
        if (!category) {
            return next(new ErrorHandler_1.default("Category is required", 400));
        }
        if (!title) {
            return next(new ErrorHandler_1.default("Title is required", 400));
        }
        if (!description) {
            return next(new ErrorHandler_1.default("Description is required", 400));
        }
        // Create feedback
        const feedback = await feedback_model_1.default.create({
            userId: req.user._id,
            category,
            title,
            description,
            rating: rating || 5,
            tags: tags || [],
            status: 'pending'
        });
        res.status(201).json({
            success: true,
            message: "Feedback submitted successfully",
            feedback
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
// Get my feedback
exports.getMyFeedback = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        if (!req.user) {
            return next(new ErrorHandler_1.default("Authentication required", 401));
        }
        const feedback = await feedback_model_1.default.find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .populate('userId', 'name username avatar');
        res.status(200).json({
            success: true,
            count: feedback.length,
            feedback
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
// Get public feedback
exports.getPublicFeedback = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { category, status, sort = 'upvotes', order = 'desc', limit = '50' } = req.query;
        // Build query
        const query = {};
        if (category)
            query.category = category;
        if (status)
            query.status = status;
        // Parse limit
        const limitNum = parseInt(limit) || 50;
        // Sort options
        const sortOptions = {};
        if (sort === 'upvotes') {
            // For upvotes, we need to sort by the length of the upvotes array
            sortOptions['upvotes'] = order === 'asc' ? 1 : -1;
        }
        else if (sort === 'createdAt') {
            sortOptions['createdAt'] = order === 'asc' ? 1 : -1;
        }
        // Execute query
        const feedback = await feedback_model_1.default.find(query)
            .sort(sortOptions)
            .limit(limitNum)
            .populate('userId', 'name username avatar');
        res.status(200).json({
            success: true,
            count: feedback.length,
            feedback
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
// Upvote feedback
exports.upvoteFeedback = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        if (!req.user) {
            return next(new ErrorHandler_1.default("Authentication required", 401));
        }
        const userId = req.user._id;
        const { feedbackId } = req.params;
        // Find feedback
        const feedback = await feedback_model_1.default.findById(feedbackId);
        if (!feedback) {
            return next(new ErrorHandler_1.default("Feedback not found", 404));
        }
        // Check if user already upvoted
        const alreadyUpvoted = feedback.upvotes.some(id => id.toString() === userId.toString());
        // Toggle upvote
        if (alreadyUpvoted) {
            // Remove upvote
            feedback.upvotes = feedback.upvotes.filter(id => id.toString() !== userId.toString());
        }
        else {
            // Add upvote
            feedback.upvotes.push(userId);
        }
        await feedback.save();
        res.status(200).json({
            success: true,
            message: alreadyUpvoted ? "Upvote removed" : "Upvote added",
            upvoteCount: feedback.upvotes.length,
            isUpvoted: !alreadyUpvoted
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
// ADMIN ROUTES
// Get all feedback (admin only)
exports.getAllFeedback = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        if (!req.user || req.user.role !== 'admin') {
            return next(new ErrorHandler_1.default("Not authorized", 403));
        }
        const { category, status, sort = 'upvotes', order = 'desc' } = req.query;
        // Build query
        const query = {};
        if (category)
            query.category = category;
        if (status)
            query.status = status;
        // Sort options
        const sortOptions = {};
        if (sort === 'upvotes') {
            sortOptions['upvotes'] = order === 'asc' ? 1 : -1;
        }
        else if (sort === 'createdAt') {
            sortOptions['createdAt'] = order === 'asc' ? 1 : -1;
        }
        // Execute query
        const feedback = await feedback_model_1.default.find(query)
            .sort(sortOptions)
            .populate('userId', 'name username avatar');
        res.status(200).json({
            success: true,
            count: feedback.length,
            feedback
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
// Update feedback status (admin only)
exports.updateFeedbackStatus = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        if (!req.user || req.user.role !== 'admin') {
            return next(new ErrorHandler_1.default("Not authorized", 403));
        }
        const { feedbackId } = req.params;
        const { status } = req.body;
        // Validate status
        if (!['pending', 'under-review', 'implemented', 'declined'].includes(status)) {
            return next(new ErrorHandler_1.default("Invalid status value", 400));
        }
        // Find and update feedback
        const feedback = await feedback_model_1.default.findByIdAndUpdate(feedbackId, { status, updatedAt: new Date() }, { new: true, runValidators: true }).populate('userId', 'name username avatar');
        if (!feedback) {
            return next(new ErrorHandler_1.default("Feedback not found", 404));
        }
        await (0, activityUtils_1.createFeedbackResponseActivity)(feedback.userId.toString(), feedback._id?.toString() || feedback.id, feedback.title, status);
        res.status(200).json({
            success: true,
            message: `Feedback status updated to ${status}`,
            feedback
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
