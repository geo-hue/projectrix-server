"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// models/subscription.model.ts
const mongoose_1 = __importStar(require("mongoose"));
const subscriptionSchema = new mongoose_1.default.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, "User ID is required"]
    },
    status: {
        type: String,
        enum: ['active', 'cancelled', 'expired', 'pending'],
        default: 'pending'
    },
    plan: {
        type: String,
        enum: ['free', 'pro'],
        default: 'free'
    },
    startDate: {
        type: Date,
        default: Date.now
    },
    endDate: {
        type: Date,
        required: true
    },
    renewalDate: {
        type: Date,
        default: function () {
            if (this.startDate) {
                const date = new Date(this.startDate);
                date.setDate(date.getDate() + 30);
                return date;
            }
            // If startDate doesn't exist, set renewal 30 days from now
            const date = new Date();
            date.setDate(date.getDate() + 30);
            return date;
        }
    },
    autoRenewal: {
        type: Boolean,
        default: false
    },
    provider: {
        name: {
            type: String,
            enum: ['stripe', 'flutterwave'],
            required: true
        },
        stripeSubscriptionId: String,
        stripeCustomerId: String,
        flutterwaveTransactionRef: String
    },
    paymentHistory: [{
            amount: Number,
            currency: {
                type: String,
                enum: ['USD', 'NGN']
            },
            date: {
                type: Date,
                default: Date.now
            },
            reference: String,
            provider: {
                type: String,
                enum: ['stripe', 'flutterwave']
            }
        }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});
// Add indexes for faster queries
subscriptionSchema.index({ userId: 1 });
subscriptionSchema.index({ status: 1 });
subscriptionSchema.index({ 'provider.stripeSubscriptionId': 1 });
subscriptionSchema.index({ 'provider.flutterwaveTransactionRef': 1 });
const Subscription = mongoose_1.default.model("Subscription", subscriptionSchema);
exports.default = Subscription;
