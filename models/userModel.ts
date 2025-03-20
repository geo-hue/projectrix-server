import mongoose, { Document, Model, Schema } from "mongoose";

interface IStartedProject {
  projectId: Schema.Types.ObjectId;
  startedAt: Date;
  status: 'in-progress' | 'completed' | 'abandoned';
}

interface ICollaboration {
  projectId: Schema.Types.ObjectId;
  role: string;
  joinedAt: Date;
}

export interface IUser extends Document {
  name: string;
  email: string;
  avatar: string;
  githubId: string;
  role: string;
  username: string;
  githubUsername?: string;
  bio?: string;
  skills: string[];
  projectsGenerated: number;
  projectsCollaborated: number;
  publishedProjectsCount: number; 
  isAvailable: boolean;
  createdAt: Date;
  plan: string;
  projectIdeasLeft: number;
  collaborationRequestsLeft: number; 
  planExpiryDate?: Date;
  startedProjects: IStartedProject[];
  collaborations: ICollaboration[];
  discordId?: string;
  discordUsername?: string;
  newsletterSubscribed: boolean; 
  emailVerified: boolean; 
  lastEmailSent?: Date; 
  enhancementsLeft: number;
  nextLimitResetDate?: Date; // New field for user-specific limit resets
  lastLimitResetDate?: Date; // New field to track when limits were last reset
  comparePassword(password: string): Promise<boolean>;
  SignAccessToken(): string;
  SignRefreshToken(): string;
}

const userSchema: Schema<IUser> = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please enter your name"],
  },
  email: {
    type: String,
    required: [true, "Please enter your email"],
    unique: true,
    validate: {
      validator: function(email: string) {
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
      type: Schema.Types.ObjectId,
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
      type: Schema.Types.ObjectId,
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
    default: function() {
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
userSchema.pre('save', function(next) {
  // Only run this if plan is being modified
  if (this.isModified('plan')) {
    // Reset user limits based on new plan
    if (this.plan === 'pro') {
      this.projectIdeasLeft = 10;
      this.collaborationRequestsLeft = 999999; // Effectively unlimited
      this.enhancementsLeft = 8;
    } else if (this.plan === 'free') {
      // If downgrading from pro to free, set reasonable limits
      this.projectIdeasLeft = Math.min(this.projectIdeasLeft, 3);
      this.collaborationRequestsLeft = Math.min(this.collaborationRequestsLeft, 3);
      this.enhancementsLeft = Math.min(this.enhancementsLeft, 2);
    }
  }
  
  next();
});

const User: Model<IUser> = mongoose.model("User", userSchema);

export default User;