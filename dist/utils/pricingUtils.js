"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetMonthlyLimits = exports.initializeUserPlanLimits = exports.incrementPublishedProjects = exports.checkEnhancementsLimit = exports.decrementCollaborationRequests = exports.decrementEnhancements = exports.canEditProject = exports.checkActiveCollaborationLimit = exports.checkCollaborationRequestLimit = exports.checkPublishLimit = exports.isPricingEnabled = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const userModel_1 = __importDefault(require("../models/userModel"));
const ErrorHandler_1 = __importDefault(require("../utils/ErrorHandler"));
dotenv_1.default.config();
// Check if pricing features are enabled (for transitioning from beta to production)
const isPricingEnabled = () => {
    return process.env.PRICING_ENABLED === 'true';
};
exports.isPricingEnabled = isPricingEnabled;
// Check if user has reached the free plan publish limit
const checkPublishLimit = async (userId) => {
    // Don't enforce limit if pricing isn't enabled
    if (!(0, exports.isPricingEnabled)()) {
        return true;
    }
    const user = await userModel_1.default.findById(userId);
    if (!user) {
        throw new ErrorHandler_1.default('User not found', 404);
    }
    // Pro users have unlimited publishes
    if (user.plan === 'pro') {
        return true;
    }
    // Free users can only publish 1 project
    return user.publishedProjectsCount < 1;
};
exports.checkPublishLimit = checkPublishLimit;
// Check if user has reached the free plan collaboration request limit
const checkCollaborationRequestLimit = async (userId) => {
    // Don't enforce limit if pricing isn't enabled
    if (!(0, exports.isPricingEnabled)()) {
        return true;
    }
    const user = await userModel_1.default.findById(userId);
    if (!user) {
        throw new ErrorHandler_1.default('User not found', 404);
    }
    // Pro users have unlimited collaboration requests
    if (user.plan === 'pro') {
        return true;
    }
    // Free users are limited to 3 collaboration requests
    return user.collaborationRequestsLeft > 0;
};
exports.checkCollaborationRequestLimit = checkCollaborationRequestLimit;
// Check if user has reached the free plan active collaboration limit
const checkActiveCollaborationLimit = async (userId) => {
    // Don't enforce limit if pricing isn't enabled
    if (!(0, exports.isPricingEnabled)()) {
        return true;
    }
    const user = await userModel_1.default.findById(userId);
    if (!user) {
        throw new ErrorHandler_1.default('User not found', 404);
    }
    // Pro users have unlimited active collaborations
    if (user.plan === 'pro') {
        return true;
    }
    // Free users are limited to 1 active collaboration
    return user.projectsCollaborated < 1;
};
exports.checkActiveCollaborationLimit = checkActiveCollaborationLimit;
// Check if user can edit projects (only pro users)
const canEditProject = async (userId) => {
    // Don't enforce limit if pricing isn't enabled
    if (!(0, exports.isPricingEnabled)()) {
        return true;
    }
    const user = await userModel_1.default.findById(userId);
    if (!user) {
        throw new ErrorHandler_1.default('User not found', 404);
    }
    // Only pro users can edit projects
    return user.plan === 'pro';
};
exports.canEditProject = canEditProject;
/**
 * Decrement user's enhancements left
 */
const decrementEnhancements = async (userId) => {
    // Don't enforce if pricing isn't enabled
    if (!(0, exports.isPricingEnabled)()) {
        return;
    }
    const user = await userModel_1.default.findById(userId);
    if (!user) {
        throw new ErrorHandler_1.default('User not found', 404);
    }
    // Decrement enhancements left
    if (user.enhancementsLeft > 0) {
        user.enhancementsLeft -= 1;
        await user.save();
    }
};
exports.decrementEnhancements = decrementEnhancements;
// Decrement user's collaboration request limit
const decrementCollaborationRequests = async (userId) => {
    // Don't enforce if pricing isn't enabled
    if (!(0, exports.isPricingEnabled)()) {
        return;
    }
    const user = await userModel_1.default.findById(userId);
    if (!user) {
        throw new ErrorHandler_1.default('User not found', 404);
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
exports.decrementCollaborationRequests = decrementCollaborationRequests;
/**
 * Check if user has enhancements left
 */
const checkEnhancementsLimit = async (userId) => {
    // Don't enforce limit if pricing isn't enabled
    if (!(0, exports.isPricingEnabled)()) {
        return true;
    }
    const user = await userModel_1.default.findById(userId);
    if (!user) {
        throw new ErrorHandler_1.default('User not found', 404);
    }
    // Return true if user has enhancements left
    return user.enhancementsLeft > 0;
};
exports.checkEnhancementsLimit = checkEnhancementsLimit;
// Increment user's published project count
const incrementPublishedProjects = async (userId) => {
    // Don't enforce if pricing isn't enabled
    if (!(0, exports.isPricingEnabled)()) {
        return;
    }
    const user = await userModel_1.default.findById(userId);
    if (!user) {
        throw new ErrorHandler_1.default('User not found', 404);
    }
    // Increment published projects count
    user.publishedProjectsCount = (user.publishedProjectsCount || 0) + 1;
    await user.save();
};
exports.incrementPublishedProjects = incrementPublishedProjects;
// Helper function to set up initial values for both plans
const initializeUserPlanLimits = (user) => {
    // Set initial values based on plan
    if (user.plan === 'pro') {
        // Pro users get monthly limits that will reset
        user.projectIdeasLeft = 10;
        user.collaborationRequestsLeft = 999999; // Effectively unlimited
        user.enhancementsLeft = 8; // Pro users get 8 enhancements
    }
    else {
        // Free users get 3 project ideas and 3 collaboration requests and 2 enhancements per month
        // Free users get one-time limits that never reset
        // Only set these if the user is brand new (doesn't already have values)
        if (user.projectIdeasLeft === undefined)
            user.projectIdeasLeft = 3;
        if (user.collaborationRequestsLeft === undefined)
            user.collaborationRequestsLeft = 3;
        if (user.enhancementsLeft === undefined)
            user.enhancementsLeft = 2;
    }
};
exports.initializeUserPlanLimits = initializeUserPlanLimits;
// Helper function to reset monthly limits
const resetMonthlyLimits = async (userId) => {
    const user = await userModel_1.default.findById(userId);
    if (!user) {
        throw new ErrorHandler_1.default('User not found', 404);
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
exports.resetMonthlyLimits = resetMonthlyLimits;
