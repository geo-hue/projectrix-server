"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPublicProfile = exports.updateUserProfile = exports.getUserProfile = void 0;
const catchAsyncErrors_1 = require("../middleware/catchAsyncErrors");
const ErrorHandler_1 = __importDefault(require("../utils/ErrorHandler"));
const userProfile_model_1 = __importDefault(require("../models/userProfile.model"));
const userModel_1 = __importDefault(require("../models/userModel"));
const generateProject_model_1 = __importDefault(require("../models/generateProject.model"));
const activityUtils_1 = require("../utils/activityUtils");
// Get or create user profile
exports.getUserProfile = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        if (!req.user) {
            return next(new ErrorHandler_1.default("Authentication required", 401));
        }
        const userId = req.user._id;
        let profile = await userProfile_model_1.default.findOne({ userId });
        // If profile doesn't exist, create it
        if (!profile) {
            profile = await userProfile_model_1.default.create({
                userId,
                bio: "",
                skills: [],
                website: "",
                githubProfile: "",
                twitterProfile: "",
                linkedinProfile: "",
                availability: "available",
                hoursPerWeek: "10-20 hours",
                preferredTechnologies: [],
                preferredRoles: [],
                publicEmail: false
            });
        }
        res.status(200).json({
            success: true,
            profile
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
// Update user profile
exports.updateUserProfile = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        if (!req.user) {
            return next(new ErrorHandler_1.default("Authentication required", 401));
        }
        const userId = req.user._id;
        const updates = req.body;
        // Validate and sanitize fields
        const allowedFields = [
            'bio', 'skills', 'website', 'githubProfile', 'twitterProfile', 'linkedinProfile',
            'availability', 'hoursPerWeek', 'preferredTechnologies', 'preferredRoles', 'publicEmail'
        ];
        const sanitizedUpdates = {};
        allowedFields.forEach(field => {
            if (updates[field] !== undefined) {
                sanitizedUpdates[field] = updates[field];
            }
        });
        // Find or create profile
        let profile = await userProfile_model_1.default.findOne({ userId });
        if (!profile) {
            profile = await userProfile_model_1.default.create({
                userId,
                ...sanitizedUpdates
            });
        }
        else {
            profile = await userProfile_model_1.default.findOneAndUpdate({ userId }, { $set: sanitizedUpdates }, { new: true });
        }
        await (0, activityUtils_1.createProfileUpdateActivity)(userId.toString());
        // Update user's skills in the User model as well
        if (sanitizedUpdates.skills) {
            await userModel_1.default.findByIdAndUpdate(userId, { skills: sanitizedUpdates.skills });
        }
        res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            profile
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
// Get public profile for any user
exports.getPublicProfile = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { username } = req.params;
        console.log("🔍 Looking for user with username:", username);
        // Find user by username, making the query case-insensitive
        const user = await userModel_1.default.findOne({
            username: { $regex: new RegExp(`^${username}$`, 'i') }
        }).select('name username avatar email createdAt projectsGenerated projectsCollaborated');
        if (!user) {
            console.log("❌ User not found with username:", username);
            return next(new ErrorHandler_1.default("User not found", 404));
        }
        console.log("✅ User found:", user._id, user.username);
        // Get user profile
        const profile = await userProfile_model_1.default.findOne({ userId: user._id });
        // Get published projects
        const publishedProjects = await generateProject_model_1.default.find({
            userId: user._id,
            isPublished: true
        }).select('title subtitle description technologies complexity teamStructure duration teamSize createdAt');
        // Count collaborations
        const collaborationsCount = user.projectsCollaborated || 0;
        // Prepare the response
        const publicProfile = {
            user: {
                ...user.toObject(),
                email: profile?.publicEmail ? user.email : undefined
            },
            profile: profile || {},
            stats: {
                projectsGenerated: user.projectsGenerated || 0,
                projectsCollaborated: collaborationsCount,
                publishedProjects: publishedProjects.length
            },
            publishedProjects,
        };
        res.status(200).json({
            success: true,
            publicProfile
        });
    }
    catch (error) {
        console.error("Error in getPublicProfile:", error);
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
