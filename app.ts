// app.ts (Updated with production optimizations)
require('dotenv').config();
import express, { NextFunction, Request, Response } from "express";
export const app = express();
import cors from "cors";
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { ErrorMiddleware } from "./middleware/error";
import { productionErrorHandler, errorLogger } from './middleware/errorHandlerProduction';
import { compressionMiddleware, setPerformanceHeaders, securityHeaders } from './middleware/compression';
import { apiRateLimiter, projectGenerationRateLimiter, authRateLimiter } from './middleware/rateLimiter';
import { setupUncaughtHandlers } from './middleware/errorHandlerProduction';

// Import routes
import userRouter from "./routes/userRoute";
import generateRouter from "./routes/generateRoute";
import userProfileRouter from "./routes/userProfileRoutes";
import collaborationRouter from "./routes/collaborationRoutes";
import publishedProjectsRouter from "./routes/publishedProjectsRoutes";
import feedbackRouter from "./routes/feedbackRoutes";
import discordRouter from "./routes/discordRoutes";
import activityRouter from "./routes/activityRoutes";
import adminUsersRouter from "./routes/adminUsersRoutes";
import analyticsRouter from "./routes/analyticsRoutes";
import paymentRouter from "./routes/paymentRoutes";
import githubRouter from "./routes/githubRoutes";
import emailRouter from "./routes/emailRoutes";

// Set up uncaught exception handler
setupUncaughtHandlers();

// Apply compression middleware early in the stack
app.use(compressionMiddleware);

// Set security headers
app.use(helmet());
app.use(securityHeaders);

// Only log requests in development mode
if (process.env.NODE_ENV === 'development') {
  const { requestLogger } = require('./middleware/requestLogger');
  app.use(requestLogger);
}

// Set up rate limiters for special routes
// For webhooks, no rate limiting
app.post("/api/v1/webhooks/stripe", 
  express.raw({ type: 'application/json' }), 
  (req, res) => {
    const { stripeWebhook } = require('./controller/paymentController');
    stripeWebhook(req, res);
  }
);

app.post("/api/v1/webhook/flutterwave", 
  express.json(),  
  (req, res) => {
    const { flutterwaveWebhook } = require('./controller/paymentController');
    flutterwaveWebhook(req, res);
  }
);

// Body parsing middleware
app.use(express.json({ limit: "50mb" }));
app.use(cookieParser());

// Configure CORS more securely for production
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.ORIGIN || 'https://projectrix.app', 'https://api.projectrix.app']
    : process.env.ORIGIN || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400, // 24 hours cache preflight requests
};
app.use(cors(corsOptions));

// Set performance headers
app.use(setPerformanceHeaders);

// Apply rate limiters to different routes
app.use('/api/v1/auth', authRateLimiter);
app.use('/api/v1/generate', projectGenerationRateLimiter);

// Mount API routes
app.use("/api/v1", userRouter);
app.use("/api/v1", generateRouter);
app.use("/api/v1", userProfileRouter);
app.use("/api/v1", githubRouter);
app.use("/api/v1", collaborationRouter);
app.use("/api/v1", paymentRouter);
app.use("/api/v1", publishedProjectsRouter);
app.use("/api/v1", feedbackRouter);
app.use("/api/v1", discordRouter);
app.use("/api/v1", emailRouter);
app.use("/api/v1", activityRouter);
app.use("/api/v1", analyticsRouter);
app.use("/api/v1", adminUsersRouter);

// Simple health check endpoint
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString()
  });
});

// Handle 404 errors - must be after all valid routes
app.all("*", (req: Request, res: Response, next: NextFunction) => {
  const err = new Error(`Route ${req.originalUrl} not found`) as any;
  err.statusCode = 404;
  next(err);
});

// Error handling middleware chain
app.use(errorLogger);
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  const { handleAIError } = require('./utils/aiErrorHandler');
  handleAIError(err, req, res, next);
});
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  productionErrorHandler(err, req, res, next);
});
app.use(ErrorMiddleware);