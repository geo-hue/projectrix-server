// controller/paymentController.ts - Updated to use Flutterwave for all payments
import { Request, Response, NextFunction } from 'express';
import { CatchAsyncError } from '../middleware/catchAsyncErrors';
import ErrorHandler from '../utils/ErrorHandler';
import User from '../models/userModel';
import Subscription from '../models/subscription.model';
import { 
  createFlutterwavePayment, 
  verifyFlutterwavePayment, 
  getPricingForLocation,
  updateUserSubscription,
  addPaymentToHistory
} from '../utils/paymentService';
import Stripe from 'stripe';
import { redis } from '../utils/redis';

// Get pricing information based on user location
export const getPricing = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get country code from request
    const { countryCode } = req.query;
    
    if (!countryCode) {
      return next(new ErrorHandler("Country code is required", 400));
    }
    
    console.log(`Getting pricing for country: ${countryCode}`);
    
    // Get pricing for location
    const pricing = getPricingForLocation(countryCode as string);
    
    console.log(`Pricing returned: ${JSON.stringify(pricing)}`);
    
    res.status(200).json({
      success: true,
      pricing
    });
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// Create a payment session (using Flutterwave for all payments)
export const createPaymentSession = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next(new ErrorHandler("Authentication required", 401));
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
    let currency: 'NGN' | 'USD' = 'USD';
    
    if (requestedCurrency && (requestedCurrency === 'NGN' || requestedCurrency === 'USD')) {
      currency = requestedCurrency;
      console.log(`Using explicitly requested currency: ${currency}`);
    } else {
      // Check if the request has a country header (this would be set by your frontend)
      const userCountry = req.headers['x-user-country'] as string;
      if (userCountry === 'NG') {
        currency = 'NGN';
      }
      console.log(`Determined currency from country header: ${currency}`);
    }
    
    console.log(`Creating payment for ${name} (${email}) in ${currency}`);
    
    // For Flutterwave, validate phone number - required for all payments now
    if (!phoneNumber) {
      return next(new ErrorHandler("Phone number is required for payment processing", 400));
    }
    
    // Create Flutterwave payment with the determined currency
    const payment = await createFlutterwavePayment(
      userId.toString(), 
      email, 
      name, 
      phoneNumber,
      currency
    );
    
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
  } catch (error: any) {
    console.error('Payment creation error:', error);
    return next(new ErrorHandler(error.message, 500));
  }
});

// Verify Flutterwave payment
export const verifyPayment = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next(new ErrorHandler("Authentication required", 401));
    }
    
    const { transactionId } = req.body;
    
    if (!transactionId) {
      return next(new ErrorHandler("Transaction ID is required", 400));
    }
    
    // Add transaction ID tracking to prevent multiple verifications
    const verificationKey = `flw_verify:${transactionId}`;
    const alreadyVerified = await redis.get(verificationKey);
    
    if (alreadyVerified) {
      console.log(`Transaction ${transactionId} was already verified, skipping duplicate verification`);
      return res.status(200).json({
        success: true,
        message: "Payment already verified"
      });
    }
    
    // Set verification in progress flag with 5-minute expiry
    await redis.set(verificationKey, 'verifying', 'EX', 300);
    
    try {
      const result = await verifyFlutterwavePayment(transactionId);
      
      // Mark as verified with 24-hour expiry
      if (result.success) {
        await redis.set(verificationKey, 'verified', 'EX', 86400);
      }
      
      return res.status(200).json({
        success: result.success,
        message: result.message
      });
    } catch (error) {
      // Remove verification flag on error to allow retry
      await redis.del(verificationKey);
      throw error;
    }
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// Handle Stripe webhook - keeping this function for future use but it won't be called
export const stripeWebhook = async (req: Request, res: Response) => {
  // This function is preserved for future use but is currently inactive
  // When Stripe is re-enabled, this will be reactivated
  console.log('Stripe webhook received but inactive - using Flutterwave for all payments');
  
  // Always return 200 to prevent retries
  return res.status(200).json({ 
    success: true,
    message: 'Webhook received but not processed - using Flutterwave for all payments'
  });
};

