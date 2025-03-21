"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemMetrics = exports.RevenueMetrics = exports.ProjectMetrics = exports.UserMetrics = exports.DailyAnalytics = void 0;
// models/analytics.model.ts
const mongoose_1 = __importDefault(require("mongoose"));
const dailyAnalyticsSchema = new mongoose_1.default.Schema({
    date: {
        type: Date,
        required: true,
        unique: true
    },
    newUsers: {
        type: Number,
        default: 0
    },
    activeUsers: {
        type: Number,
        default: 0
    },
    projectsGenerated: {
        type: Number,
        default: 0
    },
    projectsPublished: {
        type: Number,
        default: 0
    },
    collaborationRequests: {
        type: Number,
        default: 0
    },
    acceptedCollaborations: {
        type: Number,
        default: 0
    },
    feedbackSubmitted: {
        type: Number,
        default: 0
    },
    proSubscriptions: {
        type: Number,
        default: 0
    },
    revenue: {
        type: Number,
        default: 0
    },
    avgGenerationTime: {
        type: Number,
        default: 0
    }
});
// Add index for faster date-based queries
dailyAnalyticsSchema.index({ date: -1 });
const userMetricsSchema = new mongoose_1.default.Schema({
    timestamp: {
        type: Date,
        required: true,
        default: Date.now
    },
    totalUsers: {
        type: Number,
        default: 0
    },
    activeUsers: {
        daily: {
            type: Number,
            default: 0
        },
        weekly: {
            type: Number,
            default: 0
        },
        monthly: {
            type: Number,
            default: 0
        }
    },
    proUsers: {
        type: Number,
        default: 0
    },
    freeUsers: {
        type: Number,
        default: 0
    },
    usersByTech: {
        type: Map,
        of: Number,
        default: {}
    },
    usersByRole: {
        type: Map,
        of: Number,
        default: {}
    },
    userRetention: {
        day7: {
            type: Number,
            default: 0
        },
        day30: {
            type: Number,
            default: 0
        },
        day90: {
            type: Number,
            default: 0
        }
    }
});
const projectMetricsSchema = new mongoose_1.default.Schema({
    timestamp: {
        type: Date,
        required: true,
        default: Date.now
    },
    totalProjects: {
        type: Number,
        default: 0
    },
    publishedProjects: {
        type: Number,
        default: 0
    },
    projectsByCategory: {
        type: Map,
        of: Number,
        default: {}
    },
    projectsByTech: {
        type: Map,
        of: Number,
        default: {}
    },
    avgProjectComplexity: {
        type: Number,
        default: 0
    },
    avgTeamSize: {
        type: Number,
        default: 0
    },
    popularTechnologies: [
        {
            tech: String,
            count: Number
        }
    ]
});
const revenueMetricsSchema = new mongoose_1.default.Schema({
    timestamp: {
        type: Date,
        required: true,
        default: Date.now
    },
    totalRevenue: {
        type: Number,
        default: 0
    },
    monthlyRevenue: {
        type: Number,
        default: 0
    },
    subscriberGrowthRate: {
        type: Number,
        default: 0
    },
    churnRate: {
        type: Number,
        default: 0
    },
    avgRevenuePerUser: {
        type: Number,
        default: 0
    },
    projectedMonthlyRevenue: {
        type: Number,
        default: 0
    },
    revenueByCountry: {
        type: Map,
        of: Number,
        default: {}
    }
});
const systemMetricsSchema = new mongoose_1.default.Schema({
    timestamp: {
        type: Date,
        required: true,
        default: Date.now
    },
    apiResponseTimes: {
        avg: {
            type: Number,
            default: 0
        },
        p95: {
            type: Number,
            default: 0
        },
        p99: {
            type: Number,
            default: 0
        }
    },
    errorRates: {
        total: {
            type: Number,
            default: 0
        },
        byEndpoint: {
            type: Map,
            of: Number,
            default: {}
        }
    },
    serverLoad: {
        cpu: {
            type: Number,
            default: 0
        },
        memory: {
            type: Number,
            default: 0
        },
        diskUsage: {
            type: Number,
            default: 0
        }
    },
    aiGenerationMetrics: {
        avgResponseTime: {
            type: Number,
            default: 0
        },
        successRate: {
            type: Number,
            default: 0
        },
        errorRate: {
            type: Number,
            default: 0
        },
        tokensUsed: {
            type: Number,
            default: 0
        }
    }
});
// Create models
const DailyAnalytics = mongoose_1.default.model("DailyAnalytics", dailyAnalyticsSchema);
exports.DailyAnalytics = DailyAnalytics;
const UserMetrics = mongoose_1.default.model("UserMetrics", userMetricsSchema);
exports.UserMetrics = UserMetrics;
const ProjectMetrics = mongoose_1.default.model("ProjectMetrics", projectMetricsSchema);
exports.ProjectMetrics = ProjectMetrics;
const RevenueMetrics = mongoose_1.default.model("RevenueMetrics", revenueMetricsSchema);
exports.RevenueMetrics = RevenueMetrics;
const SystemMetrics = mongoose_1.default.model("SystemMetrics", systemMetricsSchema);
exports.SystemMetrics = SystemMetrics;
