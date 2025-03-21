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
const generatedProjectSchema = new mongoose_1.Schema({
    title: {
        type: String,
        required: true
    },
    subtitle: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    technologies: [{
            type: String,
            required: true
        }],
    complexity: {
        level: {
            type: String,
            required: true,
            enum: ['beginner', 'intermediate', 'advanced']
        },
        percentage: {
            type: Number,
            required: true,
            min: 0,
            max: 100
        }
    },
    duration: {
        type: {
            type: String,
            required: true,
            enum: ['small', 'medium', 'large']
        },
        estimate: {
            type: String,
            required: true
        }
    },
    teamSize: {
        type: {
            type: String,
            required: true,
            enum: ['solo', 'small', 'medium']
        },
        count: {
            type: String,
            required: true
        }
    },
    category: {
        type: String,
        required: true
    },
    wasEnhanced: {
        type: Boolean,
        default: false
    },
    features: {
        core: [{
                type: String,
                required: true
            }],
        additional: [{
                type: String,
                required: true
            }]
    },
    teamStructure: {
        roles: [{
                title: {
                    type: String,
                    required: true
                },
                skills: [{
                        type: String,
                        required: true
                    }],
                responsibilities: [{
                        type: String,
                        required: true
                    }],
                filled: {
                    type: Boolean,
                    default: false
                }
            }]
    },
    discordChannelId: {
        type: String
    },
    discordInviteLink: {
        type: String
    },
    teamMembers: [{
            userId: {
                type: mongoose_1.Schema.Types.ObjectId,
                ref: 'User'
            },
            role: {
                type: String,
                required: true
            },
            joinedAt: {
                type: Date,
                default: Date.now
            }
        }],
    learningOutcomes: [{
            type: String,
            required: true
        }],
    isSaved: {
        type: Boolean,
        default: false
    },
    isPublished: {
        type: Boolean,
        default: false
    },
    githubInfo: {
        repoOwner: String,
        repoName: String,
        repoUrl: String,
        createdAt: {
            type: Date,
            default: Date.now
        }
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});
const GeneratedProject = mongoose_1.default.model("GeneratedProject", generatedProjectSchema);
exports.default = GeneratedProject;
