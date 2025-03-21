"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/discordRoutes.ts
const express_1 = __importDefault(require("express"));
const discordController_1 = require("../controller/discordController");
const auth_1 = require("../middleware/auth");
const discordRouter = express_1.default.Router();
// OAuth routes
discordRouter.get('/discord/oauth/:projectId', auth_1.isAuthenticated, discordController_1.initDiscordOAuth);
discordRouter.get('/discord/callback', discordController_1.handleDiscordCallback);
discordRouter.post('/discord/channel/:projectId', auth_1.isAuthenticated, discordController_1.createDiscordChannel);
discordRouter.get('/discord/invite/:projectId', auth_1.isAuthenticated, discordController_1.getDiscordInvite);
exports.default = discordRouter;
