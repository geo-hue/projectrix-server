"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDiscordInvite = exports.createDiscordChannel = exports.handleDiscordCallback = exports.initDiscordOAuth = void 0;
const catchAsyncErrors_1 = require("../middleware/catchAsyncErrors");
const ErrorHandler_1 = __importDefault(require("../utils/ErrorHandler"));
const generateProject_model_1 = __importDefault(require("../models/generateProject.model"));
const discordBot_1 = require("../utils/discordBot");
const discordOAuth_1 = require("../utils/discordOAuth");
const userModel_1 = __importDefault(require("../models/userModel"));
// Generate a state token to prevent CSRF attacks
const generateStateToken = (projectId, userId) => {
    const state = {
        projectId,
        userId,
        timestamp: Date.now()
    };
    return Buffer.from(JSON.stringify(state)).toString('base64');
};
// Parse a state token
const parseStateToken = (state) => {
    try {
        return JSON.parse(Buffer.from(state, 'base64').toString());
    }
    catch (error) {
        console.error('Error parsing state token:', error);
        return null;
    }
};
// Initialize Discord OAuth flow
exports.initDiscordOAuth = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { projectId } = req.params;
        if (!req.user) {
            return next(new ErrorHandler_1.default("Authentication required", 401));
        }
        const userId = req.user._id;
        if (!projectId) {
            return next(new ErrorHandler_1.default('Project ID is required', 400));
        }
        // Check if user already has a linked Discord account
        const user = await userModel_1.default.findById(userId);
        if (user?.discordId) {
            // User already has a linked Discord account
            console.log(`User ${userId} already has linked Discord account: ${user.discordId}`);
            // Try to directly add them to the channel
            const project = await generateProject_model_1.default.findById(projectId);
            if (project && project.discordChannelId) {
                const added = await (0, discordOAuth_1.addUserToChannel)(user.discordId, project.discordChannelId);
                if (added) {
                    // Successfully added to channel
                    return res.status(200).json({
                        success: true,
                        message: 'Discord account already linked and added to channel',
                        inviteLink: project.discordInviteLink || null
                    });
                }
            }
        }
        // Generate state token to prevent CSRF
        const state = generateStateToken(projectId, userId.toString());
        // Get Discord OAuth URL
        const authUrl = (0, discordOAuth_1.getDiscordAuthUrl)(projectId, state);
        // Return the auth URL for frontend to redirect
        res.status(200).json({
            success: true,
            authUrl
        });
    }
    catch (error) {
        console.error('Discord OAuth initialization error:', error);
        return next(new ErrorHandler_1.default(error.message || 'Discord integration error', 500));
    }
});
// Handle Discord OAuth callback
exports.handleDiscordCallback = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { code, state } = req.query;
        if (!code || !state) {
            return next(new ErrorHandler_1.default('Missing required parameters', 400));
        }
        // Parse and validate state token
        const stateData = parseStateToken(state);
        if (!stateData) {
            return next(new ErrorHandler_1.default('Invalid state token', 400));
        }
        const { projectId, userId } = stateData;
        // Validate timestamp to prevent replay attacks (10 minute window)
        const now = Date.now();
        if (now - stateData.timestamp > 10 * 60 * 1000) {
            return next(new ErrorHandler_1.default('State token expired', 400));
        }
        // Link the Discord account
        const discordUser = await (0, discordOAuth_1.linkDiscordAccount)(userId, code);
        if (!discordUser) {
            return next(new ErrorHandler_1.default('Failed to link Discord account', 500));
        }
        // Find the project
        const project = await generateProject_model_1.default.findById(projectId);
        if (!project) {
            return next(new ErrorHandler_1.default('Project not found', 404));
        }
        // Create Discord channel if it doesn't exist
        if (!project.discordChannelId) {
            const discordChannel = await (0, discordBot_1.createProjectChannel)(projectId, project.title);
            if (!discordChannel) {
                return next(new ErrorHandler_1.default('Failed to create Discord channel', 500));
            }
            // Update project with Discord channel info
            project.discordChannelId = discordChannel.channelId;
            project.discordInviteLink = discordChannel.inviteLink;
            await project.save();
        }
        // Try to add user to the channel
        const added = await (0, discordOAuth_1.addUserToChannel)(discordUser.discordId, project.discordChannelId);
        // Always return the invite link as fallback
        const inviteLink = project.discordInviteLink ||
            (await (0, discordBot_1.refreshInviteLink)(project.discordChannelId, project.title));
        // Redirect back to frontend with success parameter
        res.redirect(`${process.env.FRONTEND_URL}/projects/${projectId}?discord=${added ? 'success' : 'invite'}&invite=${encodeURIComponent(inviteLink)}`);
    }
    catch (error) {
        console.error('Discord callback error:', error);
        res.redirect(`${process.env.FRONTEND_URL}/projects/${req.query.state || ''}?discord=error`);
    }
});
// Create a Discord channel for a project
exports.createDiscordChannel = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { projectId } = req.params;
        if (!req.user) {
            return next(new ErrorHandler_1.default("Authentication required", 401));
        }
        const userId = req.user._id;
        console.log(`Discord channel request for project ${projectId} by user ${userId}`);
        // Check if project exists
        const project = await generateProject_model_1.default.findOne({ _id: projectId });
        if (!project) {
            return next(new ErrorHandler_1.default("Project not found", 404));
        }
        console.log(`Project found: ${project.title}`);
        // Check if user is the project owner or an accepted collaborator
        const isOwner = project.userId.toString() === userId.toString();
        const isCollaborator = project.teamMembers?.some(member => member.userId.toString() === userId.toString() && member.role);
        console.log(`User permissions - IsOwner: ${isOwner}, IsCollaborator: ${isCollaborator}`);
        if (!isOwner && !isCollaborator) {
            return next(new ErrorHandler_1.default("You don't have permission to create a Discord channel for this project", 403));
        }
        // Check if user has a linked Discord account
        const user = await userModel_1.default.findById(userId);
        if (user?.discordId) {
            // If project already has a Discord channel
            if (project.discordChannelId && project.discordInviteLink) {
                console.log(`Project already has Discord channel: ${project.discordChannelId}`);
                // Try to add the user directly to the channel
                const added = await (0, discordOAuth_1.addUserToChannel)(user.discordId, project.discordChannelId);
                if (added) {
                    return res.status(200).json({
                        success: true,
                        message: "Successfully added to Discord channel",
                        inviteLink: project.discordInviteLink
                    });
                }
                // If adding failed, refresh the invite link
                const newInvite = await (0, discordBot_1.refreshInviteLink)(project.discordChannelId, project.title);
                if (newInvite) {
                    console.log(`Refreshed invite link: ${newInvite}`);
                    project.discordInviteLink = newInvite;
                    await project.save();
                    return res.status(200).json({
                        success: true,
                        message: "Discord channel already exists, invite link refreshed. This link will give you access to a private project channel.",
                        inviteLink: newInvite
                    });
                }
            }
            // Create a new Discord channel
            console.log("Creating a new Discord channel");
            const discordChannel = await (0, discordBot_1.createProjectChannel)(projectId, project.title);
            if (!discordChannel) {
                return next(new ErrorHandler_1.default("Failed to create Discord channel", 500));
            }
            console.log(`Channel created successfully: ${discordChannel.channelId} with invite ${discordChannel.inviteLink}`);
            // Update project with Discord channel info
            project.discordChannelId = discordChannel.channelId;
            project.discordInviteLink = discordChannel.inviteLink;
            await project.save();
            // Try to add the user to the channel
            await (0, discordOAuth_1.addUserToChannel)(user.discordId, discordChannel.channelId);
            return res.status(201).json({
                success: true,
                message: "Discord channel created successfully. This link will give you access to a private project channel.",
                inviteLink: discordChannel.inviteLink
            });
        }
        else {
            // User doesn't have a linked Discord account, start OAuth flow
            const state = generateStateToken(projectId, userId.toString());
            const authUrl = (0, discordOAuth_1.getDiscordAuthUrl)(projectId, state);
            return res.status(200).json({
                success: true,
                message: "Discord account linking required",
                authUrl
            });
        }
    }
    catch (error) {
        console.error('Discord channel error:', error);
        return next(new ErrorHandler_1.default(error.message || "Discord integration error", 500));
    }
});
// Get Discord invite link for a project
exports.getDiscordInvite = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { projectId } = req.params;
        if (!req.user) {
            return next(new ErrorHandler_1.default("Authentication required", 401));
        }
        const userId = req.user._id;
        // Check if project exists
        const project = await generateProject_model_1.default.findOne({ _id: projectId });
        if (!project) {
            return next(new ErrorHandler_1.default("Project not found", 404));
        }
        // Check if user is the project owner or an accepted collaborator
        const isOwner = project.userId.toString() === userId.toString();
        const isCollaborator = project.teamMembers?.some(member => member.userId.toString() === userId.toString() && member.role);
        if (!isOwner && !isCollaborator) {
            return next(new ErrorHandler_1.default("You don't have permission to access this project's Discord channel", 403));
        }
        // Check if project has a Discord channel
        if (!project.discordChannelId || !project.discordInviteLink) {
            return next(new ErrorHandler_1.default("This project doesn't have a Discord channel yet", 404));
        }
        // Always refresh the invite to ensure it's valid
        const newInvite = await (0, discordBot_1.refreshInviteLink)(project.discordChannelId, project.title);
        if (newInvite) {
            project.discordInviteLink = newInvite;
            await project.save();
        }
        res.status(200).json({
            success: true,
            message: "Invite link generated. This link will give you access to a private project channel.",
            inviteLink: project.discordInviteLink
        });
    }
    catch (error) {
        console.error('Get Discord invite error:', error);
        return next(new ErrorHandler_1.default(error.message || "Discord integration error", 500));
    }
});
