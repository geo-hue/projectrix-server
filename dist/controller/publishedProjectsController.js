"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAvailableRoles = exports.getAvailableTechnologies = exports.getPublishedProject = exports.getPublishedProjects = void 0;
const catchAsyncErrors_1 = require("../middleware/catchAsyncErrors");
const ErrorHandler_1 = __importDefault(require("../utils/ErrorHandler"));
const generateProject_model_1 = __importDefault(require("../models/generateProject.model"));
const userModel_1 = __importDefault(require("../models/userModel"));
// Get all published projects with optional filtering and pagination
exports.getPublishedProjects = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { technology, complexity, role, page = 1, limit = 12 } = req.query;
        // Convert page and limit to numbers
        const pageNumber = parseInt(page, 10);
        const limitNumber = parseInt(limit, 10);
        // Calculate skip for pagination
        const skip = (pageNumber - 1) * limitNumber;
        // Base query
        const query = { isPublished: true };
        // Apply filters if provided
        if (technology) {
            query.technologies = { $in: [technology] };
        }
        if (complexity) {
            query['complexity.level'] = complexity;
        }
        if (role) {
            // Find projects that have the specified role that is not filled
            query['teamStructure.roles'] = {
                $elemMatch: { title: role, filled: false }
            };
        }
        // Get total count for pagination
        const totalCount = await generateProject_model_1.default.countDocuments(query);
        // Fetch projects with populated publisher info, with pagination
        const projects = await generateProject_model_1.default.find(query)
            .populate({
            path: 'userId',
            select: 'name username avatar email',
            model: userModel_1.default
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNumber);
        // Format response to include publisher info
        const formattedProjects = projects.map(project => {
            const { userId, ...projectData } = project.toObject();
            return {
                ...projectData,
                publisher: userId
            };
        });
        res.status(200).json({
            success: true,
            count: formattedProjects.length,
            totalCount,
            totalPages: Math.ceil(totalCount / limitNumber),
            currentPage: pageNumber,
            projects: formattedProjects
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
// Get a single published project by ID
exports.getPublishedProject = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { id } = req.params;
        const project = await generateProject_model_1.default.findOne({ _id: id, isPublished: true })
            .populate({
            path: 'userId',
            select: 'name username avatar email',
            model: userModel_1.default
        })
            .populate({
            path: 'teamMembers.userId',
            select: 'name username avatar email',
            model: userModel_1.default
        });
        if (!project) {
            return next(new ErrorHandler_1.default("Project not found or not published", 404));
        }
        // Format response to include publisher info
        const { userId, ...projectData } = project.toObject();
        const formattedProject = {
            ...projectData,
            publisher: userId
        };
        res.status(200).json({
            success: true,
            project: formattedProject
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
// Get all available technologies from published projects
exports.getAvailableTechnologies = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const projects = await generateProject_model_1.default.find({ isPublished: true });
        const technologies = new Set();
        projects.forEach(project => {
            project.technologies.forEach(tech => technologies.add(tech));
        });
        res.status(200).json({
            success: true,
            technologies: Array.from(technologies)
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
// Get all available roles from published projects
exports.getAvailableRoles = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const projects = await generateProject_model_1.default.find({ isPublished: true });
        const roles = new Set();
        projects.forEach(project => {
            project.teamStructure.roles.forEach(role => {
                if (!role.filled) {
                    roles.add(role.title);
                }
            });
        });
        res.status(200).json({
            success: true,
            roles: Array.from(roles)
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
