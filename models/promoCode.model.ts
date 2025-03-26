import mongoose, { Document, Model, Schema } from "mongoose";

export interface IPromoCode extends Document {
  code: string;
  description: string;
  isActive: boolean;
  duration: number; // Duration in days
  maxUses: number;
  usedCount: number;
  createdBy: Schema.Types.ObjectId;
  usedBy: Array<{
    userId: Schema.Types.ObjectId;
    usedAt: Date;
  }>;
  expiresAt: Date;
  createdAt: Date;
}

const promoCodeSchema: Schema<IPromoCode> = new mongoose.Schema({
  code: {
    type: String,
    required: [true, "Promo code is required"],
    // unique: true,
    uppercase: true,
    trim: true
  },
  description: {
    type: String,
    default: "Free month of Pro access"
  },
  isActive: {
    type: Boolean,
    default: true
  },
  duration: {
    type: Number,
    default: 30, // 30 days by default
    min: 1,
    max: 365
  },
  maxUses: {
    type: Number,
    default: 1, // Single-use by default
    min: 1
  },
  usedCount: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, "Creator ID is required"]
  },
  usedBy: [{
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    usedAt: {
      type: Date,
      default: Date.now
    }
  }],
  expiresAt: {
    type: Date,
    required: [true, "Expiration date is required"]
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Add index for faster lookups
promoCodeSchema.index({ code: 1 });
promoCodeSchema.index({ isActive: 1 });
promoCodeSchema.index({ expiresAt: 1 });

const PromoCode: Model<IPromoCode> = mongoose.model("PromoCode", promoCodeSchema);

export default PromoCode;