"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/analyticsRoutes.ts
const express_1 = __importDefault(require("express"));
const analyticsController_1 = require("../controller/analyticsController");
const auth_1 = require("../middleware/auth");
const isAdmin_1 = require("../middleware/isAdmin");
const analyticsRouter = express_1.default.Router();
// All analytics routes require authentication and admin privileges
analyticsRouter.use(auth_1.isAuthenticated, isAdmin_1.isAdmin);
// Dashboard summary for admin dashboard
analyticsRouter.get('/admin/analytics/dashboard', analyticsController_1.getDashboardSummary);
// Detailed analytics endpoints
analyticsRouter.get('/admin/analytics/users', analyticsController_1.getUserMetrics);
analyticsRouter.get('/admin/analytics/projects', analyticsController_1.getProjectMetrics);
analyticsRouter.get('/admin/analytics/collaborations', analyticsController_1.getCollaborationMetrics);
analyticsRouter.get('/admin/analytics/revenue', analyticsController_1.getRevenueMetrics);
analyticsRouter.get('/admin/analytics/system', analyticsController_1.getSystemMetrics);
// Endpoint to trigger analytics data update (for testing or manual updates)
analyticsRouter.post('/admin/analytics/update', analyticsController_1.updateAnalyticsData);
exports.default = analyticsRouter;
