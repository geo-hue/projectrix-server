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
const activitySchema = new mongoose_1.default.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, "User ID is required"]
    },
    type: {
        type: String,
        enum: [
            'project_generated',
            'project_published',
            'project_saved',
            'collaboration_request',
            'collaboration_accepted',
            'collaboration_rejected',
            'feedback_response',
            'team_joined',
            'profile_updated'
        ],
        required: [true, "Activity type is required"]
    },
    message: {
        type: String,
        required: [true, "Activity message is required"]
    },
    entityId: {
        type: mongoose_1.Schema.Types.ObjectId,
        refPath: 'entityType'
    },
    entityType: {
        type: String,
        enum: ['GeneratedProject', 'CollaborationRequest', 'Feedback', 'User', null]
    },
    entityName: {
        type: String
    },
    read: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});
// Add indexes for faster queries
activitySchema.index({ userId: 1, createdAt: -1 });
activitySchema.index({ read: 1 });
activitySchema.index({ type: 1 });
const Activity = mongoose_1.default.model("Activity", activitySchema);
exports.default = Activity;
