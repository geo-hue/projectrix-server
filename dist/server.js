"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const db_1 = __importDefault(require("./utils/db"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const fbauth_1 = require("./utils/fbauth");
const userModel_1 = __importDefault(require("./models/userModel"));
const cronJobs_1 = require("./utils/cronJobs");
require("dotenv").config();
// Create HTTP server
const server = http_1.default.createServer(app_1.app);
// Initialize Socket.io with CORS settings
const io = new socket_io_1.Server(server, {
    cors: {
        origin: process.env.ORIGIN || 'http://localhost:3000',
        methods: ['GET', 'POST', 'OPTIONS'],
        credentials: true
    }
});
global.io = io;
// Socket.io middleware for authentication
io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication error: Token not provided'));
        }
        // Verify token
        const decodedToken = await (0, fbauth_1.verifyFirebaseToken)(token);
        const userId = decodedToken.uid;
        // Find user
        const user = await userModel_1.default.findOne({ githubId: userId });
        if (!user) {
            return next(new Error('Authentication error: User not found'));
        }
        // Attach user to socket
        socket.userId = user._id;
        socket.user = user;
        next();
    }
    catch (error) {
        console.error('Socket authentication error:', error);
        next(new Error('Authentication error: ' + error.message));
    }
});
// Socket.io connection handler
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.userId}`);
    // Join a room with the user's ID to send them private messages
    socket.join(socket.userId.toString());
    // Listen for client events
    socket.on('join_project', (projectId) => {
        socket.join(`project:${projectId}`);
        console.log(`User ${socket.userId} joined project room: ${projectId}`);
    });
    socket.on('leave_project', (projectId) => {
        socket.leave(`project:${projectId}`);
        console.log(`User ${socket.userId} left project room: ${projectId}`);
    });
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.userId}`);
    });
});
// Set up cron jobs for scheduling tasks like monthly limit resets
(0, cronJobs_1.setupCronJobs)();
const startServer = async () => {
    try {
        // Connect to MongoDB
        await (0, db_1.default)();
        // Start server after successful database connection
        const PORT = process.env.PORT || 5000;
        server.listen(PORT, () => {
            console.log(`🚀 Worker ${process.pid} started. Server is connected successfully with port ${PORT}`);
            console.log(`Environment: ${process.env.NODE_ENV}`);
        });
    }
    catch (err) {
        console.error('Failed to connect to database. Server not started.', err);
        process.exit(1);
    }
};
// Start the server
startServer();
