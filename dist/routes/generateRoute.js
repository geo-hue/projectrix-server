"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const generateController_1 = require("../controller/generateController");
const auth_1 = require("../middleware/auth");
const generateRouter = express_1.default.Router();
// All routes require authentication
generateRouter.use(auth_1.isAuthenticated);
// Generate new project
generateRouter.post('/generate', generateController_1.generateProject);
// Get user's generated projects
generateRouter.get('/projects', generateController_1.getGeneratedProjects);
generateRouter.get('/user/saved-projects', auth_1.isAuthenticated, generateController_1.getUserSavedProjects);
generateRouter.post('/projects/:projectId/publish', auth_1.isAuthenticated, generateController_1.publishProject);
generateRouter.post('/projects/:projectId/start', generateController_1.startProject);
// Generate another project with same preferences
generateRouter.post('/projects/:projectId/generate-another', generateController_1.generateAnother);
generateRouter.post('/submit-project', generateController_1.submitUserProject);
// Edit project route
generateRouter.put('/projects/:projectId/edit', generateController_1.editProject);
exports.default = generateRouter;
