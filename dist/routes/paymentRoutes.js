"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/paymentRoutes.ts
const express_1 = __importDefault(require("express"));
const paymentController_1 = require("../controller/paymentController");
const auth_1 = require("../middleware/auth");
const paymentRouter = express_1.default.Router();
// Public endpoint to get pricing based on location
paymentRouter.get('/pricing', paymentController_1.getPricing);
// Authenticated routes
paymentRouter.post('/create-payment', auth_1.isAuthenticated, paymentController_1.createPaymentSession);
paymentRouter.post('/verify-payment', auth_1.isAuthenticated, paymentController_1.verifyPayment);
paymentRouter.get('/subscription', auth_1.isAuthenticated, paymentController_1.getSubscriptionStatus);
paymentRouter.post('/cancel', auth_1.isAuthenticated, paymentController_1.cancelSubscription);
paymentRouter.get('/payment-history', auth_1.isAuthenticated, paymentController_1.getPaymentHistory);
exports.default = paymentRouter;
