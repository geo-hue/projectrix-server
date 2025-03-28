"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.editProject = exports.submitUserProject = exports.publishProject = exports.getUserSavedProjects = exports.startProject = exports.generateAnother = exports.getGeneratedProjects = exports.generateProject = void 0;
const catchAsyncErrors_1 = require("../middleware/catchAsyncErrors");
const ErrorHandler_1 = __importDefault(require("../utils/ErrorHandler"));
const redis_1 = require("../utils/redis");
const openai_1 = __importDefault(require("openai"));
const generateProject_model_1 = __importDefault(require("../models/generateProject.model"));
const userModel_1 = __importDefault(require("../models/userModel"));
const activityUtils_1 = require("../utils/activityUtils");
const pricingUtils_1 = require("../utils/pricingUtils");
const pricingUtils_2 = require("../utils/pricingUtils");
const circuitBreaker_1 = require("../utils/circuitBreaker");
const openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY,
    defaultHeaders: {
        "HTTP-Referer": process.env.FRONTEND_URL || "https://projectrix.vercel.app",
        "X-Title": "Projectrix",
    },
    timeout: 60000, // 60 second timeout
    maxRetries: 2
});
const openaiBreaker = new circuitBreaker_1.CircuitBreaker(3, 60000);
/**
 * Generate an optimized prompt for OpenAI based on user preferences
 */
function getOptimizedPrompt(preferences) {
    // Extract preferences
    const { technologies, complexity, duration, teamSize, exactTeamSize, category, projectTheme, } = preferences;
    // Generate duration text
    const durationText = duration === "small"
        ? "short-term (1-2 weeks)"
        : duration === "medium"
            ? "medium-term (1-2 months)"
            : "long-term (3+ months)";
    // Generate team size text
    let teamSizeText;
    if (teamSize === "solo") {
        teamSizeText = "exactly one developer (solo project)";
    }
    else if (teamSize === "small") {
        teamSizeText = exactTeamSize
            ? `EXACTLY ${exactTeamSize} team members, no more and no less`
            : "2-3 team members";
    }
    else { // medium
        teamSizeText = exactTeamSize
            ? `EXACTLY ${exactTeamSize} team members, no more and no less`
            : "4-6 team members";
    }
    // Format technologies list if provided
    const techList = technologies && technologies.length > 0
        ? `specifically using these technologies: ${technologies.join(", ")}`
        : "using appropriate technologies for this type of project";
    // Add theme context if provided
    const themeContext = projectTheme
        ? `The theme of the project should be related to "${projectTheme}".`
        : "The project should be practical, innovative, and educational.";
    // Generate category-specific guidance
    const categoryGuidance = getCategorySpecificGuidance(category, technologies);
    // Build the main prompt
    return `Generate a detailed, practical, and innovative ${category} project idea for a ${complexity.level} level (${complexity.percentage}% complexity) team of ${teamSizeText}, estimated to take ${durationText} to complete, ${techList}.

${themeContext}

${categoryGuidance}

IMPORTANT CONSTRAINTS:
${exactTeamSize
        ? `1. YOU MUST CREATE EXACTLY ${exactTeamSize} TEAM ROLES - NO MORE, NO LESS. The user has explicitly requested ${exactTeamSize} team members.`
        : `1. If the specified team size is 2-3 members, provide either 2 or 3 team roles, not more and not less.
2. If the specified team size is 4-6 members, provide between 4 and 6 team roles, not more and not less.
3. For solo projects, provide exactly 1 role.`}
4. Do not exceed the maximum number of roles for the specified team size under any circumstance.

${exactTeamSize
        ? `CRITICAL REMINDER: Create EXACTLY ${exactTeamSize} team roles in your response.`
        : ''}


Make sure the project is:
1. Practical and realistic to implement within the given timeframe and team size
2. Educational and helps team members grow their skills
3. Appropriately scoped for the complexity level (${complexity.level})
4. Well-structured with clear responsibilities for each team role
5. Thoroughly explained with implementation details

The response should include:
1. A creative and descriptive project title
2. A concise subtitle that summarizes the project
3. A comprehensive project description (at least 200 words) that clearly explains:
   - The SPECIFIC PROBLEM this project solves 
     * Describe the exact pain point or inefficiency in the current process
     * Quantify the current challenges (e.g., "Users spend X hours doing Y")
   - WHO the primary users are and EXACTLY HOW they benefit 
     * Define the target user demographic
     * Explain their current struggles in detail
     * Highlight the specific improvements your solution provides
   - The REAL-WORLD VALUE and MEASURABLE IMPACT 
     * Provide concrete metrics of improvement
     * Explain how the solution transforms the user's experience
     * Quantify time saved, efficiency gained, or problems solved
   - A CONCRETE, DETAILED USER STORY 
     * Present a vivid, specific scenario showing how a typical user would interact with the project
     * Walk through the user's journey and demonstrate the solution's effectiveness
   - Technical implementation details ONLY AFTER establishing the purpose
     * Explain how the chosen technologies work together
     * Describe the system architecture and data flow
     * Outline key technical challenges and the implementation strategy

4. Core features (must-have functionality)
5. Additional features (nice-to-have extensions)
6. Team structure with ${exactTeamSize ? `EXACTLY ${exactTeamSize}` : 'appropriate number of'} specific roles, required skills for each role, and their responsibilities
7. Learning outcomes for the team members

Format the response in JSON with the following structure EXACTLY:
{
  "title": "Project Title",
  "subtitle": "Brief project summary",
  "description": "Detailed project description...",
  "features": {
    "core": ["Feature 1", "Feature 2", "Feature 3", "Feature 4", "Feature 5"],
    "additional": ["Feature 1", "Feature 2", "Feature 3", "Feature 4", "Feature 5"]
  },
  "teamStructure": {
    "roles": [
      {
        "title": "Role Title",
        "skills": ["Skill 1", "Skill 2", "Skill 3"],
        "responsibilities": ["Responsibility 1", "Responsibility 2", "Responsibility 3"]
      }
      ${exactTeamSize ? `// EXACTLY ${exactTeamSize} roles, no more, no less` : ''}
    ]
  },
  "learningOutcomes": ["Learning Outcome 1", "Learning Outcome 2", "Learning Outcome 3", "Learning Outcome 4", "Learning Outcome 5"]
}

${exactTeamSize ? `FINAL CHECK: Ensure there are EXACTLY ${exactTeamSize} roles in the "teamStructure.roles" array.` : ''}
Ensure the JSON is properly formatted and can be parsed.`;
}
/**
 * Provide category-specific guidance based on project type
 */
function getCategorySpecificGuidance(category, technologies) {
    switch (category) {
        case "web":
            return `For this web application project:
- Consider both frontend and backend components
- Include user authentication and data management features
- Think about UI/UX and responsive design
- Consider deployment and scalability aspects`;
        case "mobile":
            return `For this mobile app project:
