"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const collaborationController_1 = require("../controller/collaborationController");
const auth_1 = require("../middleware/auth");
const collaborationRouter = express_1.default.Router();
collaborationRouter.use(auth_1.isAuthenticated); // All routes require authentication
collaborationRouter.post('/collaboration/request', collaborationController_1.submitCollaborationRequest);
collaborationRouter.get('/my-requests', collaborationController_1.getMyCollaborationRequests);
collaborationRouter.get('/incoming-requests', collaborationController_1.getIncomingCollaborationRequests);
collaborationRouter.patch('/request/:requestId', collaborationController_1.updateCollaborationRequestStatus);
collaborationRouter.get('/my-collaborations', collaborationController_1.getMyCollaborations);
exports.default = collaborationRouter;
