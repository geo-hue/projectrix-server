"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/userRoute.ts
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const userController_1 = require("../controller/userController");
const userRouter = express_1.default.Router();
// Auth routes
userRouter.post('/auth/github', userController_1.githubAuth);
userRouter.post('/auth/logout', auth_1.isAuthenticated, auth_1.handleLogout, userController_1.logout);
userRouter.get('/auth/refresh', auth_1.isAuthenticated, userController_1.refreshUserCache);
userRouter.post('/auth/validate-token', auth_1.isAuthenticated, userController_1.validateToken);
userRouter.post('/auth/refresh-token', userController_1.refreshToken);
// User profile routes
userRouter.get('/me', auth_1.isAuthenticated, userController_1.getUserProfile);
userRouter.patch('/user/preferences', auth_1.isAuthenticated, userController_1.updateUserPreferences);
exports.default = userRouter;
