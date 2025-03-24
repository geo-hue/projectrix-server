"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const promoCodeController_1 = require("../controller/promoCodeController");
const auth_1 = require("../middleware/auth");
const isAdmin_1 = require("../middleware/isAdmin");
const promoCodeRouter = express_1.default.Router();
// Admin routes
promoCodeRouter.post('/admin/promo-codes/generate', auth_1.isAuthenticated, isAdmin_1.isAdmin, promoCodeController_1.generatePromoCodes);
promoCodeRouter.get('/admin/promo-codes', auth_1.isAuthenticated, isAdmin_1.isAdmin, promoCodeController_1.getAllPromoCodes);
promoCodeRouter.patch('/admin/promo-codes/:codeId/deactivate', auth_1.isAuthenticated, isAdmin_1.isAdmin, promoCodeController_1.deactivatePromoCode);
// User routes
promoCodeRouter.post('/promo-codes/redeem', auth_1.isAuthenticated, promoCodeController_1.redeemPromoCode);
exports.default = promoCodeRouter;
