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
const mongoose_1 = __importStar(require("mongoose"));
const userSchema = new mongoose_1.default.Schema({
    name: {
        type: String,
        required: [true, "Please enter your name"],
    },
    email: {
        type: String,
        required: [true, "Please enter your email"],
        unique: true,
        validate: {
            validator: function (email) {
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
            },
            message: "Please enter a valid email",
        },
    },
    avatar: {
        type: String,
        required: [true, "Please add an avatar"],
    },
    githubId: {
        type: String,
        required: true,
        unique: true,
    },
    role: {
        type: String,
        default: "user",
        enum: ["user", "admin"]
    },
    username: {
        type: String,
        required: true,
        unique: true,
    },
    githubUsername: {
        type: String,
    },
    bio: {
        type: String,
    },
    skills: [{
            type: String,
        }],
    projectsGenerated: {
        type: Number,
        default: 0,
    },
    projectsCollaborated: {
        type: Number,
        default: 0,
    },
    publishedProjectsCount: {
        type: Number,
        default: 0,
    },
    isAvailable: {
        type: Boolean,
        default: true,
    },
    plan: {
        type: String,
        enum: ["free", "pro"],
        default: "free"
    },
    discordId: {
        type: String,
        sparse: true
    },
    discordUsername: {
        type: String
    },
    projectIdeasLeft: {
        type: Number,
        default: 3
    },
    enhancementsLeft: {
        type: Number,
        default: 2 // Default for free users
    },
    collaborationRequestsLeft: {
        type: Number,
        default: 3
    },
    planExpiryDate: {
        type: Date
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    startedProjects: [{
            projectId: {
                type: mongoose_1.Schema.Types.ObjectId,
                ref: 'GeneratedProject'
            },
            startedAt: {
                type: Date,
                default: Date.now
            },
            status: {
                type: String,
                enum: ['in-progress', 'completed', 'abandoned'],
                default: 'in-progress'
            }
        }],
    collaborations: [{
            projectId: {
                type: mongoose_1.Schema.Types.ObjectId,
                ref: 'GeneratedProject'
            },
            role: String,
            joinedAt: {
                type: Date,
                default: Date.now
            }
        }],
    newsletterSubscribed: {
        type: Boolean,
        default: true // Users are subscribed by default
    },
    emailVerified: {
        type: Boolean,
        default: false // Email needs to be verified
    },
    lastEmailSent: {
        type: Date
    },
    // New fields for user-specific limit resets
    nextLimitResetDate: {
        type: Date,
        default: function () {
            // Set initial reset date to 30 days after account creation
            const date = new Date();
            date.setDate(date.getDate() + 30);
            return date;
        }
    },
    lastLimitResetDate: {
        type: Date
    }
});
// Pre-save hook to handle changes in subscription plan
userSchema.pre('save', function (next) {
    // Only run this if plan is being modified
    if (this.isModified('plan')) {
        // Reset user limits based on new plan
        if (this.plan === 'pro') {
            this.projectIdeasLeft = 10;
            this.collaborationRequestsLeft = 999999; // Effectively unlimited
            this.enhancementsLeft = 8;
        }
        else if (this.plan === 'free') {
            // If downgrading from pro to free, set reasonable limits
            this.projectIdeasLeft = Math.min(this.projectIdeasLeft, 3);
            this.collaborationRequestsLeft = Math.min(this.collaborationRequestsLeft, 3);
            this.enhancementsLeft = Math.min(this.enhancementsLeft, 2);
        }
    }
    next();
});
const User = mongoose_1.default.model("User", userSchema);
exports.default = User;
