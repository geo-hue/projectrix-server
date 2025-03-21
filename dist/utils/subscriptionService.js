"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.toggleAutoRenewal = exports.getUserSubscriptionStatus = exports.processAutoRenewals = exports.processSubscriptionReminders = void 0;
// utils/subscriptionService.ts
const userModel_1 = __importDefault(require("../models/userModel"));
const subscription_model_1 = __importDefault(require("../models/subscription.model"));
const emailService_1 = require("./emailService");
const date_fns_1 = require("date-fns");
/**
 * Check for subscriptions that are about to expire and send reminders
 * This function should be called by the cron job
 */
const processSubscriptionReminders = async () => {
    try {
        console.log('Processing subscription reminders...');
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize to start of day
        // Find active or cancelled subscriptions ending in 7, 3, or 1 days
        const reminderDays = [7, 3, 1];
        for (const days of reminderDays) {
            const targetDate = (0, date_fns_1.addDays)(today, days);
            // Find subscriptions expiring on the target date
            const expiringSubscriptions = await subscription_model_1.default.find({
                status: { $in: ['active', 'cancelled'] },
                endDate: {
                    $gte: new Date(targetDate.setHours(0, 0, 0, 0)),
                    $lt: new Date(targetDate.setHours(23, 59, 59, 999))
                }
            }).populate('userId');
            console.log(`Found ${expiringSubscriptions.length} subscriptions expiring in ${days} days`);
            // Send reminder emails
            for (const subscription of expiringSubscriptions) {
                const user = subscription.userId;
                if (!user) {
                    console.log(`User not found for subscription: ${subscription._id}`);
                    continue;
                }
                // Only send reminders to users with auto-renewal disabled or cancelled subscriptions
                if (subscription.status === 'cancelled' || !subscription.autoRenewal) {
                    await (0, emailService_1.sendSubscriptionReminderEmail)(user, days);
                    console.log(`Sent ${days}-day reminder to user: ${user._id}`);
                }
            }
        }
    }
    catch (error) {
        console.error('Error processing subscription reminders:', error);
    }
};
exports.processSubscriptionReminders = processSubscriptionReminders;
/**
 * Process auto-renewals for subscriptions
 * This should be called by the cron job
 */
const processAutoRenewals = async () => {
    try {
        console.log('Processing auto-renewals...');
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize to start of day
        // Get the target renewal date (3 days before expiry)
        const targetRenewalDate = (0, date_fns_1.addDays)(today, 3);
        // Find active subscriptions with auto-renewal enabled expiring in 3 days
        const subscriptionsToRenew = await subscription_model_1.default.find({
            status: 'active',
            autoRenewal: true,
            endDate: {
                $gte: new Date(targetRenewalDate.setHours(0, 0, 0, 0)),
                $lt: new Date(targetRenewalDate.setHours(23, 59, 59, 999))
            }
        }).populate('userId');
        console.log(`Found ${subscriptionsToRenew.length} subscriptions to auto-renew`);
        // Process each renewal - note: actual payment processing would go here
        for (const subscription of subscriptionsToRenew) {
            // In a real implementation, this would trigger the payment provider
            // For now, we'll just simulate a successful renewal
            // Calculate new end date (30 days from current end date)
            const newEndDate = (0, date_fns_1.addDays)(subscription.endDate, 30);
            // Update subscription record
            subscription.endDate = newEndDate;
            subscription.renewalDate = newEndDate;
            await subscription.save();
            // Log the renewal
            console.log(`Auto-renewed subscription for user: ${subscription.userId._id}`);
        }
    }
    catch (error) {
        console.error('Error processing auto-renewals:', error);
    }
};
exports.processAutoRenewals = processAutoRenewals;
/**
 * Get a user's subscription status
 */
const getUserSubscriptionStatus = async (userId) => {
    try {
        // Get the user
        const user = await userModel_1.default.findById(userId);
        if (!user) {
            throw new Error(`User not found: ${userId}`);
        }
        // Get user's subscription
        const subscription = await subscription_model_1.default.findOne({ userId });
        if (!subscription) {
            return {
                status: 'none',
                plan: user.plan,
                daysRemaining: 0,
                isAutoRenewEnabled: false
            };
        }
        // Calculate days remaining in subscription
        const daysRemaining = (0, date_fns_1.differenceInDays)(subscription.endDate, new Date());
        return {
            status: subscription.status,
            plan: user.plan,
            daysRemaining: Math.max(0, daysRemaining),
            isAutoRenewEnabled: !!subscription.autoRenewal,
            endDate: subscription.endDate,
            renewalDate: subscription.renewalDate
        };
    }
    catch (error) {
        console.error('Error getting subscription status:', error);
        throw error;
    }
};
exports.getUserSubscriptionStatus = getUserSubscriptionStatus;
/**
 * Toggle auto-renewal for a user's subscription
 */
const toggleAutoRenewal = async (userId, enabled) => {
    try {
        // Find the subscription
        const subscription = await subscription_model_1.default.findOne({ userId, status: 'active' });
        if (!subscription) {
            throw new Error('No active subscription found');
        }
        // Update auto-renewal setting
        subscription.autoRenewal = enabled;
        await subscription.save();
        return {
            success: true,
            isAutoRenewEnabled: subscription.autoRenewal
        };
    }
    catch (error) {
        console.error('Error toggling auto-renewal:', error);
        throw error;
    }
};
exports.toggleAutoRenewal = toggleAutoRenewal;
