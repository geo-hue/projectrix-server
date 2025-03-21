"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const feedbackController_1 = require("../controller/feedbackController");
const auth_1 = require("../middleware/auth");
const isAdmin_1 = require("../middleware/isAdmin");
const feedbackRouter = express_1.default.Router();
// Public routes
feedbackRouter.get('/feedback/public', feedbackController_1.getPublicFeedback);
// Authenticated user routes
feedbackRouter.post('/feedback/submit', auth_1.isAuthenticated, feedbackController_1.submitFeedback);
feedbackRouter.get('/feedback/my-feedback', auth_1.isAuthenticated, feedbackController_1.getMyFeedback);
feedbackRouter.post('/feedback/:feedbackId/upvote', auth_1.isAuthenticated, feedbackController_1.upvoteFeedback);
// Admin only routes
feedbackRouter.get('/feedback/admin/all', auth_1.isAuthenticated, isAdmin_1.isAdmin, feedbackController_1.getAllFeedback);
feedbackRouter.patch('/feedback/admin/:feedbackId/status', auth_1.isAuthenticated, isAdmin_1.isAdmin, feedbackController_1.updateFeedbackStatus);
exports.default = feedbackRouter;
