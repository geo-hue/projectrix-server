import dotenv from 'dotenv';
import { Request } from 'express';
import User from '../models/userModel';
import ErrorHandler from '../utils/ErrorHandler';

dotenv.config();

// Check if pricing features are enabled (for transitioning from beta to production)
export const isPricingEnabled = (): boolean => {
  return process.env.PRICING_ENABLED === 'true';
};

// Check if user has reached the free plan publish limit
export const checkPublishLimit = async (userId: string): Promise<boolean> => {
  // Don't enforce limit if pricing isn't enabled
  if (!isPricingEnabled()) {
    return true;
  }
  
  const user = await User.findById(userId);
  if (!user) {
    throw new ErrorHandler('User not found', 404);
  }
  
  // Pro users have unlimited publishes
  if (user.plan === 'pro') {
    return true;
  }
  
  // Free users can only publish 1 project
  return user.publishedProjectsCount < 1;
};

// Check if user has reached the free plan collaboration request limit
export const checkCollaborationRequestLimit = async (userId: string): Promise<boolean> => {
  // Don't enforce limit if pricing isn't enabled
  if (!isPricingEnabled()) {
    return true;
  }
  
  const user = await User.findById(userId);
  if (!user) {
    throw new ErrorHandler('User not found', 404);
  }
  
  // Pro users have unlimited collaboration requests
  if (user.plan === 'pro') {
    return true;
  }
  
  // Free users are limited to 3 collaboration requests
  return user.collaborationRequestsLeft > 0;
};

// Check if user has reached the free plan active collaboration limit
export const checkActiveCollaborationLimit = async (userId: string): Promise<boolean> => {
  // Don't enforce limit if pricing isn't enabled
  if (!isPricingEnabled()) {
    return true;
  }
  
  const user = await User.findById(userId);
  if (!user) {
    throw new ErrorHandler('User not found', 404);
  }
  
  // Pro users have unlimited active collaborations
  if (user.plan === 'pro') {
    return true;
  }
  
  // Free users are limited to 1 active collaboration
  return user.projectsCollaborated < 1;
};

// Check if user can edit projects (only pro users)
export const canEditProject = async (userId: string): Promise<boolean> => {
  // Don't enforce limit if pricing isn't enabled
  if (!isPricingEnabled()) {
    return true;
  }
  
  const user = await User.findById(userId);
  if (!user) {
    throw new ErrorHandler('User not found', 404);
  }
  
  // Only pro users can edit projects
  return user.plan === 'pro';
};

/**
 * Decrement user's enhancements left
 */
export const decrementEnhancements = async (userId: string): Promise<void> => {
  // Don't enforce if pricing isn't enabled
  if (!isPricingEnabled()) {
    return;
  }
  
  const user = await User.findById(userId);
  if (!user) {
    throw new ErrorHandler('User not found', 404);
  }
  
  // Decrement enhancements left
  if (user.enhancementsLeft > 0) {
    user.enhancementsLeft -= 1;
    await user.save();
  }
};

// Decrement user's collaboration request limit
export const decrementCollaborationRequests = async (userId: string): Promise<void> => {
  // Don't enforce if pricing isn't enabled
  if (!isPricingEnabled()) {
    return;
  }
  
  const user = await User.findById(userId);
  if (!user) {
    throw new ErrorHandler('User not found', 404);
  }
  
  // Don't decrement for pro users
  if (user.plan === 'pro') {
    return;
  }
  
  // Decrement collaboration requests left
  if (user.collaborationRequestsLeft > 0) {
    user.collaborationRequestsLeft -= 1;
    await user.save();
  }
};

/**
 * Check if user has enhancements left
 */
export const checkEnhancementsLimit = async (userId: string): Promise<boolean> => {
  // Don't enforce limit if pricing isn't enabled
  if (!isPricingEnabled()) {
    return true;
  }
  
  const user = await User.findById(userId);
  if (!user) {
    throw new ErrorHandler('User not found', 404);
  }
  
  // Return true if user has enhancements left
  return user.enhancementsLeft > 0;
};


// Increment user's published project count
export const incrementPublishedProjects = async (userId: string): Promise<void> => {
  // Don't enforce if pricing isn't enabled
  if (!isPricingEnabled()) {
    return;
  }
  
  const user = await User.findById(userId);
  if (!user) {
    throw new ErrorHandler('User not found', 404);
  }
  
  // Increment published projects count
  user.publishedProjectsCount = (user.publishedProjectsCount || 0) + 1;
  await user.save();
};

// Helper function to set up initial values for both plans
export const initializeUserPlanLimits = (user: any): void => {
  // Set initial values based on plan
  if (user.plan === 'pro') {
  // Pro users get monthly limits that will reset
  user.projectIdeasLeft = 10;
  user.collaborationRequestsLeft = 999999; // Effectively unlimited
  user.enhancementsLeft = 8;   // Pro users get 8 enhancements
  } else {
    // Free users get 3 project ideas and 3 collaboration requests and 2 enhancements per month
   // Free users get one-time limits that never reset
    // Only set these if the user is brand new (doesn't already have values)
    if (user.projectIdeasLeft === undefined) user.projectIdeasLeft = 3;
    if (user.collaborationRequestsLeft === undefined) user.collaborationRequestsLeft = 3;
    if (user.enhancementsLeft === undefined) user.enhancementsLeft = 2;
  }
};

// Helper function to reset monthly limits
export const resetMonthlyLimits = async (userId: string): Promise<void> => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ErrorHandler('User not found', 404);
  }
  
  // Only reset limits for Pro users
  if (user.plan === 'pro') {
    user.projectIdeasLeft = 10;
    user.collaborationRequestsLeft = 999999; // Effectively unlimited
    user.enhancementsLeft = 8;
    
    // Update last reset date
    user.lastLimitResetDate = new Date();
    
    await user.save();
  }
  // Free users don't get resets - their limits remain as is
};