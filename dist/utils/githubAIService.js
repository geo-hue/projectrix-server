"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRoleBreakdowns = generateRoleBreakdowns;
const openai_1 = __importDefault(require("openai"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Initialize OpenAI client 
const openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY,
    defaultHeaders: {
        "HTTP-Referer": process.env.FRONTEND_URL || "https://projectrix.vercel.app",
        "X-Title": "Projectrix"
    }
});
/**
 * Generate detailed role breakdowns for a project using AI
 * This creates structured documentation and task lists for each role
 */
async function generateRoleBreakdowns(project) {
    try {
        console.log('Generating role breakdowns for project:', project.title);
        // Extract all roles from the project
        const roles = project.teamStructure?.roles || [];
        if (roles.length === 0) {
            console.warn('No roles found in project for breakdown generation');
            return {};
        }
        const roleBreakdowns = {};
        // Generate breakdown for each role
        for (const role of roles) {
            const roleName = role.title;
            console.log(`Generating breakdown for role: ${roleName}`);
            // Generate comprehensive role document with AI
            const roleDocument = await generateRoleDocument(project, role);
            // Generate specific tasks for this role with AI
            const roleTasks = await generateRoleTasks(project, role);
            roleBreakdowns[roleName] = {
                document: roleDocument,
                tasks: roleTasks
            };
        }
        return roleBreakdowns;
    }
    catch (error) {
        console.error('Error generating role breakdowns:', error);
        throw error;
    }
}
/**
 * Generate a comprehensive document for a specific role using sophisticated AI prompting
 */
