"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/publishedProjectsRoutes.ts
const express_1 = __importDefault(require("express"));
const publishedProjectsController_1 = require("../controller/publishedProjectsController");
const publishedProjectsRouter = express_1.default.Router();
// Routes for published projects - these don't require authentication
publishedProjectsRouter.get('/published-projects', publishedProjectsController_1.getPublishedProjects);
publishedProjectsRouter.get('/published-projects/technologies', publishedProjectsController_1.getAvailableTechnologies);
publishedProjectsRouter.get('/published-projects/roles', publishedProjectsController_1.getAvailableRoles);
publishedProjectsRouter.get('/published-projects/:id', publishedProjectsController_1.getPublishedProject);
exports.default = publishedProjectsRouter;
