import { Request, Response, NextFunction } from 'express';
import { CatchAsyncError } from '../middleware/catchAsyncErrors';
import ErrorHandler from '../utils/ErrorHandler';
import PromoCode from '../models/promoCode.model';
import User from '../models/userModel';
import { redis } from '../utils/redis';
import { updateUserSubscription } from '../utils/paymentService';
import mongoose from 'mongoose';

/**
 * Generate new promo codes (admin only)
 */
export const generatePromoCodes = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return next(new ErrorHandler('Not authorized', 403));
    }
    
    const { 
      count = 1, 
      prefix = 'LAUNCH', 
      duration = 30, 
      maxUses = 1,
      description = 'Free month of Pro access',
      expiryDays = 90 // Codes expire in 90 days by default
    } = req.body;
    
    // Validate input
    if (count < 1 || count > 100) {
      return next(new ErrorHandler('Count must be between 1 and 100', 400));
    }
    
    if (duration < 1 || duration > 365) {
      return next(new ErrorHandler('Duration must be between 1 and 365 days', 400));
    }
    
    // Generate expiry date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);
    
    // Generate codes
    const codes = [];
    const createdBy = req.user._id;
    
    for (let i = 0; i < count; i++) {
      // Generate a random 6-character alphanumeric string
      const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
      const code = `${prefix}-${randomPart}`;
      
      const promoCode = new PromoCode({
        code,
        description,
        duration,
        maxUses,
        createdBy,
        expiresAt
      });
      
      await promoCode.save();
      codes.push(promoCode);
    }
    
    res.status(201).json({
      success: true,
      count: codes.length,
      codes
    });
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});

/**
 * Get all promo codes (admin only)
 */
export const getAllPromoCodes = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return next(new ErrorHandler('Not authorized', 403));
    }
    
    const { active } = req.query;
    const query: any = {};
    
    // Filter by active status if specified
    if (active === 'true') {
      query.isActive = true;
    } else if (active === 'false') {
      query.isActive = false;
    }
    
    const promoCodes = await PromoCode.find(query)
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name username')
      .populate('usedBy.userId', 'name username email');
    
    res.status(200).json({
      success: true,
      count: promoCodes.length,
      promoCodes
    });
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});

/**
 * Redeem a promo code
 */
export const redeemPromoCode = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next(new ErrorHandler('Authentication required', 401));
    }
    
    const { code } = req.body;
    
    if (!code) {
      return next(new ErrorHandler('Promo code is required', 400));
    }
    
    // Find the promo code
    const promoCode = await PromoCode.findOne({ 
      code: code.toUpperCase().trim(),
      isActive: true,
      expiresAt: { $gt: new Date() }
    });
    
    if (!promoCode) {
      return next(new ErrorHandler('Invalid or expired promo code', 404));
    }
    
    // Check if code has reached max uses
    if (promoCode.usedCount >= promoCode.maxUses) {
      return next(new ErrorHandler('This promo code has already been fully redeemed', 400));
    }
    
    // Check if user has already used this code
    // Fix: Explicitly tell TypeScript that req.user is defined at this point
    const alreadyUsed = promoCode.usedBy.some(
      use => use.userId.toString() === req.user!._id.toString()
    );
    
    if (alreadyUsed) {
      return next(new ErrorHandler('You have already used this promo code', 400));
    }
    
    // Check if user is already on pro plan
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return next(new ErrorHandler('User not found', 404));
    }
    
    if (user.plan === 'pro') {
      return next(new ErrorHandler('You are already on the Pro plan', 400));
    }
    
    // Update user plan
    // Calculate expiry date based on promo duration
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + promoCode.duration);
    
    // Update user to pro plan with expiry date
    await User.findByIdAndUpdate(
      req.user._id,
      {
        plan: 'pro',
        planExpiryDate: expiryDate,
        projectIdeasLeft: 10,
        collaborationRequestsLeft: 999999, // Effectively unlimited
        enhancementsLeft: 8 // Reset enhancements for Pro users
      }
    );
    
    // Update subscription
    await updateUserSubscription(
      req.user._id.toString(),
      promoCode.code, // Use promo code as reference
      'promo' // New provider type: 'promo'
    );
    
    // Update promo code usage
    promoCode.usedCount += 1;
    
    promoCode.usedBy.push({
      userId: req.user._id as unknown as mongoose.Schema.Types.ObjectId,
      usedAt: new Date()
    });
    
    // If max uses reached, mark as inactive
    if (promoCode.usedCount >= promoCode.maxUses) {
      promoCode.isActive = false;
    }
    
    await promoCode.save();
    
    // Update Redis cache with fresh user data
    const updatedUser = await User.findById(req.user._id);
    await redis.set(req.user.githubId, JSON.stringify(updatedUser), 'EX', 3600);
    
    res.status(200).json({
      success: true,
      message: `Promo code redeemed successfully. Your Pro access will be active until ${expiryDate.toISOString().split('T')[0]}.`,
      expiryDate
    });
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});

/**
 * Deactivate a promo code (admin only)
 */
export const deactivatePromoCode = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return next(new ErrorHandler('Not authorized', 403));
    }
    
    const { codeId } = req.params;
    
    const promoCode = await PromoCode.findById(codeId);
    
    if (!promoCode) {
      return next(new ErrorHandler('Promo code not found', 404));
    }
    
    promoCode.isActive = false;
    await promoCode.save();
    
    res.status(200).json({
      success: true,
      message: 'Promo code deactivated successfully'
    });
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});