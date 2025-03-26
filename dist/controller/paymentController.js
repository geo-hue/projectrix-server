"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.flutterwaveWebhook = exports.getPaymentHistory = exports.cancelSubscription = exports.getSubscriptionStatus = exports.manualUpgrade = exports.stripeWebhook = exports.verifyPayment = exports.createPaymentSession = exports.getPricing = void 0;
const catchAsyncErrors_1 = require("../middleware/catchAsyncErrors");
const ErrorHandler_1 = __importDefault(require("../utils/ErrorHandler"));
const userModel_1 = __importDefault(require("../models/userModel"));
const subscription_model_1 = __importDefault(require("../models/subscription.model"));
const paymentService_1 = require("../utils/paymentService");
const redis_1 = require("../utils/redis");
// Get pricing information based on user location
exports.getPricing = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        // Get country code from request
        const { countryCode } = req.query;
        if (!countryCode) {
            return next(new ErrorHandler_1.default("Country code is required", 400));
        }
        console.log(`Getting pricing for country: ${countryCode}`);
        // Get pricing for location
        const pricing = (0, paymentService_1.getPricingForLocation)(countryCode);
        console.log(`Pricing returned: ${JSON.stringify(pricing)}`);
        res.status(200).json({
            success: true,
            pricing
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
// Create a payment session (using Flutterwave for all payments)
exports.createPaymentSession = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        if (!req.user) {
            return next(new ErrorHandler_1.default("Authentication required", 401));
        }
        const { phoneNumber, currency: requestedCurrency } = req.body;
        const userId = req.user._id;
        const email = req.user.email;
        const name = req.user.name;
        // Log the request parameters
        console.log('Payment session request:', {
            userId: userId.toString(),
            email,
            name,
            phoneNumber,
            requestedCurrency
        });
        // Detect the appropriate currency based on provided currency or user IP
        // For simplicity, we'll prioritize the requested currency if provided
        let currency = 'USD';
        if (requestedCurrency && (requestedCurrency === 'NGN' || requestedCurrency === 'USD')) {
            currency = requestedCurrency;
            console.log(`Using explicitly requested currency: ${currency}`);
        }
        else {
            // Check if the request has a country header (this would be set by your frontend)
            const userCountry = req.headers['x-user-country'];
            if (userCountry === 'NG') {
                currency = 'NGN';
            }
            console.log(`Determined currency from country header: ${currency}`);
        }
        console.log(`Creating payment for ${name} (${email}) in ${currency}`);
        // For Flutterwave, validate phone number - required for all payments now
        if (!phoneNumber) {
            return next(new ErrorHandler_1.default("Phone number is required for payment processing", 400));
        }
        // Create Flutterwave payment with the determined currency
        const payment = await (0, paymentService_1.createFlutterwavePayment)(userId.toString(), email, name, phoneNumber, currency);
        // Log the created payment
        console.log('Created payment:', {
            transactionRef: payment.transactionRef,
            currency,
            paymentLink: payment.paymentLink
        });
        res.status(200).json({
            success: true,
            payment
        });
    }
    catch (error) {
        console.error('Payment creation error:', error);
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
// Verify Flutterwave payment
exports.verifyPayment = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        if (!req.user) {
            return next(new ErrorHandler_1.default("Authentication required", 401));
        }
        const { transactionId } = req.body;
        if (!transactionId) {
            return next(new ErrorHandler_1.default("Transaction ID is required", 400));
        }
        // Add transaction ID tracking to prevent multiple verifications
        const verificationKey = `flw_verify:${transactionId}`;
        const alreadyVerified = await redis_1.redis.get(verificationKey);
        if (alreadyVerified) {
            console.log(`Transaction ${transactionId} was already verified, skipping duplicate verification`);
            return res.status(200).json({
                success: true,
                message: "Payment already verified"
            });
        }
        // Set verification in progress flag with 5-minute expiry
        await redis_1.redis.set(verificationKey, 'verifying', 'EX', 300);
        try {
            const result = await (0, paymentService_1.verifyFlutterwavePayment)(transactionId);
            // Mark as verified with 24-hour expiry
            if (result.success) {
                await redis_1.redis.set(verificationKey, 'verified', 'EX', 86400);
            }
            return res.status(200).json({
                success: result.success,
                message: result.message
            });
        }
        catch (error) {
            // Remove verification flag on error to allow retry
            await redis_1.redis.del(verificationKey);
            throw error;
        }
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
// Handle Stripe webhook - keeping this function for future use but it won't be called
const stripeWebhook = async (req, res) => {
    // This function is preserved for future use but is currently inactive
    // When Stripe is re-enabled, this will be reactivated
    console.log('Stripe webhook received but inactive - using Flutterwave for all payments');
    // Always return 200 to prevent retries
    return res.status(200).json({
        success: true,
        message: 'Webhook received but not processed - using Flutterwave for all payments'
    });
};
exports.stripeWebhook = stripeWebhook;
// Handle manual upgrade (for testing or admin purposes)
exports.manualUpgrade = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        if (!req.user || req.user.role !== 'admin') {
            return next(new ErrorHandler_1.default("Not authorized", 403));
        }
        const { userId } = req.body;
        if (!userId) {
            return next(new ErrorHandler_1.default("User ID is required", 400));
        }
        // Verify user exists
        const user = await userModel_1.default.findById(userId);
        if (!user) {
            return next(new ErrorHandler_1.default("User not found", 404));
        }
        // Update user subscription
        await (0, paymentService_1.updateUserSubscription)(userId);
        res.status(200).json({
            success: true,
            message: "User upgraded to Pro plan successfully"
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
// Get subscription status
exports.getSubscriptionStatus = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        if (!req.user) {
            return next(new ErrorHandler_1.default("Authentication required", 401));
        }
        const userId = req.user._id;
        // First check the user's plan in the User model
        const user = await userModel_1.default.findById(userId).select('plan planExpiryDate');
        if (!user) {
            return next(new ErrorHandler_1.default("User not found", 404));
        }
        // Get subscription information from the Subscription model
        const subscription = await subscription_model_1.default.findOne({ userId });
        // If user is Pro but no subscription record exists, create one
        if (user.plan === 'pro' && !subscription) {
            const endDate = user.planExpiryDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            // Create a new subscription record
            const newSubscription = await subscription_model_1.default.create({
                userId,
                status: 'active',
                plan: 'pro',
                startDate: new Date(),
                endDate,
                renewalDate: endDate,
                provider: {
                    name: 'flutterwave' // Default provider is now flutterwave
                }
            });
            return res.status(200).json({
                success: true,
                status: 'active',
                plan: 'pro',
                endDate,
                renewalDate: endDate
            });
        }
        // If no subscription and user is not pro
        if (!subscription && user.plan !== 'pro') {
            return res.status(200).json({
                success: true,
                status: 'none',
                plan: 'free'
            });
        }
        // Validate subscription status against user plan
        if (subscription && user.plan !== subscription.plan) {
            // Update subscription to match user plan
            subscription.plan = user.plan;
            await subscription.save();
        }
        res.status(200).json({
            success: true,
            status: subscription?.status,
            plan: user.plan, // Use user.plan as the source of truth
            endDate: subscription?.endDate,
            renewalDate: subscription?.renewalDate
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
// Cancel subscription
exports.cancelSubscription = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        if (!req.user) {
            return next(new ErrorHandler_1.default("Authentication required", 401));
        }
        const userId = req.user._id;
        // Find subscription
        const subscription = await subscription_model_1.default.findOne({ userId, status: 'active' });
        if (!subscription) {
            return next(new ErrorHandler_1.default("No active subscription found", 404));
        }
        // For Flutterwave, cancel immediately
        subscription.status = 'cancelled';
        await subscription.save();
        // Update user plan to free at the end of the billing period
        // We'll keep them as pro until their subscription end date
        const user = await userModel_1.default.findById(userId);
        if (user) {
            // Only schedule downgrade if they're still on pro
            if (user.plan === 'pro') {
                // Store the end date for downgrading
                user.planExpiryDate = subscription.endDate;
                // Store their current usage counts for after downgrade
                // These will be used to determine if they've already exceeded free limits
                user.proCancelProjectsCreated = user.projectsGenerated || 0;
                user.proCancelPublishedCount = user.publishedProjectsCount || 0;
                await user.save();
            }
        }
        res.status(200).json({
            success: true,
            message: "Subscription cancelled successfully. Your Pro access will continue until the end of your billing period."
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
// Get payment history
exports.getPaymentHistory = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        if (!req.user) {
            return next(new ErrorHandler_1.default("Authentication required", 401));
        }
        const userId = req.user._id;
        // Find subscription
        const subscription = await subscription_model_1.default.findOne({ userId });
        if (!subscription) {
            // If no subscription found, return empty payment history
            return res.status(200).json({
                success: true,
                payments: []
            });
        }
        // Return payment history from subscription
        res.status(200).json({
            success: true,
            payments: subscription.paymentHistory || []
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
// Handle Flutterwave webhook
const flutterwaveWebhook = async (req, res) => {
    try {
        console.log('Received Flutterwave webhook', {
            eventType: req.body['event.type'] || req.body.event,
            txRef: req.body.txRef,
            status: req.body.status,
            currency: req.body.currency
        });
        // This is important: Always respond with 200 OK immediately
        // to prevent Flutterwave from retrying the webhook
        // Process the webhook asynchronously after responding
        const response = {
            status: 'success',
            message: 'Webhook received successfully'
        };
        // First send the response, then process
        res.status(200).json(response);
        // Now process the webhook asynchronously
        (async () => {
            try {
                // Extract transaction data
                const { txRef, status, amount, currency } = req.body;
                if (status !== 'successful') {
                    console.log(`Ignoring non-successful transaction: ${txRef} with status: ${status}`);
                    return;
                }
                // Process only once using Redis
                const webhookKey = `flw_webhook:${txRef}`;
                const processed = await redis_1.redis.get(webhookKey);
                if (processed) {
                    console.log(`Webhook for transaction ${txRef} was already processed, skipping`);
                    return;
                }
                // Mark as being processed with 5-minute expiry
                await redis_1.redis.set(webhookKey, 'processing', 'EX', 300);
                try {
                    // Extract userId from txRef (format: projectrix-timestamp-userId)
                    const parts = txRef.split('-');
                    if (parts.length < 3) {
                        console.error(`Invalid transaction reference format: ${txRef}`);
                        return;
                    }
                    const userId = parts[2];
                    console.log(`Processing webhook for user: ${userId} with txRef: ${txRef} and currency: ${currency}`);
                    // Record payment history
                    await (0, paymentService_1.addPaymentToHistory)(userId, amount, currency, txRef, 'flutterwave', 'successful');
                    // Update user subscription
                    await (0, paymentService_1.updateUserSubscription)(userId, txRef, 'flutterwave');
                    // Mark as processed with 7-day expiry
                    await redis_1.redis.set(webhookKey, 'processed', 'EX', 7 * 24 * 60 * 60);
                    console.log(`Successfully processed webhook for transaction ${txRef}`);
                }
                catch (error) {
                    console.error(`Error processing webhook for transaction ${txRef}:`, error);
                    // Remove processing flag on error to allow retry
                    await redis_1.redis.del(webhookKey);
                }
            }
            catch (error) {
                console.error('Error processing webhook asynchronously:', error);
            }
        })();
    }
    catch (error) {
        console.error('Error in flutterwaveWebhook:', error);
        // Always return 200 even on error to prevent retries
        res.status(200).json({
            status: 'success',
            message: 'Webhook received'
        });
    }
};
exports.flutterwaveWebhook = flutterwaveWebhook;
