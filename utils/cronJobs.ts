// utils/cronJobs.ts - Final implementation with all features
import cron from 'node-cron';
import User from '../models/userModel';
import Subscription from '../models/subscription.model';
import { redis } from './redis';
import { isPricingEnabled, initializeUserPlanLimits } from './pricingUtils';
import { differenceInDays, addDays, isSameDay } from 'date-fns';
import { sendSubscriptionExpiryEmail } from './emailService';
import { processSubscriptionReminders, processAutoRenewals } from './subscriptionService';

/**
 * Set up all cron jobs for scheduling recurring tasks
 */
export const setupCronJobs = () => {
  // Run daily at midnight (0 0 * * *)
  cron.schedule('0 0 * * *', async () => {
    console.log('Running daily maintenance jobs...');
    
    // Only run if pricing features are enabled
    if (!isPricingEnabled()) {
      console.log('Pricing features are disabled. Skipping maintenance jobs.');
      return;
    }
    
    try {
      // Process user-specific limit resets
      await processUserLimitResets();
      
      // Handle subscription expiry and downgrades
      await handleSubscriptionExpiry();
      
      // Process subscription reminders
      await processSubscriptionReminders();
      
      // Process auto-renewals (if enabled in the future)
      if (process.env.ENABLE_AUTO_RENEWALS === 'true') {
        await processAutoRenewals();
      }
    } catch (error) {
      console.error('Error running daily maintenance jobs:', error);
    }
  });
  
  console.log('Cron jobs initialized');
};

/**
 * Process user-specific limit resets based on their signup date
 * or last reset date
 */
export const processUserLimitResets = async () => {
  try {
    console.log('Processing user-specific limit resets...');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day
    
    // Find users who are due for a limit reset today
    // This includes:
    // Users with a nextLimitResetDate of today
    const usersToReset = await User.find({
      // Only reset Pro users' limits
      plan: 'pro',
      $or: [
        // Users with a specific reset date that matches today
        { nextLimitResetDate: { 
          $gte: today, 
          $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) 
        }},
        // Pro users who haven't had a reset yet but are 30+ days since their last reset or upgrade
        { 
          $or: [
            { nextLimitResetDate: { $exists: false } },
            { lastLimitResetDate: { 
              $lte: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000) 
            }}
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
    user.nextLimitResetDate = addDays(new Date(), 30);
    
    // Set last reset date to today
    user.lastLimitResetDate = new Date();
    
    // Save changes
    await user.save();
    
    // Update Redis cache
    await redis.set(user.githubId, JSON.stringify(user), 'EX', 3600);
    
    updatedCount++;
  }
}
    
    console.log(`Successfully reset limits for ${updatedCount} users`);
  } catch (error) {
    console.error('Error processing user limit resets:', error);
  }
};

/**
 * Handle subscription expiry and downgrade users from pro to free
 * when their subscription ends
 */
export const handleSubscriptionExpiry = async () => {
  try {
    console.log('Processing subscription expiry...');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day
    
    // Find subscriptions that expired yesterday or earlier
    const expiredSubscriptions = await Subscription.find({
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
      const user = subscription.userId as unknown as typeof User.prototype;
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
        await redis.set(user.githubId, JSON.stringify(user), 'EX', 3600);
        
        // Send expiry notification email
        try {
          await sendSubscriptionExpiryEmail(user);
        } catch (emailError) {
          console.error('Error sending subscription expiry email:', emailError);
        }
        
        processedCount++;
      }
    }
    
    console.log(`Processed ${processedCount} expired subscriptions`);
  } catch (error) {
    console.error('Error handling subscription expiry:', error);
  }
};

/**
 * Manually reset limits for a specific user
 * This can be used for testing or admin operations
 */
export const resetUserLimits = async (userId: string): Promise<boolean> => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      console.error(`User not found: ${userId}`);
      return false;
    }
    
    // Reset limits based on plan
    initializeUserPlanLimits(user);
    
    // Set next reset date to 30 days from now
    user.nextLimitResetDate = addDays(new Date(), 30);
    
    // Set last reset date to today
    user.lastLimitResetDate = new Date();
    
    await user.save();
    
    // Update Redis cache
    await redis.set(user.githubId, JSON.stringify(user), 'EX', 3600);
    
    return true;
  } catch (error) {
    console.error('Error resetting user limits:', error);
    return false;
  }
};