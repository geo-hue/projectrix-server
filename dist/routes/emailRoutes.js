"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/emailRoutes.ts
const express_1 = __importDefault(require("express"));
const emailController_1 = require("../controller/emailController");
const auth_1 = require("../middleware/auth");
const isAdmin_1 = require("../middleware/isAdmin");
const emailRouter = express_1.default.Router();
// Public routes
emailRouter.get('/email/unsubscribe', emailController_1.unsubscribeFromNewsletter);
// Authenticated user routes
emailRouter.get('/email/preferences', auth_1.isAuthenticated, emailController_1.getNewsletterPreference);
emailRouter.post('/email/preferences', auth_1.isAuthenticated, emailController_1.updateNewsletterPreference);
// Admin only routes
emailRouter.post('/email/test', auth_1.isAuthenticated, isAdmin_1.isAdmin, emailController_1.sendTestEmail);
emailRouter.post('/email/send-newsletter', auth_1.isAuthenticated, isAdmin_1.isAdmin, emailController_1.sendNewsletterToAllUsers);
exports.default = emailRouter;
