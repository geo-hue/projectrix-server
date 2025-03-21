"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/activityRoutes.ts
const express_1 = __importDefault(require("express"));
const activityController_1 = require("../controller/activityController");
const auth_1 = require("../middleware/auth");
const activityRouter = express_1.default.Router();
// All routes require authentication
activityRouter.use(auth_1.isAuthenticated);
// Get user's activities with pagination and filtering
activityRouter.get('/activities', activityController_1.getUserActivities);
// Get count of unread notifications
activityRouter.get('/activities/unread-count', activityController_1.getUnreadCount);
// Mark a specific activity as read
activityRouter.patch('/activities/:activityId/read', activityController_1.markActivityAsRead);
// Mark all activities as read
activityRouter.patch('/activities/mark-all-read', activityController_1.markAllAsRead);
// Delete an activity
activityRouter.delete('/activities/:activityId', activityController_1.deleteActivity);
//delete all activities
activityRouter.delete('/activities', activityController_1.clearAllActivities);
exports.default = activityRouter;
