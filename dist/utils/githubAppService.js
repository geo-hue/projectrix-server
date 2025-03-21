"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGitHubAppOctokit = getGitHubAppOctokit;
exports.createOrgRepositoryWithApp = createOrgRepositoryWithApp;
exports.addCollaboratorToOrgRepo = addCollaboratorToOrgRepo;
exports.createOrUpdateFile = createOrUpdateFile;
const rest_1 = require("@octokit/rest");
const auth_app_1 = require("@octokit/auth-app");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// GitHub App configuration
const GITHUB_APP_ID = process.env.GITHUB_APP_ID;
const GITHUB_APP_INSTALLATION_ID = process.env.GITHUB_APP_INSTALLATION_ID;
const GITHUB_APP_PRIVATE_KEY = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, '\n');
const GITHUB_ORG_NAME = process.env.GITHUB_ORG_NAME || 'projectrix-org';
// Log configuration for debugging 
console.log(`GitHub App Configuration:
- App ID: ${GITHUB_APP_ID ? 'Set' : 'Not set'}
- Installation ID: ${GITHUB_APP_INSTALLATION_ID ? 'Set' : 'Not set'}
- Private Key: ${GITHUB_APP_PRIVATE_KEY ? 'Set' : 'Not set'} 
- Organization: ${GITHUB_ORG_NAME}
`);
/**
 * Get an authenticated Octokit instance for the GitHub App
 */
async function getGitHubAppOctokit() {
    try {
        if (!GITHUB_APP_ID || !GITHUB_APP_PRIVATE_KEY || !GITHUB_APP_INSTALLATION_ID) {
            console.warn('GitHub App not properly configured. Missing required environment variables.');
            return null;
        }
        // Create an Octokit instance with app authentication
        const octokit = new rest_1.Octokit({
            authStrategy: auth_app_1.createAppAuth,
            auth: {
                appId: GITHUB_APP_ID,
                privateKey: GITHUB_APP_PRIVATE_KEY,
                installationId: GITHUB_APP_INSTALLATION_ID
            }
        });
        return octokit;
    }
    catch (error) {
        console.error('Error getting GitHub App Octokit:', error);
        return null;
    }
}
/**
 * Create a repository under the organization using GitHub App
 */
async function createOrgRepositoryWithApp(repoName, description, isPrivate = false) {
    try {
        const octokit = await getGitHubAppOctokit();
        if (!octokit) {
            throw new Error('GitHub App not configured properly');
        }
        // Check if repo already exists
        try {
            const { data: existingRepo } = await octokit.repos.get({
                owner: GITHUB_ORG_NAME,
                repo: repoName,
            });
            return {
                owner: GITHUB_ORG_NAME,
                name: repoName,
                html_url: existingRepo.html_url,
                exists: true
            };
        }
        catch (error) {
            // Repo doesn't exist, continue with creation
        }
        // Create repository in organization
        const { data: repo } = await octokit.repos.createInOrg({
            org: GITHUB_ORG_NAME,
            name: repoName,
            description: description,
            private: isPrivate,
            has_issues: true,
            has_projects: true,
            has_wiki: true,
        });
        return {
            owner: GITHUB_ORG_NAME,
            name: repoName,
            html_url: repo.html_url,
            exists: false
        };
    }
    catch (error) {
        console.error('Error creating repository with GitHub App:', error);
        throw error;
    }
}
/**
 * Add a collaborator to an organization repository
 */
async function addCollaboratorToOrgRepo(repoName, username, permission = 'push') {
    try {
        const octokit = await getGitHubAppOctokit();
        if (!octokit) {
            throw new Error('GitHub App not configured properly');
        }
        await octokit.repos.addCollaborator({
            owner: GITHUB_ORG_NAME,
            repo: repoName,
            username,
            permission
        });
        return true;
    }
    catch (error) {
        console.error(`Error adding collaborator ${username} to repository:`, error);
        return false;
    }
}
/**
 * Create or update a file in an organization repository
 */
async function createOrUpdateFile(repoName, path, content, message) {
    try {
        const octokit = await getGitHubAppOctokit();
        if (!octokit) {
            throw new Error('GitHub App not configured properly');
        }
        // Check if file exists
        let sha;
        try {
            const { data } = await octokit.repos.getContent({
                owner: GITHUB_ORG_NAME,
                repo: repoName,
                path
            });
            if ('sha' in data) {
                sha = data.sha;
            }
        }
        catch (error) {
            // File doesn't exist, will create it
        }
        // Create or update the file
        await octokit.repos.createOrUpdateFileContents({
            owner: GITHUB_ORG_NAME,
            repo: repoName,
            path,
            message,
            content: Buffer.from(content).toString('base64'),
            sha, // Include only if updating an existing file
            committer: {
                name: 'Projectrix Bot',
                email: process.env.GITHUB_BOT_EMAIL || 'bot@projectrix.com'
            }
        });
        return true;
    }
    catch (error) {
        console.error(`Error creating/updating file ${path} in repository:`, error);
        return false;
    }
}