// Handle manual upgrade (for testing or admin purposes)
export const manualUpgrade = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return next(new ErrorHandler("Not authorized", 403));
    }
    
    const { userId } = req.body;
    
    if (!userId) {
      return next(new ErrorHandler("User ID is required", 400));
    }
    
    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return next(new ErrorHandler("User not found", 404));
    }
    
    // Update user subscription
    await updateUserSubscription(userId);
    
    res.status(200).json({
      success: true,
      message: "User upgraded to Pro plan successfully"
    });
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// Get subscription status
export const getSubscriptionStatus = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next(new ErrorHandler("Authentication required", 401));
    }
    
    const userId = req.user._id;
    
    // First check the user's plan in the User model
    const user = await User.findById(userId).select('plan planExpiryDate');
    
    if (!user) {
      return next(new ErrorHandler("User not found", 404));
    }
    
    // Get subscription information from the Subscription model
    const subscription = await Subscription.findOne({ userId });
    
    // If user is Pro but no subscription record exists, create one
    if (user.plan === 'pro' && !subscription) {
      const endDate = user.planExpiryDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      
      // Create a new subscription record
      const newSubscription = await Subscription.create({
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
      subscription.plan = user.plan as "free" | "pro";
      await subscription.save();
    }
    
    res.status(200).json({
      success: true,
      status: subscription?.status,
      plan: user.plan, // Use user.plan as the source of truth
      endDate: subscription?.endDate,
      renewalDate: subscription?.renewalDate
    });
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// Cancel subscription
export const cancelSubscription = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next(new ErrorHandler("Authentication required", 401));
    }
    
    const userId = req.user._id;
    
    // Find subscription
    const subscription = await Subscription.findOne({ userId, status: 'active' });
    
    if (!subscription) {
      return next(new ErrorHandler("No active subscription found", 404));
    }
    
    // For Flutterwave, cancel immediately
    subscription.status = 'cancelled';
    await subscription.save();
    
    // Update user plan to free at the end of the billing period
    // We'll keep them as pro until their subscription end date
    const user = await User.findById(userId);
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
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// Get payment history
export const getPaymentHistory = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next(new ErrorHandler("Authentication required", 401));
    }
    
    const userId = req.user._id;
    
    // Find subscription
    const subscription = await Subscription.findOne({ userId });
    
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
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// Handle Flutterwave webhook
export const flutterwaveWebhook = async (req: Request, res: Response) => {
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
        const processed = await redis.get(webhookKey);
        
        if (processed) {
          console.log(`Webhook for transaction ${txRef} was already processed, skipping`);
          return;
        }
        
        // Mark as being processed with 5-minute expiry
        await redis.set(webhookKey, 'processing', 'EX', 300);
        
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
          await addPaymentToHistory(
            userId,
            amount,
            currency,
            txRef,
            'flutterwave',
            'successful'
          );
          
          // Update user subscription
          await updateUserSubscription(userId, txRef, 'flutterwave');
          
          // Mark as processed with 7-day expiry
          await redis.set(webhookKey, 'processed', 'EX', 7 * 24 * 60 * 60);
          console.log(`Successfully processed webhook for transaction ${txRef}`);
        } catch (error) {
          console.error(`Error processing webhook for transaction ${txRef}:`, error);
          // Remove processing flag on error to allow retry
          await redis.del(webhookKey);
        }
      } catch (error) {
        console.error('Error processing webhook asynchronously:', error);
      }
    })();
  } catch (error) {
    console.error('Error in flutterwaveWebhook:', error);
    // Always return 200 even on error to prevent retries
    res.status(200).json({
      status: 'success',
      message: 'Webhook received'
    });
  }
};