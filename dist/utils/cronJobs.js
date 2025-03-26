"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetUserLimits = exports.handleSubscriptionExpiry = exports.processUserLimitResets = exports.setupCronJobs = void 0;
// utils/cronJobs.ts - Final implementation with all features
const node_cron_1 = __importDefault(require("node-cron"));
const userModel_1 = __importDefault(require("../models/userModel"));
const subscription_model_1 = __importDefault(require("../models/subscription.model"));
const redis_1 = require("./redis");
const pricingUtils_1 = require("./pricingUtils");
const date_fns_1 = require("date-fns");
const emailService_1 = require("./emailService");
const subscriptionService_1 = require("./subscriptionService");
/**
 * Set up all cron jobs for scheduling recurring tasks
 */
const setupCronJobs = () => {
    // Run daily at midnight (0 0 * * *)
    node_cron_1.default.schedule('0 0 * * *', async () => {
        console.log('Running daily maintenance jobs...');
        // Only run if pricing features are enabled
        if (!(0, pricingUtils_1.isPricingEnabled)()) {
            console.log('Pricing features are disabled. Skipping maintenance jobs.');
            return;
        }
        try {
            // Process user-specific limit resets
            await (0, exports.processUserLimitResets)();
            // Handle subscription expiry and downgrades
            await (0, exports.handleSubscriptionExpiry)();
            // Process subscription reminders
            await (0, subscriptionService_1.processSubscriptionReminders)();
            // Process auto-renewals (if enabled in the future)
            if (process.env.ENABLE_AUTO_RENEWALS === 'true') {
                await (0, subscriptionService_1.processAutoRenewals)();
            }
        }
        catch (error) {
            console.error('Error running daily maintenance jobs:', error);
        }
    });
    console.log('Cron jobs initialized');
};
exports.setupCronJobs = setupCronJobs;
/**
 * Process user-specific limit resets based on their signup date
 * or last reset date
 */
const processUserLimitResets = async () => {
    try {
        console.log('Processing user-specific limit resets...');
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize to start of day
        // Find users who are due for a limit reset today
        // This includes:
        // Users with a nextLimitResetDate of today
        const usersToReset = await userModel_1.default.find({
            // Only reset Pro users' limits
            plan: 'pro',
            $or: [
                // Users with a specific reset date that matches today
                { nextLimitResetDate: {
                        $gte: today,
                        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
                    } },
                // Pro users who haven't had a reset yet but are 30+ days since their last reset or upgrade
                {
                    $or: [
                        { nextLimitResetDate: { $exists: false } },
                        { lastLimitResetDate: {
                                $lte: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
                            } }
                    ]
                }
            ]
        });
        console.log(`Found ${usersToReset.length} users due for limit reset`);
        // Reset limits for each user based on their plan
        let updatedCount = 0;
        for (const user of usersToReset) {
            // Only process if the user is on Pro plan
            if (user.plan === 'pro') {
                // Reset limits for Pro users
                user.projectIdeasLeft = 10;
                user.collaborationRequestsLeft = 999999; // Effectively unlimited
                user.enhancementsLeft = 8;
                // Set next reset date to 30 days from now
                user.nextLimitResetDate = (0, date_fns_1.addDays)(new Date(), 30);
                // Set last reset date to today
                user.lastLimitResetDate = new Date();
                // Save changes
                await user.save();
                // Update Redis cache
                await redis_1.redis.set(user.githubId, JSON.stringify(user), 'EX', 3600);
                updatedCount++;
            }
        }
        console.log(`Successfully reset limits for ${updatedCount} users`);
    }
    catch (error) {
        console.error('Error processing user limit resets:', error);
    }
};
exports.processUserLimitResets = processUserLimitResets;
/**
 * Handle subscription expiry and downgrade users from pro to free
 * when their subscription ends
 */
const handleSubscriptionExpiry = async () => {
    try {
        console.log('Processing subscription expiry...');
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize to start of day
        // Find subscriptions that expired yesterday or earlier
        const expiredSubscriptions = await subscription_model_1.default.find({
            status: { $in: ['active', 'cancelled'] },
            endDate: { $lt: today }
        }).populate('userId');
        console.log(`Found ${expiredSubscriptions.length} expired subscriptions`);
        let processedCount = 0;
        for (const subscription of expiredSubscriptions) {
            // Update subscription status
            subscription.status = 'expired';
            await subscription.save();
            // Get the user
            const user = subscription.userId;
            if (!user) {
                console.log(`User not found for subscription: ${subscription._id}`);
                continue;
            }
            // Only process if user is currently on pro plan
            if (user.plan === 'pro') {
                // Downgrade user to free plan
                user.plan = 'free';
                // Don't reset limits for downgraded users, let them keep what they have
                // but they won't get more without upgrading again
                // However, if they have never had free limits set, give them the initial free limits
                if (user.projectIdeasLeft === undefined || user.projectIdeasLeft > 10) {
                    user.projectIdeasLeft = 3;
                }
                if (user.collaborationRequestsLeft === undefined || user.collaborationRequestsLeft > 900) {
                    user.collaborationRequestsLeft = 3;
                }
                if (user.enhancementsLeft === undefined || user.enhancementsLeft > 8) {
                    user.enhancementsLeft = 2;
                }
                // Save user
                await user.save();
                // Update Redis cache
                await redis_1.redis.set(user.githubId, JSON.stringify(user), 'EX', 3600);
                // Send expiry notification email
                try {
                    await (0, emailService_1.sendSubscriptionExpiryEmail)(user);
                }
                catch (emailError) {
                    console.error('Error sending subscription expiry email:', emailError);
                }
                processedCount++;
            }
        }
        console.log(`Processed ${processedCount} expired subscriptions`);
    }
    catch (error) {
        console.error('Error handling subscription expiry:', error);
    }
};
exports.handleSubscriptionExpiry = handleSubscriptionExpiry;
/**
 * Manually reset limits for a specific user
 * This can be used for testing or admin operations
 */
const resetUserLimits = async (userId) => {
    try {
        const user = await userModel_1.default.findById(userId);
        if (!user) {
            console.error(`User not found: ${userId}`);
            return false;
        }
        // Reset limits based on plan
        (0, pricingUtils_1.initializeUserPlanLimits)(user);
        // Set next reset date to 30 days from now
        user.nextLimitResetDate = (0, date_fns_1.addDays)(new Date(), 30);
        // Set last reset date to today
        user.lastLimitResetDate = new Date();
        await user.save();
        // Update Redis cache
        await redis_1.redis.set(user.githubId, JSON.stringify(user), 'EX', 3600);
        return true;
    }
    catch (error) {
        console.error('Error resetting user limits:', error);
        return false;
    }
};
exports.resetUserLimits = resetUserLimits;
