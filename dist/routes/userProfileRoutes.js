"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const userProfileController_1 = require("../controller/userProfileController");
const auth_1 = require("../middleware/auth");
const userProfileRouter = express_1.default.Router();
// Routes requiring authentication
userProfileRouter.get('/profile', auth_1.isAuthenticated, userProfileController_1.getUserProfile);
userProfileRouter.patch('/profile', auth_1.isAuthenticated, userProfileController_1.updateUserProfile);
// Public route
userProfileRouter.get('/profile/:username', userProfileController_1.getPublicProfile);
exports.default = userProfileRouter;
