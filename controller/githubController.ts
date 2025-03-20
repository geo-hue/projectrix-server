import { Request, Response, NextFunction } from 'express';
import { CatchAsyncError } from '../middleware/catchAsyncErrors';
import ErrorHandler from '../utils/ErrorHandler';
import GeneratedProject from '../models/generateProject.model';
import User from '../models/userModel';
import { redis } from '../utils/redis';
import axios from 'axios';
import dotenv from 'dotenv';
import { getGitHubServiceForUser } from '../utils/githubService';
import { Octokit } from '@octokit/rest';

dotenv.config();
const USE_ORGANIZATION = process.env.USE_GITHUB_ORG === 'true';
const USE_GITHUB_APP = process.env.USE_GITHUB_APP === 'true';
const GITHUB_ORG_NAME = process.env.GITHUB_ORG_NAME || 'projectrix-org';

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI || 'http://localhost:5000/api/v1/github/callback';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

/**
 * Initiate GitHub OAuth flow for repository creation permissions
 */
export const initiateGitHubAuth = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next(new ErrorHandler("Authentication required", 401));
    }
    
    const { projectId } = req.query;
    
    if (!projectId) {
      return next(new ErrorHandler("Project ID is required", 400));
    }
    
    // Store project ID in session/redis for retrieval after OAuth
    await redis.set(`github:auth:${req.user._id}`, projectId.toString(), 'EX', 3600); // Expires in 1 hour
    
    // Redirect to GitHub OAuth
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${GITHUB_REDIRECT_URI}&scope=repo&state=${req.user._id}`;
    
    res.status(200).json({
      success: true,
      redirectUrl: githubAuthUrl
    });
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});

/**
 * Handle GitHub OAuth callback and token exchange
 */
export const handleGitHubCallback = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, state } = req.query;
    
    if (!code || !state) {
      return next(new ErrorHandler("Invalid GitHub callback parameters", 400));
    }
    
    // Exchange code for access token
    const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: GITHUB_REDIRECT_URI
    }, {
      headers: {
        Accept: 'application/json'
      }
    });
    
    const accessToken = tokenResponse.data.access_token;
    
    if (!accessToken) {
      return next(new ErrorHandler("Failed to get GitHub access token", 500));
    }
    
    // Get user info from GitHub
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `token ${accessToken}`
      }
    });
    
    const githubUser = userResponse.data;
    
    // Retrieve project ID from Redis
    const userId = state;
    const projectId = await redis.get(`github:auth:${userId}`);
    
    if (!projectId) {
      return next(new ErrorHandler("Project ID not found or expired", 404));
    }
    
    // Store GitHub token in Redis
    await redis.set(`github:token:${userId}`, accessToken, 'EX', 3600 * 24 * 7); // 1 week expiry
    
    // Redirect back to frontend
    res.redirect(`${FRONTEND_URL}/projects/${projectId}?github=success`);
  } catch (error: any) {
    console.error('GitHub callback error:', error);
    res.redirect(`${FRONTEND_URL}/projects/${req.query.state}?github=error`);
  }
});

/**
 * Create a GitHub repository for a project
 */
export const createGitHubRepository = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next(new ErrorHandler("Authentication required", 401));
    }
    
    const { projectId } = req.params;
    const { useOrganization: userPreference, isPrivate } = req.body;
    
    // Verify project belongs to user
    const project = await GeneratedProject.findOne({ _id: projectId, userId: req.user._id });
    
    if (!project) {
      return next(new ErrorHandler("Project not found or you don't have permission", 404));
    }
    
    // Always create public repositories
    const usePrivate = false; 
    
    // Determine if we should use organization
    // If GitHub App is enabled, we'll attempt to use it first
    const useOrganization = USE_ORGANIZATION;
    
    // Log our configuration for debugging
    console.log('GitHub repository creation configuration:');
    console.log(`- Organization enabled: ${USE_ORGANIZATION}`);
    console.log(`- GitHub App enabled: ${USE_GITHUB_APP}`);
    console.log(`- Organization name: ${GITHUB_ORG_NAME}`);
    
    if (USE_GITHUB_APP && USE_ORGANIZATION) {
      // Get GitHub service for user (still needed for personal account fallback)
      const githubService = await getGitHubServiceForUser(req.user._id.toString());
      
      if (!githubService) {
        // User hasn't authorized GitHub yet
        return res.status(200).json({
          success: false,
          requiresAuth: true,
          message: "GitHub authorization required"
        });
      }
      
      // Create repository using GitHub App
      try {
        // Create repository
        const repository = await githubService.createRepository(
          project, 
          req.user, 
          useOrganization, 
          usePrivate
        );
        
        // Add team members as collaborators if project has team members
        if (project.teamMembers && project.teamMembers.length > 0) {
          await githubService.addCollaborators(repository.owner, repository.name, project.teamMembers);
        }
        
        // Update project with GitHub info
        project.githubInfo = {
          repoOwner: repository.owner,
          repoName: repository.name,
          repoUrl: repository.html_url,
          createdAt: new Date()
        };
        
        await project.save();
        
        return res.status(repository.exists ? 200 : 201).json({
          success: true,
          repository,
          message: repository.exists 
            ? "Repository already exists" 
            : "GitHub repository created successfully"
        });
      } catch (error:any) {
        console.error('Error creating GitHub repository:', error);
        return next(new ErrorHandler(error.message || "Failed to create GitHub repository", 500));
      }
    } else {
      // Fall back to the original implementation
      // Get GitHub service for user
      const githubService = await getGitHubServiceForUser(req.user._id.toString());
      
      if (!githubService) {
        // User hasn't authorized GitHub yet
        return res.status(200).json({
          success: false,
          requiresAuth: true,
          message: "GitHub authorization required"
        });
      }
      
      // Determine if we should use the organization
      // This prioritizes the environment variable setting
      const useOrganization = USE_ORGANIZATION && userPreference;
      
      try {
        // Create repository
        const repository = await githubService.createRepository(
          project, 
          req.user, 
          useOrganization, 
          usePrivate
        );
        
        // Add team members as collaborators if project has team members
        if (project.teamMembers && project.teamMembers.length > 0) {
          await githubService.addCollaborators(repository.owner, repository.name, project.teamMembers);
        }
        
        // Update project with GitHub info
        project.githubInfo = {
          repoOwner: repository.owner,
          repoName: repository.name,
          repoUrl: repository.html_url,
          createdAt: new Date()
        };
        
        await project.save();
        
        return res.status(repository.exists ? 200 : 201).json({
          success: true,
          repository,
          message: repository.exists 
            ? "Repository already exists" 
            : "GitHub repository created successfully"
        });
      } catch (repoError) {
        // If creating with organization fails, try with personal account
        if (useOrganization && typeof repoError === 'object' && repoError !== null && 'message' in repoError && typeof repoError.message === 'string' && repoError.message.includes('OAuth App access restrictions')) {
          console.log('Organization creation failed due to restrictions, trying personal account...');
          
          const repository = await githubService.createRepository(
            project, 
            req.user, 
            false, // Force personal account
            usePrivate
          );
          
          // Update project with GitHub info
          project.githubInfo = {
            repoOwner: repository.owner,
            repoName: repository.name,
            repoUrl: repository.html_url,
            createdAt: new Date()
          };
          
          await project.save();
          
          return res.status(repository.exists ? 200 : 201).json({
            success: true,
            repository,
            message: "GitHub repository created successfully using your personal account"
          });
        } else {
          throw repoError;
        }
      }
    }
  } catch (error: any) {
    console.error('Error creating GitHub repository:', error);
    return next(new ErrorHandler(error.message || "Failed to create GitHub repository", 500));
  }
});

/**
 * Get GitHub repository status for a project
 */
export const getGitHubRepositoryStatus = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next(new ErrorHandler("Authentication required", 401));
      }
      
      const { projectId } = req.params;
      
      // Verify project belongs to user or user is a collaborator
      const project = await GeneratedProject.findById(projectId);
      
      if (!project) {
        return next(new ErrorHandler("Project not found", 404));
      }
      
      // Check if user is owner or collaborator
      const isOwner = project.userId.toString() === req.user._id.toString();
      const isCollaborator = project.teamMembers?.some(
        member => member.userId.toString() === req.user?._id.toString()
      );
      
      if (!isOwner && !isCollaborator) {
        return next(new ErrorHandler("You don't have permission to access this project", 403));
      }
      
      // Check if project has GitHub info
      if (!project.githubInfo || !project.githubInfo.repoUrl) {
        return res.status(200).json({
          success: true,
          hasRepository: false,
          message: "No GitHub repository created for this project"
        });
      }
      
      // Log repository data for debugging
      console.log('Repository info from database:', project.githubInfo);
      
      res.status(200).json({
        success: true,
        hasRepository: true,
        repository: {
          owner: project.githubInfo.repoOwner || "",
          name: project.githubInfo.repoName || "",
          url: project.githubInfo.repoUrl,
          html_url: project.githubInfo.repoUrl,
          exists: true
        }
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  });

/**
 * Check GitHub authorization status
 */
export const checkGitHubAuthStatus = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next(new ErrorHandler("Authentication required", 401));
    }
    
    // Check if user has GitHub token
    const token = await redis.get(`github:token:${req.user._id}`);
    
    res.status(200).json({
      success: true,
      isAuthorized: !!token
    });
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});

/**
 * Revoke GitHub authorization
 */
export const revokeGitHubAuth = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next(new ErrorHandler("Authentication required", 401));
    }
    
    // Get token from Redis
    const token = await redis.get(`github:token:${req.user._id}`);
    
    if (token) {
      // Revoke token via GitHub API
      try {
        if (GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET) {
          await axios.delete(`https://api.github.com/applications/${GITHUB_CLIENT_ID}/grant`, {
            auth: {
              username: GITHUB_CLIENT_ID,
              password: GITHUB_CLIENT_SECRET
            },
            data: {
              access_token: token
            }
          });
        } else {
          console.error('GitHub client credentials not properly configured');
        }
      } catch (revokeError) {
        console.error('Error revoking GitHub token:', revokeError);
        // Continue anyway to remove from Redis
      }
      
      // Remove token from Redis
      await redis.del(`github:token:${req.user._id}`);
    }
    
    res.status(200).json({
      success: true,
      message: "GitHub authorization successfully revoked"
    });
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});

export const getInvitationStatus = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next(new ErrorHandler("Authentication required", 401));
    }
    
    const { projectId } = req.params;
    
    // Find the project
    const project = await GeneratedProject.findById(projectId);
    if (!project || !project.githubInfo) {
      return res.status(200).json({
        success: true,
        status: 'none'
      });
    }
    
    // If project owner is checking, they already have access
    if (project.userId.toString() === req.user._id.toString()) {
      return res.status(200).json({
        success: true,
        status: 'accepted'
      });
    }
    
    // Check if user is a collaborator
    const isCollaborator = project.teamMembers?.some(
      member => member.userId.toString() === req.user?._id.toString()
    );
    
    if (!isCollaborator) {
      return res.status(200).json({
        success: true,
        status: 'none'
      });
    }
    
    // Get GitHub token
    const token = await redis.get(`github:token:${req.user._id}`);
    if (!token) {
      return res.status(200).json({
        success: true,
        status: 'none'
      });
    }
    
    // Assume access is provided automatically for public repos
    return res.status(200).json({
      success: true,
      status: 'accepted'
    });
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});