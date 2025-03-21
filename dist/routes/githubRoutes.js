"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/githubRoutes.ts
const express_1 = __importDefault(require("express"));
const githubController_1 = require("../controller/githubController");
const auth_1 = require("../middleware/auth");
const githubRouter = express_1.default.Router();
// GitHub OAuth routes
githubRouter.get('/github/auth', auth_1.isAuthenticated, githubController_1.initiateGitHubAuth);
githubRouter.get('/github/callback', githubController_1.handleGitHubCallback);
// GitHub Repository routes
githubRouter.post('/github/repository/:projectId', auth_1.isAuthenticated, githubController_1.createGitHubRepository);
githubRouter.get('/github/repository/:projectId', auth_1.isAuthenticated, githubController_1.getGitHubRepositoryStatus);
// GitHub Auth status routes
githubRouter.get('/github/auth-status', auth_1.isAuthenticated, githubController_1.checkGitHubAuthStatus);
githubRouter.post('/github/revoke-auth', auth_1.isAuthenticated, githubController_1.revokeGitHubAuth);
githubRouter.get('/github/invitation-status/:projectId', auth_1.isAuthenticated, githubController_1.getInvitationStatus);
exports.default = githubRouter;
