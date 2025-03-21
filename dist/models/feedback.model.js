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
// models/feedback.model.ts
const mongoose_1 = __importStar(require("mongoose"));
const feedbackSchema = new mongoose_1.default.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, "User ID is required"]
    },
    category: {
        type: String,
        enum: ['bug', 'feature', 'improvement', 'general'],
        required: [true, "Category is required"]
    },
    title: {
        type: String,
        required: [true, "Title is required"],
        trim: true,
        maxlength: [100, "Title cannot be more than 100 characters"]
    },
    description: {
        type: String,
        required: [true, "Description is required"],
        trim: true,
        maxlength: [1000, "Description cannot be more than 1000 characters"]
    },
    rating: {
        type: Number,
        min: 1,
        max: 5,
        default: 5
    },
    status: {
        type: String,
        enum: ['pending', 'under-review', 'implemented', 'declined'],
        default: 'pending'
    },
    upvotes: [{
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'User'
        }],
    tags: [{
            type: String,
            trim: true
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
// Add indexes for faster querying
feedbackSchema.index({ status: 1 });
feedbackSchema.index({ category: 1 });
feedbackSchema.index({ userId: 1 });
feedbackSchema.index({ createdAt: -1 });
const Feedback = mongoose_1.default.model("Feedback", feedbackSchema);
exports.default = Feedback;
