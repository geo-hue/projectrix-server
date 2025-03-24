import express from 'express';
import { 
  generatePromoCodes,
  getAllPromoCodes,
  redeemPromoCode,
  deactivatePromoCode
} from '../controller/promoCodeController';
import { isAuthenticated } from '../middleware/auth';
import { isAdmin } from '../middleware/isAdmin';

const promoCodeRouter = express.Router();

// Admin routes
promoCodeRouter.post('/admin/promo-codes/generate', isAuthenticated, isAdmin, generatePromoCodes);
promoCodeRouter.get('/admin/promo-codes', isAuthenticated, isAdmin, getAllPromoCodes);
promoCodeRouter.patch('/admin/promo-codes/:codeId/deactivate', isAuthenticated, isAdmin, deactivatePromoCode);

// User routes
promoCodeRouter.post('/promo-codes/redeem', isAuthenticated, redeemPromoCode);

export default promoCodeRouter;