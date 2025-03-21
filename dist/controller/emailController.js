"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNewsletterPreference = exports.updateNewsletterPreference = exports.unsubscribeFromNewsletter = exports.sendNewsletterToAllUsers = exports.sendTestEmail = exports.sendUserWelcomeEmail = void 0;
const catchAsyncErrors_1 = require("../middleware/catchAsyncErrors");
const ErrorHandler_1 = __importDefault(require("../utils/ErrorHandler"));
const userModel_1 = __importDefault(require("../models/userModel"));
const emailService_1 = require("../utils/emailService");
/**
 * Send a welcome email to a new user
 * This is not exposed as an API endpoint but called internally
 */
const sendUserWelcomeEmail = async (userId) => {
    try {
        // Find user
        const user = await userModel_1.default.findById(userId);
        if (!user) {
            console.error(`User not found for welcome email: ${userId}`);
            return false;
        }
        // Send welcome email
        const result = await (0, emailService_1.sendWelcomeEmail)(user);
        if (result) {
            // Update user's lastEmailSent timestamp
            user.lastEmailSent = new Date();
            await user.save();
        }
        return result;
    }
    catch (error) {
        console.error('Error sending welcome email:', error);
        return false;
    }
};
exports.sendUserWelcomeEmail = sendUserWelcomeEmail;
/**
 * Send a test email
 */
exports.sendTestEmail = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        if (!req.user || req.user.role !== 'admin') {
            return next(new ErrorHandler_1.default('Only administrators can send test emails', 403));
        }
        const { email, template, data } = req.body;
        if (!email || !template) {
            return next(new ErrorHandler_1.default('Email and template are required', 400));
        }
        // Send test email
        const result = await (0, emailService_1.sendEmailTemplate)(email, 'Projectrix Test Email', template, data || {});
        if (result) {
            res.status(200).json({
                success: true,
                message: `Test email sent successfully to ${email}`,
            });
        }
        else {
            return next(new ErrorHandler_1.default('Failed to send test email', 500));
        }
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
/**
 * Send newsletter to all subscribed users (admin only)
 */
exports.sendNewsletterToAllUsers = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        if (!req.user || req.user.role !== 'admin') {
            return next(new ErrorHandler_1.default('Only administrators can send newsletters', 403));
        }
        const { subject, template, data } = req.body;
        if (!subject || !template) {
            return next(new ErrorHandler_1.default('Subject and template are required', 400));
        }
        // Send newsletter
        const result = await (0, emailService_1.sendNewsletter)(subject, template, data || {});
        res.status(200).json({
            success: result.success,
            message: `Newsletter sent to ${result.sentCount} users with ${result.failedCount} failures`,
            sentCount: result.sentCount,
            failedCount: result.failedCount,
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
/**
 * Allow users to unsubscribe from newsletters
 */
exports.unsubscribeFromNewsletter = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { email, token } = req.query;
        if (!email) {
            return next(new ErrorHandler_1.default('Email is required', 400));
        }
        // Find user by email
        const user = await userModel_1.default.findOne({ email });
        if (!user) {
            return next(new ErrorHandler_1.default('User not found', 404));
        }
        // Update user's newsletter preference
        user.newsletterSubscribed = false;
        await user.save();
        res.status(200).json({
            success: true,
            message: 'You have been successfully unsubscribed from newsletters',
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
/**
 * Allow authenticated users to update their newsletter preferences
 */
exports.updateNewsletterPreference = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        if (!req.user) {
            return next(new ErrorHandler_1.default('Authentication required', 401));
        }
        const { subscribed } = req.body;
        if (subscribed === undefined) {
            return next(new ErrorHandler_1.default('Subscription preference is required', 400));
        }
        // Update user's newsletter preference
        const user = await userModel_1.default.findByIdAndUpdate(req.user._id, { newsletterSubscribed: !!subscribed }, { new: true });
        res.status(200).json({
            success: true,
            message: subscribed
                ? 'You have been subscribed to newsletters'
                : 'You have been unsubscribed from newsletters',
            user
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
/**
 * Get newsletter preferences for the authenticated user
 */
exports.getNewsletterPreference = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        if (!req.user) {
            return next(new ErrorHandler_1.default('Authentication required', 401));
        }
        // Get fresh user data
        const user = await userModel_1.default.findById(req.user._id);
        if (!user) {
            return next(new ErrorHandler_1.default('User not found', 404));
        }
        res.status(200).json({
            success: true,
            subscribed: user.newsletterSubscribed
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
