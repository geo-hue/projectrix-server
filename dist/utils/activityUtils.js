"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProfileUpdateActivity = exports.createFeedbackResponseActivity = exports.createCollaborationResponseActivity = exports.createCollaborationRequestActivity = exports.createProjectPublishedActivity = exports.createProjectSavedActivity = exports.createProjectGeneratedActivity = void 0;
// utils/activityUtils.ts
const activityController_1 = require("../controller/activityController");
// Helper function to create project generation activity
const createProjectGeneratedActivity = async (userId, projectId, projectTitle) => {
    return await (0, activityController_1.createActivity)(userId, 'project_generated', `You generated a new project: ${projectTitle}`, projectId, 'GeneratedProject', projectTitle);
};
exports.createProjectGeneratedActivity = createProjectGeneratedActivity;
// Helper function to create project saved activity
const createProjectSavedActivity = async (userId, projectId, projectTitle) => {
    return await (0, activityController_1.createActivity)(userId, 'project_saved', `You saved project: ${projectTitle}`, projectId, 'GeneratedProject', projectTitle);
};
exports.createProjectSavedActivity = createProjectSavedActivity;
// Helper function to create project published activity
const createProjectPublishedActivity = async (userId, projectId, projectTitle) => {
    return await (0, activityController_1.createActivity)(userId, 'project_published', `You published project: ${projectTitle}`, projectId, 'GeneratedProject', projectTitle);
};
exports.createProjectPublishedActivity = createProjectPublishedActivity;
// Helper function to create collaboration request activity (for the project owner)
const createCollaborationRequestActivity = async (userId, requestId, applicantName, projectTitle, role) => {
    return await (0, activityController_1.createActivity)(userId, 'collaboration_request', `${applicantName} applied for the ${role} role on your project: ${projectTitle}`, requestId, 'CollaborationRequest', projectTitle);
};
exports.createCollaborationRequestActivity = createCollaborationRequestActivity;
// Helper function to create collaboration request response activity (for the applicant)
const createCollaborationResponseActivity = async (userId, requestId, publisherName, projectTitle, role, status) => {
    const message = status === 'accepted'
        ? `${publisherName} accepted your application for the ${role} role on: ${projectTitle}`
        : `${publisherName} rejected your application for the ${role} role on: ${projectTitle}`;
    return await (0, activityController_1.createActivity)(userId, status === 'accepted' ? 'collaboration_accepted' : 'collaboration_rejected', message, requestId, 'CollaborationRequest', projectTitle);
};
exports.createCollaborationResponseActivity = createCollaborationResponseActivity;
// Helper function to create feedback response activity
const createFeedbackResponseActivity = async (userId, feedbackId, feedbackTitle, status) => {
    return await (0, activityController_1.createActivity)(userId, 'feedback_response', `Your feedback "${feedbackTitle}" has been marked as ${status}`, feedbackId, 'Feedback', feedbackTitle);
};
exports.createFeedbackResponseActivity = createFeedbackResponseActivity;
// Helper function to create profile update activity
const createProfileUpdateActivity = async (userId) => {
    return await (0, activityController_1.createActivity)(userId, 'profile_updated', 'You updated your profile information', userId, 'User');
};
exports.createProfileUpdateActivity = createProfileUpdateActivity;
