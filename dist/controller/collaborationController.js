"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyCollaborations = exports.updateCollaborationRequestStatus = exports.getIncomingCollaborationRequests = exports.getMyCollaborationRequests = exports.submitCollaborationRequest = void 0;
const catchAsyncErrors_1 = require("../middleware/catchAsyncErrors");
const ErrorHandler_1 = __importDefault(require("../utils/ErrorHandler"));
const collaborationRequest_model_1 = __importDefault(require("../models/collaborationRequest.model"));
const generateProject_model_1 = __importDefault(require("../models/generateProject.model"));
const userModel_1 = __importDefault(require("../models/userModel"));
const activityUtils_1 = require("../utils/activityUtils");
const pricingUtils_1 = require("../utils/pricingUtils");
const redis_1 = require("../utils/redis");
const githubService_1 = require("../utils/githubService");
// Submit a collaboration request
exports.submitCollaborationRequest = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { projectId, role, message } = req.body;
        if (!req.user) {
            return next(new ErrorHandler_1.default("Authentication required", 401));
        }
        const applicantId = req.user._id;
        // Log the received data
        console.log('Received application request:', { projectId, role, message, applicantId });
        // Validate project exists
        const project = await generateProject_model_1.default.findById(projectId);
        if (!project) {
            return next(new ErrorHandler_1.default("Project not found", 404));
        }
        const projectTitle = project.title;
        // Get project owner id
        const publisherId = project.userId;
        // Check if user is the project owner
        if (applicantId.toString() === publisherId.toString()) {
            return next(new ErrorHandler_1.default("You cannot apply to your own project", 400));
        }
        // Check if role exists and is available
        const roleExists = project.teamStructure?.roles?.find(r => r.title === role);
        if (!roleExists) {
            return next(new ErrorHandler_1.default("Role not found in project", 404));
        }
        if (roleExists.filled) {
            return next(new ErrorHandler_1.default("This role is already filled", 400));
        }
        // Check if user already applied for this role
        const existingRequest = await collaborationRequest_model_1.default.findOne({
            projectId,
            applicantId,
            role
        });
        if (existingRequest) {
            return next(new ErrorHandler_1.default("You have already applied for this role", 400));
        }
        const hasRequestsLeft = await (0, pricingUtils_1.checkCollaborationRequestLimit)(applicantId.toString());
        if (!hasRequestsLeft) {
            return next(new ErrorHandler_1.default("You have reached your collaboration request limit for this month. Upgrade to Pro for unlimited requests.", 403));
        }
        // Check if user has reached active collaboration limit
        const canHaveMoreCollaborations = await (0, pricingUtils_1.checkActiveCollaborationLimit)(applicantId.toString());
        if (!canHaveMoreCollaborations) {
            return next(new ErrorHandler_1.default("You have reached your active collaboration limit (1). Upgrade to Pro for unlimited collaborations.", 403));
        }
        // Create collaboration request
        const collaborationRequest = await collaborationRequest_model_1.default.create({
            projectId,
            applicantId,
            publisherId,
            role,
            message: message || "",
            status: 'pending',
            appliedAt: new Date()
        });
        await (0, pricingUtils_1.decrementCollaborationRequests)(applicantId.toString());
        // Populate response with user data
        const populatedRequest = await collaborationRequest_model_1.default.findById(collaborationRequest._id)
            .populate('projectId', 'title subtitle technologies teamStructure')
            .populate('applicantId', 'name username avatar email')
            .populate('publisherId', 'name username avatar email');
        const applicant = await userModel_1.default.findById(applicantId);
        const applicantName = applicant?.name || 'Applicant';
        await (0, activityUtils_1.createCollaborationRequestActivity)(publisherId.toString(), collaborationRequest._id?.toString() || collaborationRequest.id, applicantName, projectTitle, role);
        res.status(201).json({
            success: true,
            message: "Collaboration request submitted successfully",
            collaborationRequest: populatedRequest
        });
    }
    catch (error) {
        console.error('Error submitting collaboration request:', error);
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
// Get user's collaboration requests
exports.getMyCollaborationRequests = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        if (!req.user) {
            return next(new ErrorHandler_1.default("Authentication required", 401));
        }
        const userId = req.user._id;
        const requests = await collaborationRequest_model_1.default.find({ applicantId: userId })
            .populate({
            path: 'projectId',
            select: 'title subtitle technologies teamStructure'
        })
            .populate({
            path: 'publisherId',
            select: 'name username avatar email'
        })
            .sort({ appliedAt: -1 });
        res.status(200).json({
            success: true,
            requests
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
// Get incoming collaboration requests for projects owned by the user
exports.getIncomingCollaborationRequests = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        if (!req.user) {
            return next(new ErrorHandler_1.default("Authentication required", 401));
        }
        const userId = req.user._id;
        // Find all projects owned by the user
        const projects = await generateProject_model_1.default.find({ userId });
        const projectIds = projects.map(project => project._id);
        // Find all collaboration requests for these projects
        const requests = await collaborationRequest_model_1.default.find({
            projectId: { $in: projectIds }
        })
            .populate({
            path: 'projectId',
            select: 'title subtitle technologies teamStructure'
        })
            .populate({
            path: 'applicantId',
            select: 'name username avatar email'
        })
            .sort({ appliedAt: -1 });
        res.status(200).json({
            success: true,
            requests
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
// Update collaboration request status (accept/reject)
exports.updateCollaborationRequestStatus = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { requestId } = req.params;
        const { status } = req.body;
        if (!req.user) {
            return next(new ErrorHandler_1.default("Authentication required", 401));
        }
        const userId = req.user._id;
        if (!['accepted', 'rejected'].includes(status)) {
            return next(new ErrorHandler_1.default("Invalid status. Status must be 'accepted' or 'rejected'", 400));
        }
        // Find the request
        const request = await collaborationRequest_model_1.default.findById(requestId);
        if (!request) {
            return next(new ErrorHandler_1.default("Collaboration request not found", 404));
        }
        // Get the project
        const project = await generateProject_model_1.default.findById(request.projectId);
        if (!project) {
            return next(new ErrorHandler_1.default("Project not found", 404));
        }
        // Verify the user is the owner of the project
        if (project.userId.toString() !== userId.toString()) {
            return next(new ErrorHandler_1.default("You don't have permission to update this request", 403));
        }
        const applicant = await userModel_1.default.findById(request.applicantId);
        if (!applicant) {
            return next(new ErrorHandler_1.default("Applicant not found", 404));
        }
        if (status === 'accepted' && (0, pricingUtils_1.isPricingEnabled)() && applicant.plan === 'free') {
            const activeCollabs = applicant.projectsCollaborated || 0;
            if (activeCollabs >= 1) {
                // Auto-reject since free user already has an active collaboration
                request.status = 'rejected';
                await request.save();
                await (0, activityUtils_1.createCollaborationResponseActivity)(request.applicantId.toString(), request._id?.toString() || request.id, req.user.name, project.title, request.role, 'rejected');
                return res.status(403).json({
                    success: false,
                    message: "This user has reached their active collaboration limit (1). They need to upgrade to Pro for more collaborations.",
                    request
                });
            }
        }
        // Update the request status
        request.status = status;
        await request.save();
        let rejectedRequests = [];
        // If accepting a request, mark the role as filled and reject other pending requests for the same role
        if (status === 'accepted') {
            // Find the role in the project
            const roleIndex = project.teamStructure.roles.findIndex(r => r.title === request.role);
            if (roleIndex !== -1) {
                // Mark the role as filled
                project.teamStructure.roles[roleIndex].filled = true;
                await project.save();
                // Add user to project team members
                const teamMember = {
                    userId: request.applicantId,
                    role: request.role,
                    joinedAt: new Date()
                };
                // Check if teamMembers array exists
                if (!project.teamMembers) {
                    project.teamMembers = [];
                }
                // Add the new team member
                project.teamMembers.push(teamMember);
                await project.save();
                // Update user's collaboration count
                await userModel_1.default.findByIdAndUpdate(request.applicantId, { $inc: { projectsCollaborated: 1 } });
                // If the project has a GitHub repository, add the new team member
                if (project.githubInfo && project.githubInfo.repoOwner && project.githubInfo.repoName) {
                    try {
                        // Get the GitHub service for the project owner
                        const githubService = await (0, githubService_1.getGitHubServiceForUser)(userId.toString());
                        if (githubService) {
                            // Get the GitHub username from the user document
                            const collaborator = await userModel_1.default.findById(request.applicantId);
                            if (collaborator && collaborator.username) {
                                // Add as collaborator with appropriate permissions
                                const role = request.role;
                                const permission = determinePermissionLevel(role);
                                await githubService.addCollaborator(project.githubInfo.repoOwner, project.githubInfo.repoName, collaborator.username, permission);
                                console.log(`Added ${collaborator.username} as collaborator to repository`);
                            }
                        }
                    }
                    catch (githubError) {
                        console.error('Error adding collaborator to GitHub repository:', githubError);
                        // Continue with the rest of the process even if GitHub integration fails
                    }
                }
                if ((0, pricingUtils_1.isPricingEnabled)() && applicant.plan === 'free') {
                    const otherPendingRequests = await collaborationRequest_model_1.default.find({
                        applicantId: request.applicantId,
                        status: 'pending',
                        _id: { $ne: requestId }
                    }).populate('projectId', 'title');
                    // Reject all other pending requests for this free user
                    if (otherPendingRequests.length > 0) {
                        rejectedRequests = await Promise.all(otherPendingRequests.map(async (req) => {
                            req.status = 'rejected';
                            await req.save();
                            // Create activity for auto-rejection
                            await (0, activityUtils_1.createCollaborationResponseActivity)(req.applicantId.toString(), req._id?.toString() || req.id, "System", req.projectId.title || "Project", req.role, 'rejected');
                            return req;
                        }));
                    }
                }
                // Find all other pending requests for the same role and reject them
                const otherRequests = await collaborationRequest_model_1.default.find({
                    projectId: request.projectId,
                    role: request.role,
                    status: 'pending',
                    _id: { $ne: requestId }
                });
                // Reject all other pending requests for this role
                if (otherRequests.length > 0) {
                    const rejectedRoleRequests = await Promise.all(otherRequests.map(async (req) => {
                        req.status = 'rejected';
                        await req.save();
                        return req;
                    }));
                    // Add to rejected requests list
                    rejectedRequests = [...rejectedRequests, ...rejectedRoleRequests];
                }
            }
        }
        const publisher = await userModel_1.default.findById(userId);
        await (0, activityUtils_1.createCollaborationResponseActivity)(request.applicantId.toString(), request._id?.toString() || request.id, publisher?.name || "Project Owner", project.title, request.role, status);
        const updatedApplicant = await userModel_1.default.findById(request.applicantId);
        await redis_1.redis.set(applicant.githubId, JSON.stringify(updatedApplicant), 'EX', 3600);
        res.status(200).json({
            success: true,
            message: `Collaboration request ${status}`,
            request,
            rejectedRequests: rejectedRequests.length > 0 ? rejectedRequests : undefined
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
// Helper function to determine permission level
function determinePermissionLevel(role) {
    // Default to write access (push)
    const lowerRole = role.toLowerCase();
    if (lowerRole.includes('lead') || lowerRole.includes('senior') || lowerRole.includes('architect')) {
        return 'admin';
    }
    else if (lowerRole.includes('reviewer') || lowerRole.includes('tester')) {
        return 'pull';
    }
    else {
        return 'push'; // Default write access
    }
}
// Get user's active collaborations
exports.getMyCollaborations = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        if (!req.user) {
            return next(new ErrorHandler_1.default("Authentication required", 401));
        }
        const userId = req.user._id;
        console.log(`Getting collaborations for user ${userId}`);
        // Find accepted collaboration requests where this user is the applicant
        const acceptedRequests = await collaborationRequest_model_1.default.find({
            applicantId: userId,
            status: 'accepted'
        }).populate({
            path: 'projectId',
            select: 'title subtitle technologies teamStructure teamMembers userId isPublished',
            populate: [
                {
                    path: 'userId',
                    select: 'name username avatar email'
                },
                {
                    path: 'teamMembers.userId',
                    select: 'name username avatar email'
                }
            ]
        });
        console.log(`Found ${acceptedRequests.length} accepted collaboration requests`);
        // Find all projects this user has published that have team members
        const ownedProjects = await generateProject_model_1.default.find({
            userId,
            isPublished: true
        }).populate({
            path: 'teamMembers.userId',
            select: 'name username avatar email'
        });
        console.log(`Found ${ownedProjects.length} owned projects`);
        // Ensure proper formatting for consistent data structure
        const collaborations = [
            ...acceptedRequests.map(req => {
                console.log(`Processing collaboration for project: ${req.projectId.title || "Project"}`);
                return {
                    type: 'member',
                    project: {
                        ...(req.projectId.toObject ? req.projectId.toObject() : req.projectId),
                        // Ensure team members are properly formatted
                        teamMembers: (req.projectId.teamMembers || []).map((member) => ({
                            userId: member.userId,
                            role: member.role,
                            joinedAt: member.joinedAt
                        }))
                    },
                    role: req.role,
                    joinedAt: req.appliedAt
                };
            }),
            ...ownedProjects.map(project => {
                console.log(`Processing owned project: ${project.title}`);
                // Log team members data for debugging
                if (project.teamMembers && project.teamMembers.length > 0) {
                    console.log('Team members found:', project.teamMembers.map(m => ({
                        userId: m.userId ? (m.userId._id || m.userId) : 'missing',
                        name: m.userId?.name || 'unknown',
                        role: m.role
                    })));
                }
                return {
                    type: 'owner',
                    project: project.toObject(),
                    role: 'Project Owner',
                    teamMembers: project.teamMembers || []
                };
            })
        ];
        res.status(200).json({
            success: true,
            collaborations
        });
    }
    catch (error) {
        console.error('Error fetching collaborations:', error);
        return next(new ErrorHandler_1.default(error.message || 'Failed to fetch collaborations', 500));
    }
});