- Consider platform-specific features (iOS/Android)
- Include offline functionality where appropriate
- Consider battery and data usage optimization
- Think about intuitive mobile-friendly UI design`;
        case "ai":
            return `For this AI/ML project:
- Specify the AI/ML models or techniques to be used
- Include data collection, processing, and validation steps
- Consider model training, evaluation, and deployment processes
- Think about ethical implications and bias mitigation`;
        case "game":
            return `For this game development project:
- Define game mechanics, characters, and storyline
- Include graphics, sound, and UI elements
- Consider level design and progression
- Think about performance optimization for target platforms`;
        case "data":
            return `For this data science project:
- Include data collection, cleaning, and preprocessing steps
- Specify analysis methods and visualization techniques
- Consider insights generation and reporting
- Think about deployment of interactive dashboards or reports`;
        default:
            return `For this project:
- Define clear scope and objectives
- Include technical requirements and constraints
- Consider user needs and experience
- Think about deployment and maintenance`;
    }
}
/**
 * Improved validation for technology and category combinations
 * This validator is more flexible and user-friendly
 */
function validateTechnologyCategoryPair(technologies, category) {
    // If no technologies are selected, it's always valid
    if (!technologies || technologies.length === 0) {
        return { valid: true, message: "" };
    }
    // Normalize the category
    const categoryLower = category.toLowerCase();
    // Define technology groups specifically matching the frontend TechSelect component values
    // These values are all lowercase, without spaces, as used in your TechSelect component
    const categoryTechGroups = {
        web: [
            // Core frontend technologies from your TechSelect component
            "react", "nextjs", "vue", "angular", "svelte", "html5", "css3", "javascript",
            "typescript", "tailwindcss", "bootstrap", "redux", "webpack", "vite",
            // Backend technologies
            "nodejs", "express", "django", "flask", "php", "laravel", "ruby", "rails",
            "springboot", "dotnet", "csharp", "python", "go", "rust",
            // Databases
            "mongodb", "postgresql", "mysql", "redis", "firebase", "supabase", "sqlite",
            // API and communication
            "rest", "graphql", "apollo", "trpc", "axios", "fetch",
            // Tooling & Deployment
            "docker", "kubernetes", "aws", "azure", "vercel", "netlify", "heroku", "github",
            "gitlab", "jest", "cypress", "storybook",
            // State management
            "redux", "mobx", "zustand", "recoil", "context", "jotai",
            // UI libraries
            "materialui", "chakraui", "mui", "antd", "shadcn", "styledcomponents",
            // CSS related
            "sass", "less", "emotion", "css", "cssmodules", "postcss", "windicss",
            // Frameworks
            "qwik", "remix", "astro", "nuxt", "sveltekit", "gatsby"
        ],
        mobile: [
            // Cross-platform frameworks
            "reactnative", "flutter", "ionic", "xamarin", "nativescript", "capacitor", "cordova",
            // Native languages & frameworks
            "swift", "kotlin", "java", "objectivec", "android", "ios", "swiftui", "jetpack",
            // Libraries & tools
            "expo", "nativebase", "firebase", "redux", "mobx", "sqlite", "realm", "amplify",
            // Development tools
            "androidstudio", "xcode", "appium", "detox", "testflight",
            // Technologies from web that are often used in mobile
            "typescript", "javascript", "graphql", "rest", "axios", "jwt",
            // Services
            "push", "geolocation", "camera", "biometrics", "maps", "notifications",
            "analytics", "storage", "deeplink"
        ],
        ai: [
            // Core AI/ML libraries
            "python", "tensorflow", "pytorch", "scikit-learn", "sklearn", "keras", "huggingface",
            "transformers", "xgboost", "lightgbm", "fastai", "jax", "torchvision", "onnx",
            // Data processing
            "numpy", "pandas", "dask", "scipy", "spark", "hadoop", "polars", "arrow", "vaex",
            // Visualization
            "matplotlib", "seaborn", "plotly", "bokeh", "altair", "graphviz",
            // NLP
            "nltk", "spacy", "gensim", "transformers", "bert", "gpt", "llm", "langchain",
            "tokenizers", "sentencepiece", "word2vec", "glove", "allennlp",
            // Computer Vision
            "opencv", "pillow", "imageio", "albumentations", "detectron", "yolo", "mmdetection",
            "segmentation", "mediapipe", "kornia",
            // MLOps
            "mlflow", "kubeflow", "airflow", "prefect", "kedro", "ray", "wandb", "dvc",
            "tensorboard", "clearml", "sagemaker", "vertexai", "azureml",
            // Deployment
            "flask", "fastapi", "streamlit", "gradio", "docker", "kubernetes", "triton", "bentoml",
            // Programming languages
            "r", "julia", "cpp", "java",
            // Other
            "jupyter", "kaggle", "colab", "rapids", "databricks", "knime", "datarobot"
        ],
        game: [
            // Game engines
            "unity", "unreal", "godot", "gamemaker", "phaser", "construct", "rpgmaker", "cocos2d",
            "threejs", "playcanvas", "babylonjs", "pixijs", "webgl", "love2d", "defold",
            // Languages used in game dev
            "csharp", "c#", "cpp", "c++", "lua", "javascript", "gdscript", "python", "haxe",
            "blueprint", "rust", "golang", "as3",
            // Graphics and rendering
            "opengl", "directx", "vulkan", "hlsl", "glsl", "shader", "blender", "maya", "3dsmax",
            "zbrush", "substance", "vfx",
            // Audio
            "fmod", "wwise", "audiokinetic", "openal", "resonance", "superpowered", "audacity",
            // Physics
            "physx", "havok", "box2d", "bullet", "physjs", "matterjs", "chipmunk",
            // AI and gameplay
            "navmesh", "pathfinding", "behaviortree", "statemachine", "goap", "mlagents",
            "proceduralgeneration", "pcg", "levelgeneration",
            // Networking
            "photon", "mirror", "fishnet", "steamworks", "playfab", "nakama", "colyseus",
            "socketio", "websocket", "netcode", "multiplayer",
            // VR/AR
            "vr", "ar", "xr", "oculus", "steamvr", "openxr", "arkit", "arcore",
            // Other
            "ui", "hud", "animation", "particles", "spritesheet", "tilemap", "voxel", "mobile",
            "console", "pc", "gamepad", "inputsystem", "savesystem"
        ],
        data: [
            // Programming languages for data science
            "python", "r", "sql", "julia", "scala", "java", "csharp", "javascript",
            // Data processing
            "pandas", "numpy", "dplyr", "tidyr", "data.table", "polars", "spark", "koalas",
            "excel", "spreadsheet", "powerquery", "vba",
            // Data visualization
            "matplotlib", "seaborn", "plotly", "bokeh", "tableau", "powerbi", "looker", "d3",
            "kibana", "grafana", "superset", "dataviz", "ggplot2", "shiny",
            // Statistics & Machine Learning
            "statsmodels", "scikit-learn", "sklearn", "tensorflow", "pytorch", "xgboost",
            "regression", "classification", "clustering", "neuralnetwork", "bayesian", "stan",
            "tidymodels", "caret", "prophet", "forecasting", "timeseries",
            // Databases & storage
            "mysql", "postgresql", "oracle", "sql", "mongodb", "cassandra", "datalake", "datawarehouse",
            "redshift", "snowflake", "bigquery", "athena", "hive", "impala", "presto", "druid",
            // Big Data
            "hadoop", "spark", "hive", "kafka", "flink", "beam", "airflow", "dbt", "etl", "elt",
            // Cloud
            "aws", "azure", "gcp", "s3", "emr", "databricks", "dataproc", "dataflow", "azuresynapse",
            // Reporting & BI
            "excel", "tableau", "powerbi", "looker", "microstrategy", "qlik", "sisense", "reporting",
            "dashboard", "bi", "businessintelligence",
            // Tools & Other
            "jupyter", "anaconda", "spyder", "rstudio", "alteryx", "talend", "informatica",
            "fivetran", "matillion", "domo", "webscrapers", "beautifulsoup", "selenium"
        ],
    };
    // Special case: if no category is selected, always return valid
    if (!category) {
        return { valid: true, message: "" };
    }
    // Check if the requested category exists
    if (!Object.keys(categoryTechGroups).includes(categoryLower)) {
        return {
            valid: false,
            message: `Unknown category: ${category}. Please select a valid category.`
        };
    }
    // Check if technologies include at least one that matches the specified category
    const normalizedTechs = technologies.map(tech => tech.toLowerCase().trim());
    // Look for any technology that matches the category
    const categoryTechs = categoryTechGroups[categoryLower];
    // Find technologies that are strongly associated with other categories but not this one
    const techCategories = {};
    // Build a mapping of tech to categories
    Object.entries(categoryTechGroups).forEach(([cat, techs]) => {
        techs.forEach(tech => {
            if (!techCategories[tech]) {
                techCategories[tech] = [];
            }
            techCategories[tech].push(cat);
        });
    });
    // Check if any technology is valid for this category
    const validTechs = normalizedTechs.filter(tech => categoryTechs.some(validTech => 
    // Partial matching to catch variations
    tech.includes(validTech) || validTech.includes(tech)));
    // If at least one technology is valid for this category, we're good
    if (validTechs.length > 0) {
        return { valid: true, message: "" };
    }
    // If we get here, none of the technologies match this category
    // Let's find a better category suggestion
    const techCount = {};
    Object.keys(categoryTechGroups).forEach(cat => {
        techCount[cat] = 0;
    });
    // Count how many technologies match each category
    normalizedTechs.forEach(tech => {
        Object.entries(categoryTechGroups).forEach(([cat, catTechs]) => {
            if (catTechs.some(validTech => tech.includes(validTech) || validTech.includes(tech))) {
                techCount[cat]++;
            }
        });
    });
    // Find the category with the most matches
    let bestCategory = categoryLower;
    let bestCount = 0;
    Object.entries(techCount).forEach(([cat, count]) => {
        if (count > bestCount) {
            bestCount = count;
            bestCategory = cat;
        }
    });
    // Only suggest a different category if we found some matches
    if (bestCount > 0 && bestCategory !== categoryLower) {
        return {
            valid: false,
            message: `The selected technologies seem more appropriate for ${bestCategory} development than ${categoryLower}. Consider changing the category or selecting different technologies.`,
            suggestedCategory: bestCategory
        };
    }
    // If we can't find a good match in any category, give a generic message with a warning flag
    return {
        valid: true, // Let users proceed with their creative combination
        message: "Note: Your selected technologies are unusual for this category, but we'll let you proceed with your creative combination!",
        warning: true // Add warning flag so frontend can display the message
    };
}
/**
 * Extract technologies from AI response if user didn't specify any
 */
function extractTechnologiesFromResponse(projectData, category) {
    // Collect all technologies mentioned in the roles
    const mentionedTechs = new Set();
    // Check team structure roles for mentioned technologies
    if (projectData.teamStructure && projectData.teamStructure.roles) {
        projectData.teamStructure.roles.forEach((role) => {
            if (role.skills && Array.isArray(role.skills)) {
                role.skills.forEach((skill) => {
                    // Only add if it looks like a technology (not a soft skill)
                    if (isTechnologySkill(skill)) {
                        mentionedTechs.add(skill);
                    }
                });
            }
        });
    }
    // If no technologies are found, provide defaults based on category
    if (mentionedTechs.size === 0) {
        switch (category) {
            case "web":
                return ["React", "Node.js", "Express", "MongoDB"];
            case "mobile":
                return ["React Native", "JavaScript", "Firebase"];
            case "ai":
                return ["Python", "TensorFlow", "Scikit-learn"];
            case "game":
                return ["Unity", "C#"];
            case "data":
                return ["Python", "Pandas", "Matplotlib"];
            default:
                return ["JavaScript", "HTML", "CSS"];
        }
    }
    return Array.from(mentionedTechs);
}
/**
 * Check if a skill is likely a technology rather than a soft skill
 */
function isTechnologySkill(skill) {
    // Common soft skills to exclude
    const softSkills = [
        "communication",
        "teamwork",
        "leadership",
        "problem solving",
        "time management",
        "creativity",
        "critical thinking",
        "organization",
        "collaboration",
        "adaptability",
        "project management",
        "attention to detail",
    ];
    const lowerSkill = skill.toLowerCase();
    // Check if it's a soft skill
    if (softSkills.some((softSkill) => lowerSkill.includes(softSkill))) {
        return false;
    }
    // Common technology indicators
    const techIndicators = [
        ".js",
        "sql",
        "html",
        "css",
        "java",
        "python",
        "react",
        "angular",
        "vue",
        "node",
        "express",
        "django",
        "flask",
        "spring",
        "boot",
        "ruby",
        "rails",
        "php",
        "laravel",
        "go",
        "rust",
        "c#",
        "c++",
        "typescript",
        "mongo",
        "postgres",
        "mysql",
        "redis",
        "firebase",
        "aws",
        "azure",
        "google cloud",
        "docker",
        "kubernetes",
        "git",
        "ci/cd",
        "webpack",
        "vite",
        "unity",
        "unreal",
        "threejs",
    ];
    // Check if it contains tech indicators
    return techIndicators.some((indicator) => lowerSkill.includes(indicator));
}
/**
 * Determine if a user-submitted project needs AI enhancement
 */
function shouldEnhanceProject(projectData) {
    // Check if description is too short
    const hasShortDescription = !projectData.description || projectData.description.length < 100;
    // Check if features are missing or too few
    const hasFewFeatures = !projectData.features ||
        !projectData.features.core ||
        projectData.features.core.length < 3 ||
        !projectData.features.additional ||
        projectData.features.additional.length < 2;
    // Check if learning outcomes are missing or too few
    const hasFewOutcomes = !projectData.learningOutcomes || projectData.learningOutcomes.length < 3;
    // Check if roles have missing details
    const hasIncompleteRoles = !projectData.teamStructure ||
        !projectData.teamStructure.roles ||
        projectData.teamStructure.roles.some((role) => !role.title ||
            !role.skills ||
            role.skills.length === 0 ||
            !role.responsibilities ||
            role.responsibilities.length === 0);
    return (hasShortDescription ||
        hasFewFeatures ||
        hasFewOutcomes ||
        hasIncompleteRoles);
}
/**
 * Enhance a user-submitted project with AI-generated content
 */
async function enhanceProjectWithAI(projectData) {
    try {
        // Build a prompt describing what needs to be enhanced
        const enhancementPrompt = `Please enhance the following project submission while preserving its core concept and user intent. Fill in missing details and expand as needed:
    
