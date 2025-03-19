import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import dotenv from 'dotenv';

dotenv.config();

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
export async function getGitHubAppOctokit(): Promise<any> {
  try {
    if (!GITHUB_APP_ID || !GITHUB_APP_PRIVATE_KEY || !GITHUB_APP_INSTALLATION_ID) {
      console.warn('GitHub App not properly configured. Missing required environment variables.');
      return null;
    }

    // Create an Octokit instance with app authentication
    const octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: GITHUB_APP_ID,
        privateKey: GITHUB_APP_PRIVATE_KEY,
        installationId: GITHUB_APP_INSTALLATION_ID
      }
    });
    
    return octokit;
  } catch (error) {
    console.error('Error getting GitHub App Octokit:', error);
    return null;
  }
}

/**
 * Create a repository under the organization using GitHub App
 */
export async function createOrgRepositoryWithApp(
  repoName: string,
  description: string,
  isPrivate: boolean = false
): Promise<any> {
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
    } catch (error) {
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
  } catch (error) {
    console.error('Error creating repository with GitHub App:', error);
    throw error;
  }
}

/**
 * Add a collaborator to an organization repository
 */
export async function addCollaboratorToOrgRepo(
  repoName: string,
  username: string,
  permission: 'admin' | 'push' | 'pull' = 'push'
): Promise<boolean> {
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
  } catch (error) {
    console.error(`Error adding collaborator ${username} to repository:`, error);
    return false;
  }
}

/**
 * Create or update a file in an organization repository
 */
export async function createOrUpdateFile(
  repoName: string,
  path: string,
  content: string,
  message: string
): Promise<boolean> {
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
    } catch (error) {
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
  } catch (error) {
    console.error(`Error creating/updating file ${path} in repository:`, error);
    return false;
  }
}