async function generateRoleDocument(project, role) {
    try {
        // Construct a detailed prompt that provides full context about the project and role
        const prompt = constructRoleDocumentPrompt(project, role);
        // Make the OpenAI API call 
        const response = await openai.chat.completions.create({
            model: "o3-mini",
            messages: [
                {
                    role: "system",
                    content: "You are an expert software architect and technical writer specializing in creating detailed documentation for software development teams. Your task is to create comprehensive role documents for software projects that help developers understand their responsibilities and how their work fits into the overall project. Do not use LaTeX formatting like \\boxed{} in your responses."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            // temperature: 0.3, // Lower temperature for more consistent, factual output
            max_completion_tokens: 3000 // Allow for detailed document
        });
        // Extract content from response
        let content = response.choices[0].message.content || '';
        // Remove LaTeX \boxed{} formatting if present
        if (content.includes('\\boxed{')) {
            console.log('LaTeX formatting detected in document, cleaning response...');
            content = content.replace('\\boxed{', '');
            // Remove closing brace if it exists at the end
            if (content.trim().endsWith('}')) {
                content = content.trim().slice(0, -1);
            }
        }
        // Remove any other LaTeX artifacts
        content = content.replace(/\\begin\{.*?\}|\\end\{.*?\}/g, '');
        return content;
    }
    catch (error) {
        console.error(`Error generating role document for ${role.title}:`, error);
        // Provide a fallback document if AI generation fails
        return generateFallbackRoleDocument(project, role);
    }
}
/**
 * Generate specific, actionable tasks for a role using sophisticated AI prompting
 */
async function generateRoleTasks(project, role) {
    try {
        // Construct a detailed prompt focused on generating actionable tasks
        const prompt = constructRoleTasksPrompt(project, role);
        // Make the OpenAI API call
        const response = await openai.chat.completions.create({
            model: "o3-mini",
            messages: [
                {
                    role: "system",
                    content: "You are an expert software project manager with deep technical knowledge across various technologies. Your task is to break down development roles into specific, actionable tasks that can be directly implemented as GitHub issues. Provide responses in clean JSON format. DO NOT use any LaTeX formatting such as \\boxed{} in your response."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            // temperature: 0.2, // Lower temperature for more consistent, practical output
            max_completion_tokens: 2000, // Allow for detailed tasks
            response_format: { type: "json_object" } // Request JSON response
        });
        // Extract content from response
        let content = response.choices[0].message.content || '{"tasks": []}';
        // Clean LaTeX formatting more aggressively
        content = cleanResponseContent(content);
        try {
            // First, try direct parsing
            const parsedResponse = JSON.parse(content);
            return Array.isArray(parsedResponse.tasks) ? parsedResponse.tasks : [];
        }
        catch (parseError) {
            console.error('Error parsing JSON response:', parseError);
            // Try extracting JSON with a regular expression
            const jsonMatch = content.match(/(\{[\s\S]*\})/);
            if (jsonMatch && jsonMatch[1]) {
                try {
                    const extractedJson = jsonMatch[1];
                    // Clean the extracted JSON further
                    const cleanedJson = cleanResponseContent(extractedJson);
                    const parsedResponse = JSON.parse(cleanedJson);
                    return Array.isArray(parsedResponse.tasks) ? parsedResponse.tasks : [];
                }
                catch (secondError) {
                    console.error('Second attempt to parse JSON failed:', secondError);
                }
            }
            // If everything fails, return fallback tasks
            return generateFallbackRoleTasks(project, role);
        }
    }
    catch (error) {
        console.error(`Error generating role tasks for ${role.title}:`, error);
        // Provide fallback tasks if AI generation fails
        return generateFallbackRoleTasks(project, role);
    }
}
/**
 * Clean response content from LaTeX formatting and other non-JSON elements
 */
function cleanResponseContent(content) {
    // Step 1: Remove LaTeX \boxed formatting
    if (content.includes('\\boxed{')) {
        console.log('LaTeX \\boxed formatting detected, cleaning...');
        // Remove opening \boxed{
        content = content.replace(/\\boxed\{/g, '');
        // Count opening and closing braces to find the matching closing brace
        let braceCount = 0;
        let cleanedContent = '';
        let inBoxed = false;
        for (let i = 0; i < content.length; i++) {
            const char = content[i];
            if (char === '{') {
                braceCount++;
                cleanedContent += char;
            }
            else if (char === '}') {
                braceCount--;
                // Skip the closing brace of the \boxed command when braceCount becomes negative
                if (braceCount >= 0) {
                    cleanedContent += char;
                }
                else {
                    inBoxed = true; // We've found the closing brace of \boxed
                }
            }
            else {
                cleanedContent += char;
            }
        }
        content = inBoxed ? cleanedContent : content;
    }
    // Step 2: Remove any other LaTeX commands or environments
    content = content.replace(/\\begin\{.*?\}|\\end\{.*?\}/g, '');
    content = content.replace(/\\[a-zA-Z]+(\{.*?\})?/g, ''); // Remove other LaTeX commands
    // Step 3: Fix common JSON formatting issues
    content = content.replace(/\,(\s*[\}\]])/g, '$1'); // Remove trailing commas
    // Step 4: Handle any escaped quotes or newlines that might break JSON
    content = content.replace(/\\"/g, '"'); // Replace escaped quotes
    content = content.replace(/\\n/g, ' '); // Replace newlines with spaces
    return content;
}
/**
 * Construct a sophisticated prompt for generating a role document
 * This prompt provides comprehensive context about the project and the specific role
 */
function constructRoleDocumentPrompt(project, role) {
    return `
# Project Context
Project Name: ${project.title}
Project Description: ${project.description}
Technologies: ${project.technologies.join(', ')}
Complexity Level: ${project.complexity.level} (${project.complexity.percentage}%)
Estimated Duration: ${project.duration.estimate}
Team Size: ${project.teamSize.count}

# Role Information
Role Title: ${role.title}
Required Skills: ${role.skills.join(', ')}
Core Responsibilities: ${role.responsibilities.join(', ')}

# Project Features
Core Features:
${project.features.core.map((feature) => `- ${feature}`).join('\n')}

Additional Features:
${project.features.additional.map((feature) => `- ${feature}`).join('\n')}

# Other Team Roles
${project.teamStructure.roles
        .filter((r) => r.title !== role.title)
        .map((r) => `- ${r.title}: ${r.responsibilities[0]}`)
        .join('\n')}

# Document Request
Please create a comprehensive role document for the ${role.title} role in this project. The document should include:

1. **Role Overview**: A detailed description of this role's purpose within the project.

2. **Key Responsibilities**: Expanded explanation of each responsibility, with practical examples.

3. **Technical Requirements**: Specific technical skills and knowledge required, with explanation of how they apply to this project.

4. **Deliverables**: Concrete outputs this role is expected to produce.

5. **Integration Points**: How this role interfaces with other roles (data exchange, API contracts, communication).

6. **Development Workflow**: Recommended development practices for this role (branching strategy, code review process, testing approach).

7. **Technical Decisions**: Key architectural or technical decisions this role should make or contribute to.

8. **Learning Resources**: Recommended resources (documentation, tutorials, examples) relevant to this role's responsibilities.

Format the document in Markdown with clear section headers, code examples where relevant, and practical guidance.
`;
}
/**
 * Construct a sophisticated prompt for generating actionable tasks for a role
 * This prompt focuses on concrete, implementation-specific tasks
 */
function constructRoleTasksPrompt(project, role) {
    return `
# Project Context
Project Name: ${project.title}
Project Description: ${project.description}
Technologies: ${project.technologies.join(', ')}
Complexity Level: ${project.complexity.level} (${project.complexity.percentage}%)
Estimated Duration: ${project.duration.estimate}
Team Size: ${project.teamSize.count}

# Role Information
Role Title: ${role.title}
Required Skills: ${role.skills.join(', ')}
Core Responsibilities: ${role.responsibilities.join(', ')}

# Project Features
Core Features:
${project.features.core.map((feature) => `- ${feature}`).join('\n')}

Additional Features:
${project.features.additional.map((feature) => `- ${feature}`).join('\n')}

# Task Generation Request
Please analyze this project and the ${role.title} role to generate a list of 5-10 specific, actionable tasks that would be implemented as GitHub issues. For each task:

1. Identify a concrete piece of work that directly contributes to project completion
2. Ensure the task is scoped appropriately (not too broad or too narrow)
3. Consider dependencies between tasks and with other roles
4. Focus on early architectural decisions and foundational work first

Provide your response as a JSON object with the following structure:
{
  "tasks": [
    {
      "title": "Short, descriptive task title",
      "description": "Detailed description including acceptance criteria and implementation guidance",
      "priority": "high/medium/low",
      "estimated_hours": number,
      "dependencies": ["List any prerequisite tasks or dependencies on other roles"]
    }
  ]
}

Each task description should provide enough detail that a developer could immediately start work, including specific technical guidance relevant to the project technologies.
`;
}
/**
 * Generate a fallback role document if AI generation fails
 */
function generateFallbackRoleDocument(project, role) {
    return `# ${role.title} Role Document

## Role Overview
As the ${role.title} for ${project.title}, you are responsible for ${role.responsibilities[0]}.

## Key Responsibilities
${role.responsibilities.map((resp) => `- ${resp}`).join('\n')}

## Technical Requirements
Required skills:
${role.skills.map((skill) => `- ${skill}`).join('\n')}

## Deliverables
Your key deliverables will be determined by the project requirements and features.

## Integration Points
Coordinate with other team members as needed for project completion.

## Development Workflow
Follow standard development practices including:
- Create feature branches from main
- Submit pull requests for review
- Write tests for your code
- Document your work

## Technical Decisions
Make appropriate technical decisions based on the project requirements and your expertise.

## Learning Resources
Refer to the official documentation for the technologies used in this project.
`;
}
/**
 * Generate fallback tasks if AI generation fails
 */
function generateFallbackRoleTasks(project, role) {
    const defaultTasks = [
        {
            title: `Initial ${role.title} setup`,
            description: `Set up the development environment and tools needed for the ${role.title} role. This includes installing necessary software, configuring development tools, and familiarizing yourself with the project architecture.`,
            priority: 'high',
            estimated_hours: 4,
            dependencies: []
        },
        {
            title: `Create ${role.title} architecture document`,
            description: `Document the architecture and approach for implementing the ${role.title} responsibilities. Include diagrams, technology choices, and integration points with other components.`,
            priority: 'high',
            estimated_hours: 6,
            dependencies: []
        },
        {
            title: `Implement core functionality for ${role.title}`,
            description: `Implement the core functionality required for the ${role.title} role, based on the project features and requirements.`,
            priority: 'high',
            estimated_hours: 16,
            dependencies: [`Initial ${role.title} setup`]
        }
    ];
    return defaultTasks;
}
