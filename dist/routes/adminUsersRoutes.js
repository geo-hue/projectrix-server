"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/adminUsersRoutes.ts
const express_1 = __importDefault(require("express"));
const adminUsersController_1 = require("../controller/adminUsersController");
const auth_1 = require("../middleware/auth");
const isAdmin_1 = require("../middleware/isAdmin");
const adminUsersRouter = express_1.default.Router();
// All routes require authentication and admin privileges
adminUsersRouter.use(auth_1.isAuthenticated, isAdmin_1.isAdmin);
// Get all users with filtering, sorting, and pagination
adminUsersRouter.get('/admin/users', adminUsersController_1.getUsers);
// Get user by ID
adminUsersRouter.get('/admin/users/:id', adminUsersController_1.getUserById);
// Update user role
adminUsersRouter.patch('/admin/users/:id/role', adminUsersController_1.updateUserRole);
// Update user plan
adminUsersRouter.patch('/admin/users/:id/plan', adminUsersController_1.updateUserPlan);
// Delete user
adminUsersRouter.delete('/admin/users/:id', adminUsersController_1.deleteUser);
// Reset user limits (for testing or manual adjustments)
adminUsersRouter.post('/admin/users/:id/refresh-limits', adminUsersController_1.refreshUserLimits);
exports.default = adminUsersRouter;