Project Title: ${projectData.title || "Not provided"}
Project Subtitle: ${projectData.subtitle || "Not provided"}
Project Description: ${projectData.description || "Not provided"}
Technologies: ${projectData.technologies?.join(", ") || "Not specified"}
Project Category: ${projectData.category || "Not specified"}

Core Features: ${projectData.features?.core?.join(", ") || "Not provided"}
Additional Features: ${projectData.features?.additional?.join(", ") || "Not provided"}

Team Structure:
${projectData.teamStructure?.roles
            ?.map((role) => `- ${role.title || "Unnamed role"} (Skills: ${role.skills?.join(", ") || "None specified"}, Responsibilities: ${role.responsibilities?.join(", ") || "None specified"})`)
            .join("\n") || "Not provided"}

Learning Outcomes: ${projectData.learningOutcomes?.join(", ") || "Not provided"}

Enhance this project by:
1. Expanding the description to be detailed and compelling
2. Ensuring at least 5 core features and 5 additional features that make sense for the project
3. Ensuring each role has a clear title, at least 3 relevant skills, and 3 specific responsibilities
4. Providing at least 5 meaningful learning outcomes
5. Maintaining the original concept, technologies, and intent

Return the enhanced project in this exact JSON format:
{
  "title": "Project Title",
  "subtitle": "Brief project summary",
  "description": "Detailed project description...",
  "features": {
    "core": ["Feature 1", "Feature 2", "Feature 3", "Feature 4", "Feature 5"],
    "additional": ["Feature 1", "Feature 2", "Feature 3", "Feature 4", "Feature 5"]
  },
  "teamStructure": {
    "roles": [
      {
        "title": "Role Title",
        "skills": ["Skill 1", "Skill 2", "Skill 3"],
        "responsibilities": ["Responsibility 1", "Responsibility 2", "Responsibility 3"]
      }
    ]
  },
  "learningOutcomes": ["Learning Outcome 1", "Learning Outcome 2", "Learning Outcome 3", "Learning Outcome 4", "Learning Outcome 5"]
}`;
        console.log("\n📡 Sending enhancement request to OpenAI...");
        const completion = await openai.chat.completions.create({
            model: "o3-mini",
            messages: [
                {
                    role: "system",
                    content: "You are an expert software architect and creative project planner. Your role is to enhance user-submitted project details while maintaining the original concept and intent. Return responses as raw JSON without LaTeX formatting like \\boxed{}.",
                },
                {
                    role: "user",
                    content: enhancementPrompt,
                },
            ],
            // temperature: 0.5, // Lower temperature for more consistent enhancements
            max_completion_tokens: 2500, // to switch back to 4o mini change it back to max_tokens
            response_format: { type: "json_object" },
        });
        console.log("\n✨ Enhancement response received");
        try {
            // Check if completion and choices exist before accessing
            if (!completion ||
                !completion.choices ||
                completion.choices.length === 0) {
                console.error("Empty or invalid completion response:", completion);
                return projectData;
            }
            const responseContent = completion.choices[0].message.content || "{}";
            // Clean the response to get valid JSON
            const cleanedResponse = cleanDeepSeekResponse(responseContent);
            const enhancedData = JSON.parse(cleanedResponse);
            console.log("AI Enhancement response:", JSON.stringify(enhancedData, null, 2));
            // Merge the enhanced data with the original, prioritizing original values where they exist
            const mergedData = {
                title: projectData.title || enhancedData.title,
                subtitle: projectData.subtitle || enhancedData.subtitle,
                description: enhancedData.description || projectData.description, // Prefer enhanced description
                technologies: projectData.technologies || [], // Keep original technologies
                complexity: projectData.complexity,
                teamSize: projectData.teamSize,
                duration: projectData.duration,
                category: projectData.category,
                features: {
                    core: enhancedData.features?.core || projectData.features?.core || [],
                    additional: enhancedData.features?.additional ||
                        projectData.features?.additional ||
                        [],
                },
                teamStructure: {
                    roles: enhancedData.teamStructure?.roles?.map((role, index) => {
                        // If there's a matching original role, preserve its title
                        const originalRole = projectData.teamStructure?.roles?.[index];
                        return {
                            title: originalRole?.title || role.title,
                            skills: role.skills || originalRole?.skills || [],
                            responsibilities: role.responsibilities ||
                                originalRole?.responsibilities ||
                                [],
                            filled: false,
                        };
                    }) || [],
                },
                learningOutcomes: enhancedData.learningOutcomes || projectData.learningOutcomes || [],
            };
            console.log("Merged enhancement data:", JSON.stringify(mergedData, null, 2));
            return mergedData;
        }
        catch (parseError) {
            console.error("Error parsing enhancement response:", parseError);
            // If enhancement fails, return the original data
            return projectData;
        }
    }
    catch (error) {
        console.error("Error enhancing project with AI:", error);
        // If any error occurs, return the original data
        return projectData;
    }
}
/**
 * Merge original and enhanced roles, keeping original data where present
 */
function mergeRoles(originalRoles, enhancedRoles) {
    // If original has no roles, use enhanced roles
    if (!originalRoles || originalRoles.length === 0) {
        return enhancedRoles;
    }
    // If enhanced has no roles, use original roles
    if (!enhancedRoles || enhancedRoles.length === 0) {
        return originalRoles;
    }
    // Start with all original roles
    const mergedRoles = [...originalRoles];
    // For each original role, enhance it if possible
    for (let i = 0; i < mergedRoles.length; i++) {
        const originalRole = mergedRoles[i];
        // Find a matching enhanced role by title (or the first one if no match)
        const matchingEnhancedRole = enhancedRoles.find((role) => role.title.toLowerCase() === originalRole.title.toLowerCase()) || enhancedRoles[0];
        // Merge in enhanced data where original is missing
        if (matchingEnhancedRole) {
            mergedRoles[i] = {
                title: originalRole.title || matchingEnhancedRole.title,
                skills: originalRole.skills?.length > 0
                    ? originalRole.skills
                    : matchingEnhancedRole.skills,
                responsibilities: originalRole.responsibilities?.length > 0
                    ? originalRole.responsibilities
                    : matchingEnhancedRole.responsibilities,
            };
        }
    }
    // If original has fewer roles than enhanced, add the additional enhanced roles
    if (originalRoles.length < enhancedRoles.length) {
        // Get titles of original roles
        const originalTitles = originalRoles.map((role) => role.title.toLowerCase());
        // Add enhanced roles that don't have a title match in original roles
        enhancedRoles.forEach((enhancedRole) => {
            if (!originalTitles.includes(enhancedRole.title.toLowerCase())) {
                mergedRoles.push(enhancedRole);
            }
        });
    }
    return mergedRoles;
}
// Add this function to clean the response from DeepSeek
function cleanDeepSeekResponse(response) {
    // Remove LaTeX box formatting if present
    if (response.startsWith("\\boxed{") && response.endsWith("}")) {
        response = response.substring(7, response.length - 1);
    }
    // Remove other LaTeX markers if present
    response = response.replace(/\\begin\{.*?\}|\\end\{.*?\}/g, "");
    // Clean up any other non-JSON elements
    try {
        // Test if it's valid JSON
        JSON.parse(response);
        return response;
    }
    catch (e) {
        // Try to extract JSON if wrapped in other text
        const jsonMatch = response.match(/(\{[\s\S]*\})/);
        if (jsonMatch && jsonMatch[1]) {
            try {
                JSON.parse(jsonMatch[1]);
                return jsonMatch[1];
            }
            catch (e) {
                // Still not valid, do additional cleaning
            }
        }
        // More aggressive cleaning - remove all non-JSON characters outside quotes
        let inString = false;
        let cleanedResponse = "";
        for (let i = 0; i < response.length; i++) {
            const char = response[i];
            // Track if we're inside a string
            if (char === '"' && (i === 0 || response[i - 1] !== "\\")) {
                inString = !inString;
            }
            // Keep all characters inside strings, and only specific characters outside
            if (inString || /[\{\}\[\]:,0-9.\-truefalsnul"]/.test(char)) {
                cleanedResponse += char;
            }
            else if (/\s/.test(char)) {
                // Keep whitespace
                cleanedResponse += char;
            }
        }
        return cleanedResponse;
    }
}
exports.generateProject = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        console.log("\n🚀 Starting project generation with AI...");
        const { technologies, complexity, duration, teamSize, category, projectTheme, } = req.body;
        if (!req.user) {
            return next(new ErrorHandler_1.default("Authentication required", 401));
        }
        const user = req.user;
        console.log("👤 Checking project limits for user:", user._id);
        if (user.projectIdeasLeft === undefined || user.projectIdeasLeft <= 0) {
            console.log("❌ No project ideas left");
            return next(new ErrorHandler_1.default(user.plan === "pro"
                ? "You've reached your monthly project limit of 10 ideas. Please wait until next month for a refresh."
                : "You've reached your limit of 3 project ideas. Free users have a maximum of 3 project ideas total. Please upgrade to Pro.", 403));
        }
        // Validate technology and category combinations
        const validationResult = validateTechnologyCategoryPair(technologies, category);
        // Still proceed if valid, but include warning message in the response if present
        if (!validationResult.valid) {
            return next(new ErrorHandler_1.default(validationResult.message, 400));
        }
        // Add warning message to the response if needed
        const warningMessage = validationResult.warning ? validationResult.message : null;
        // Generate project with OpenAI
        console.log("\n🤖 Generating OpenAI prompt...");
        const prompt = getOptimizedPrompt({
            technologies,
            complexity,
            duration,
            teamSize,
            category,
            projectTheme,
        });
        console.log("📝 Prompt created for OpenAI");
        console.log("\n📡 Sending request to OpenAI...");
        let completion;
        try {
            completion = await openaiBreaker.execute(async () => {
                return await openai.chat.completions.create({
                    model: "o3-mini",
                    messages: [
                        {
                            role: "system",
                            content: "You are an expert software architect and creative project planner. Your role is to generate detailed, innovative, and practical software project ideas based on user requirements. Return responses as raw JSON without LaTeX formatting like \\boxed{}.",
                        },
                        {
                            role: "user",
                            content: prompt,
                        },
                    ],
                    max_completion_tokens: 2500,
                    response_format: { type: "json_object" },
                });
            });
        }
        catch (error) {
            if (error.message === 'Circuit is open') {
                return next(new ErrorHandler_1.default("We're experiencing high demand for AI project generation. Please try again in a minute.", 503));
            }
            // Handle other OpenAI errors
            console.error('OpenAI API error:', error);
            return next(new ErrorHandler_1.default("Unable to generate project at this time. Please try again later.", 500));
        }
        console.log("\n✨ OpenAI Response received");
        let projectData;
        console.log("Completion response structure:", JSON.stringify(completion, null, 2));
        try {
            // Check if completion and choices exist before accessing
            if (!completion ||
                !completion.choices ||
                completion.choices.length === 0) {
                console.error("Empty or invalid completion response:", completion);
                return next(new ErrorHandler_1.default("Failed to get a valid response from the AI. Please try again.", 500));
            }
            const responseContent = completion.choices[0].message.content || "{}";
            // Clean the response to get valid JSON
            const cleanedResponse = cleanDeepSeekResponse(responseContent);
            projectData = JSON.parse(cleanedResponse);
            // Validate that the response has all required fields
            const requiredFields = [
                "title",
                "subtitle",
                "description",
                "features",
                "teamStructure",
                "learningOutcomes",
            ];
            for (const field of requiredFields) {
                if (!projectData[field]) {
                    throw new Error(`Missing required field: ${field}`);
                }
            }
            // Validate nested structures
            if (!projectData.features.core || !projectData.features.additional) {
                throw new Error("Invalid features structure");
            }
            if (!projectData.teamStructure.roles ||
                !Array.isArray(projectData.teamStructure.roles)) {
                throw new Error("Invalid team structure");
            }
            // Validate role count matches exactTeamSize if specified
            if (projectData.teamStructure &&
                projectData.teamStructure.roles &&
                req.body.exactTeamSize) {
                const exactSize = parseInt(req.body.exactTeamSize);
                const actualRoleCount = projectData.teamStructure.roles.length;
                if (actualRoleCount !== exactSize) {
                    console.warn(`Team size mismatch: AI generated ${actualRoleCount} roles but exactTeamSize=${exactSize}`);
                    // Fix the roles array to match exact size
                    if (actualRoleCount > exactSize) {
                        // Too many roles, trim the extras
                        projectData.teamStructure.roles = projectData.teamStructure.roles.slice(0, exactSize);
                        console.log(`Trimmed roles array to ${exactSize} roles`);
                    }
                    else if (actualRoleCount < exactSize) {
                        // Too few roles, duplicate the last one with variations
                        const lastRole = projectData.teamStructure.roles[actualRoleCount - 1];
                        for (let i = actualRoleCount; i < exactSize; i++) {
                            const newRole = {
                                title: `${lastRole.title} ${i + 1}`,
                                skills: [...lastRole.skills],
                                responsibilities: [...lastRole.responsibilities],
                                filled: false
                            };
                            projectData.teamStructure.roles.push(newRole);
                        }
                        console.log(`Added additional roles to reach ${exactSize} roles`);
                    }
                }
            }
            const roles = projectData.teamStructure?.roles || [];
            const roleCount = roles.length;
            if ((teamSize === "solo" && roleCount !== 1) ||
                (teamSize === "small" && (roleCount < 2 || roleCount > 3)) ||
                (teamSize === "medium" && (roleCount < 4 || roleCount > 6))) {
                console.warn(`Team size constraint violated: Expected ${teamSize} but got ${roleCount} roles`);
            }
        }
        catch (parseError) {
            console.error("Error parsing or validating OpenAI response:", parseError);
            return next(new ErrorHandler_1.default("Failed to generate a valid project. Please try again.", 500));
        }
        // Ensure the teamStructure roles have the 'filled' property
        if (projectData.teamStructure && projectData.teamStructure.roles) {
            projectData.teamStructure.roles = projectData.teamStructure.roles.map((role) => ({
                ...role,
                filled: false, // Default to not filled
            }));
        }
        // Format according to our schema
        const fixedComplexity = {
            level: complexity.level.toLowerCase(),
            percentage: complexity.percentage,
        };
        const formattedTeamSize = {
            type: teamSize,
            count: teamSize === "solo" ? "1" : teamSize === "small" ? "2-3" : "4-6",
        };
        const formattedDuration = {
            type: duration,
            estimate: duration === "small"
                ? "1-2 weeks"
                : duration === "medium"
                    ? "1-2 months"
                    : "3+ months",
        };
        // Ensure technologies are included in the project
        const projectTechnologies = technologies.length > 0
            ? technologies
            : extractTechnologiesFromResponse(projectData, category);
        // Create project in database
        console.log("\n💾 Saving to database...");
        const project = await generateProject_model_1.default.create({
            title: projectData.title,
            subtitle: projectData.subtitle,
            description: projectData.description,
            userId: user._id,
            technologies: projectTechnologies,
            complexity: fixedComplexity,
            teamSize: formattedTeamSize,
            duration: formattedDuration,
            category,
            features: projectData.features,
            teamStructure: projectData.teamStructure,
            learningOutcomes: projectData.learningOutcomes,
        });
        // Create activity for project generation
        await (0, activityUtils_1.createProjectGeneratedActivity)(user._id.toString(), project._id?.toString() || project.id.toString(), project.title);
        await userModel_1.default.findByIdAndUpdate(user._id, {
            $inc: {
                projectIdeasLeft: -1,
                projectsGenerated: 1,
            },
        });
        // Update Redis cache with new user data
        const updatedUser = await userModel_1.default.findById(user._id);
        if (updatedUser) {
            await redis_1.redis.set(user.githubId, JSON.stringify(updatedUser));
        }
        console.log("\n✅ Project generation complete!");
        // Include warning message in the success response if present
        const responseObject = {
            success: true,
            project,
        };
        if (warningMessage) {
            responseObject.warning = warningMessage;
        }
        res.status(201).json(responseObject);
    }
    catch (parseError) {
        console.error("Error parsing or validating OpenAI response:", parseError);
        console.log("Raw response:", "Failed to parse response content");
        return next(new ErrorHandler_1.default("Failed to generate a valid project. Please try again.", 500));
    }
});
exports.getGeneratedProjects = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const userId = req.user?._id;
        const projects = await generateProject_model_1.default.find({ userId }).sort({
            createdAt: -1,
        });
        res.status(200).json({
            success: true,
            projects,
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
exports.generateAnother = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { projectId } = req.params;
        if (!req.user) {
            return next(new ErrorHandler_1.default("Authentication required", 401));
        }
        const userId = req.user?._id;
        // Get the original project
        const originalProject = await generateProject_model_1.default.findOne({
            _id: projectId,
            userId,
        });
        if (!originalProject) {
            return next(new ErrorHandler_1.default("Project not found", 404));
        }
        // Check user's remaining project ideas
        const user = await userModel_1.default.findById(userId);
        if (!user) {
            return next(new ErrorHandler_1.default("User not found", 404));
        }
        if (user.projectIdeasLeft <= 0 && user.plan !== "pro") {
            return next(new ErrorHandler_1.default("No project ideas left. Please upgrade to Pro plan.", 403));
        }
        // Create preferences object from original project
        const preferences = {
            technologies: originalProject.technologies,
            complexity: originalProject.complexity,
            duration: originalProject.duration.type,
            teamSize: originalProject.teamSize.type,
            category: originalProject.category,
            // Add a note requesting a different project
            projectTheme: "Please generate a different project than before, with a fresh concept and approach.",
        };
        // Generate new project with OpenAI
        console.log("\n🤖 Generating OpenAI prompt for new project variation...");
        const prompt = getOptimizedPrompt(preferences);
        console.log("\n📡 Sending request to OpenAI...");
        const completion = await openai.chat.completions.create({
            model: "o3-mini",
            messages: [
                {
                    role: "system",
                    content: "You are an expert software architect and creative project planner. Your role is to generate detailed, innovative, and practical software project ideas based on user requirements. Create a different project than what might have been generated before. Return responses as raw JSON without LaTeX formatting like \\boxed{}.",
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            // temperature: 0.8, // Slightly higher temperature for more variation
            max_completion_tokens: 2500,
            response_format: { type: "json_object" },
        });
        console.log("\n✨ OpenAI Response received");
        let projectData;
        try {
            // Check if completion and choices exist before accessing
            if (!completion ||
                !completion.choices ||
                completion.choices.length === 0) {
                console.error("Empty or invalid completion response:", completion);
                return next(new ErrorHandler_1.default("Failed to get a valid response from the AI. Please try again.", 500));
            }
            const responseContent = completion.choices[0].message.content || "{}";
            // Clean the response to get valid JSON
            const cleanedResponse = cleanDeepSeekResponse(responseContent);
            projectData = JSON.parse(cleanedResponse);
            // Validate that the response has all required fields
            const requiredFields = [
                "title",
                "subtitle",
                "description",
                "features",
                "teamStructure",
                "learningOutcomes",
            ];
            for (const field of requiredFields) {
                if (!projectData[field]) {
                    throw new Error(`Missing required field: ${field}`);
                }
            }
            // Validate nested structures
            if (!projectData.features.core || !projectData.features.additional) {
                throw new Error("Invalid features structure");
            }
            if (!projectData.teamStructure.roles ||
                !Array.isArray(projectData.teamStructure.roles)) {
                throw new Error("Invalid team structure");
            }
        }
        catch (parseError) {
            console.error("Error parsing or validating OpenAI response:", parseError);
            return next(new ErrorHandler_1.default("Failed to generate a valid project. Please try again.", 500));
        }
        // Ensure the teamStructure roles have the 'filled' property
        if (projectData.teamStructure && projectData.teamStructure.roles) {
            projectData.teamStructure.roles = projectData.teamStructure.roles.map((role) => ({
                ...role,
                filled: false, // Default to not filled
            }));
        }
        // Create new project
        const newProject = await generateProject_model_1.default.create({
            title: projectData.title,
            subtitle: projectData.subtitle,
            description: projectData.description,
            userId,
            technologies: originalProject.technologies,
            complexity: originalProject.complexity,
            teamSize: originalProject.teamSize,
            duration: originalProject.duration,
            category: originalProject.category,
            features: projectData.features,
            teamStructure: projectData.teamStructure,
            learningOutcomes: projectData.learningOutcomes,
        });
        // Create activity for project generation
        await (0, activityUtils_1.createProjectGeneratedActivity)(userId.toString(), newProject._id?.toString() || newProject.id.toString(), newProject.title);
        // Update user's stats - only decrement for free users
        if (user.plan !== "pro") {
            await userModel_1.default.findByIdAndUpdate(userId, {
                $inc: {
                    projectIdeasLeft: -1,
                    projectsGenerated: 1,
                },
            });
        }
        else {
            // For pro users, just increment the generated count
            await userModel_1.default.findByIdAndUpdate(userId, {
                $inc: { projectsGenerated: 1 },
            });
        }
        // Update Redis cache with new user data
        const updatedUser = await userModel_1.default.findById(userId);
        if (updatedUser) {
            await redis_1.redis.set(req.user.githubId, JSON.stringify(updatedUser));
        }
        res.status(201).json({
            success: true,
            project: newProject,
        });
    }
    catch (error) {
        console.error("Error generating another project:", error);
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
exports.startProject = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { projectId } = req.params;
        if (!req.user) {
            return next(new ErrorHandler_1.default("Authentication required", 401));
        }
        const userId = req.user._id;
        // Check if project exists and belongs to user
        const project = await generateProject_model_1.default.findOne({
            _id: projectId,
            userId,
        });
        if (!project) {
            return next(new ErrorHandler_1.default("Project not found", 404));
        }
        // Save the project
        project.isSaved = true;
        await project.save();
        await (0, activityUtils_1.createProjectSavedActivity)(req.user._id.toString(), projectId, project.title);
        // Update user's saved projects count if needed
        await userModel_1.default.findByIdAndUpdate(userId, {
            $addToSet: {
                startedProjects: {
                    projectId: project._id,
                    startedAt: new Date(),
                    status: "in-progress",
                },
            },
        });
        // Update Redis cache
        const updatedUser = await userModel_1.default.findById(userId);
        await redis_1.redis.set(req.user.githubId, JSON.stringify(updatedUser));
        res.status(200).json({
            success: true,
            message: "Project saved successfully",
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
exports.getUserSavedProjects = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        if (!req.user) {
            return next(new ErrorHandler_1.default("Authentication required", 401));
        }
        const userId = req.user._id;
        const projects = await generateProject_model_1.default.find({
            userId,
            isSaved: true,
            isPublished: false, // Only get unpublished saved projects
        }).sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            projects,
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
exports.publishProject = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { projectId } = req.params;
        const { selectedRole } = req.body; // Make sure this is being received correctly
        if (!req.user) {
            return next(new ErrorHandler_1.default("Authentication required", 401));
        }
        const userId = req.user._id;
        console.log("Publishing project with selected role:", selectedRole); // Add logging
        // Find the project
        const project = await generateProject_model_1.default.findOne({
            _id: projectId,
            userId,
        });
        if (!project) {
            return next(new ErrorHandler_1.default("Project not found", 404));
        }
        // If the project is already published, return error
        if (project.isPublished) {
            return next(new ErrorHandler_1.default("Project is already published", 400));
        }
        // Check if user has reached their publish limit
        const canPublish = await (0, pricingUtils_1.checkPublishLimit)(userId.toString());
        if (!canPublish) {
            return next(new ErrorHandler_1.default("You have reached your publish limit. Free users can only publish 1 project. Upgrade to Pro for unlimited publishing.", 403));
        }
        // Set the project as published
        project.isPublished = true;
        // Handle role selection properly
        if (selectedRole &&
            project.teamStructure &&
            project.teamStructure.roles) {
            const roleIndex = project.teamStructure.roles.findIndex((role) => role.title === selectedRole);
            if (roleIndex !== -1) {
                // Mark the selected role as filled
                project.teamStructure.roles[roleIndex].filled = true;
                // Add the user as a team member with the selected role
                if (!project.teamMembers) {
                    project.teamMembers = [];
                }
                project.teamMembers.push({
                    userId: userId,
                    role: selectedRole,
                    joinedAt: new Date(),
                });
            }
        }
        // Save the project
        await project.save();
        //Increment user's published project count if pricing is enabled
        await (0, pricingUtils_1.incrementPublishedProjects)(userId.toString());
        await (0, activityUtils_1.createProjectPublishedActivity)(req.user._id.toString(), projectId, project.title);
        // Update Redis cache with fresh user data
        const updatedUser = await userModel_1.default.findById(userId);
        if (updatedUser) {
            await redis_1.redis.set(req.user.githubId, JSON.stringify(updatedUser), "EX", 3600);
        }
        res.status(200).json({
            success: true,
            message: "Project published successfully",
            project,
        });
    }
    catch (error) {
        console.error("Error publishing project:", error); // Add error logging
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
exports.submitUserProject = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        console.log("\n🚀 Starting user project submission...");
        const projectData = req.body;
        if (!req.user) {
            return next(new ErrorHandler_1.default("Authentication required", 401));
        }
        const user = req.user;
        const useEnhancement = req.body.useEnhancement === true;
        // Check if the project needs and should use AI enhancement
        let enhancedData = { ...projectData };
        let wasEnhanced = false;
        if (useEnhancement) {
            console.log("🔍 Enhancement requested. Checking limits...");
            // Check if user has enhancements left
            const hasEnhancementsLeft = await (0, pricingUtils_2.checkEnhancementsLimit)(user._id.toString());
            if (!hasEnhancementsLeft) {
                return next(new ErrorHandler_1.default("No enhancements left. Pro users get 8 enhancements per month, while free users get 2.", 403));
            }
            // Now check if the project would benefit from enhancement
            const needsEnhancement = shouldEnhanceProject(projectData);
            if (needsEnhancement) {
                console.log("📝 Project needs enhancement, calling AI...");
                enhancedData = await enhanceProjectWithAI(projectData);
                wasEnhanced = true;
                // Decrement user's enhancement count
                await (0, pricingUtils_2.decrementEnhancements)(user._id.toString());
                console.log(`User's enhancements decremented. AI enhancement applied.`);
            }
            else {
                console.log("✅ Project is already well-defined. Enhancement not necessary.");
            }
        }
        // Determine complexity level based on percentage
        const complexityLevel = enhancedData.complexity <= 33
            ? "beginner"
            : enhancedData.complexity <= 66
                ? "intermediate"
                : "advanced";
        // Format the teamSize
        const teamSizeType = enhancedData.teamSize;
        const teamSizeCount = enhancedData.teamSize === "solo"
            ? "1"
            : enhancedData.teamSize === "small"
                ? "2-3"
                : "4-6";
        // Format the duration
        const durationType = enhancedData.duration;
        const durationEstimate = enhancedData.duration === "small"
            ? "1-2 weeks"
            : enhancedData.duration === "medium"
                ? "1-2 months"
                : "3+ months";
        // Format the data to match our schema structure
        const formattedData = {
            title: enhancedData.title,
            subtitle: enhancedData.subtitle || "", // Ensure subtitle has a default value
            description: enhancedData.description,
            userId: user._id,
            technologies: enhancedData.technologies || [],
            complexity: {
                level: complexityLevel,
                percentage: Number(enhancedData.complexity), // Ensure this is a number
            },
            teamSize: {
                type: teamSizeType,
                count: teamSizeCount,
            },
            duration: {
                type: durationType,
                estimate: durationEstimate,
            },
            category: enhancedData.category || "web", // Default to web if not specified
            features: {
                core: enhancedData.features?.core?.filter((feature) => feature.trim()) || [],
                additional: enhancedData.features?.additional?.filter((feature) => feature.trim()) || [],
            },
            teamStructure: {
                roles: enhancedData.teamStructure?.roles?.map((role) => ({
                    title: role.title || "",
                    skills: role.skills || [],
                    responsibilities: role.responsibilities?.filter((r) => r.trim()) || [],
                    filled: false, // Default to not filled
                })) || [],
            },
            learningOutcomes: enhancedData.learningOutcomes?.filter((outcome) => outcome.trim()) || [],
            isSaved: true, // Auto-save user submitted projects
            isPublished: false, // Not published by default
            wasEnhanced: wasEnhanced, // Add this flag to track if project was enhanced
        };
        // Log the data being saved
        console.log("\n📝 User project data to be saved", wasEnhanced ? " (AI enhanced)" : "");
        // Create project in database
        console.log("\n💾 Saving to database...");
        const project = await generateProject_model_1.default.create(formattedData);
        // Create activity for project saving
        await (0, activityUtils_1.createProjectSavedActivity)(user._id.toString(), project._id?.toString() || project.id.toString(), project.title);
        // Update user's stats
        await userModel_1.default.findByIdAndUpdate(user._id, {
            $inc: { projectsGenerated: 1 },
            $addToSet: {
                startedProjects: {
                    projectId: project._id,
                    startedAt: new Date(),
                    status: "in-progress",
                },
            },
        });
        // Update Redis cache with new user data
        const updatedUser = await userModel_1.default.findById(user._id);
        if (updatedUser) {
            await redis_1.redis.set(user.githubId, JSON.stringify(updatedUser));
        }
        console.log("\n✅ User project submission complete!");
        res.status(201).json({
            success: true,
            project,
            wasEnhanced: wasEnhanced,
        });
    }
    catch (error) {
        console.log("\n❌ Error in user project submission:", error);
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
exports.editProject = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        console.log("\n🔄 Starting project update...");
        const { projectId } = req.params;
        if (!req.user) {
            return next(new ErrorHandler_1.default("Authentication required", 401));
        }
        const userId = req.user._id;
        const projectData = req.body;
        // Check if project exists and belongs to user
        const project = await generateProject_model_1.default.findOne({
            _id: projectId,
            userId,
        });
        if (!project) {
            return next(new ErrorHandler_1.default("Project not found", 404));
        }
        // Check if project is published - don't allow editing published projects
        if (project.isPublished) {
            return next(new ErrorHandler_1.default("Published projects cannot be edited", 403));
        }
        // Check if user can edit projects (only pro users) ===
        const userCanEdit = await (0, pricingUtils_1.canEditProject)(userId.toString());
        if (!userCanEdit) {
            return next(new ErrorHandler_1.default("Only Pro users can edit saved projects. Please upgrade to Pro to enable project editing.", 403));
        }
        // Process the updates
        const updatedProject = {
            title: projectData.title || project.title,
            subtitle: projectData.subtitle || project.subtitle,
            description: projectData.description || project.description,
            technologies: projectData.technologies || project.technologies,
            complexity: projectData.complexity
                ? {
                    level: projectData.complexity.level || project.complexity.level,
                    percentage: projectData.complexity.percentage ||
                        project.complexity.percentage,
                }
                : project.complexity,
            teamSize: projectData.teamSize
                ? {
                    type: projectData.teamSize.type || project.teamSize.type,
                    count: projectData.teamSize.count || project.teamSize.count,
                }
                : project.teamSize,
            duration: projectData.duration
                ? {
                    type: projectData.duration.type || project.duration.type,
                    estimate: projectData.duration.estimate || project.duration.estimate,
                }
                : project.duration,
            category: projectData.category || project.category,
            features: projectData.features
                ? {
                    core: projectData.features.core || project.features.core,
                    additional: projectData.features.additional || project.features.additional,
                }
                : project.features,
            teamStructure: projectData.teamStructure
                ? {
                    roles: projectData.teamStructure.roles.map((role, index) => ({
                        title: role.title ||
                            (project.teamStructure.roles[index]
                                ? project.teamStructure.roles[index].title
                                : ""),
                        skills: role.skills ||
                            (project.teamStructure.roles[index]
                                ? project.teamStructure.roles[index].skills
                                : []),
                        responsibilities: role.responsibilities ||
                            (project.teamStructure.roles[index]
                                ? project.teamStructure.roles[index].responsibilities
                                : []),
                        filled: role.filled !== undefined
                            ? role.filled
                            : project.teamStructure.roles[index]
                                ? project.teamStructure.roles[index].filled
                                : false,
                    })),
                }
                : project.teamStructure,
            learningOutcomes: projectData.learningOutcomes || project.learningOutcomes,
        };
        // Update the project
        console.log("\n📝 Updating project data in database...");
        const result = await generateProject_model_1.default.findByIdAndUpdate(projectId, updatedProject, { new: true, runValidators: true });
        console.log("\n✅ Project update complete!");
        res.status(200).json({
            success: true,
            project: result,
            message: "Project updated successfully",
        });
    }
    catch (error) {
        console.log("\n❌ Error in project update:", error);
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
