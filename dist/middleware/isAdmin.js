"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAdmin = void 0;
const ErrorHandler_1 = __importDefault(require("../utils/ErrorHandler"));
const isAdmin = (req, res, next) => {
    // Check if user exists and has admin role
    if (!req.user || req.user.role !== 'admin') {
        return next(new ErrorHandler_1.default('Access denied. Admin privileges required.', 403));
    }
    next();
};
exports.isAdmin = isAdmin;
