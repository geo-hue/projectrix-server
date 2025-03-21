/**
 * Generate a comprehensive README.md file for the project
 */
export function generateProjectReadme(project: any): string {
  const {
    title,
    subtitle,
    description,
    technologies,
    features,
    teamStructure,
    complexity,
    duration,
    teamSize,
    learningOutcomes
  } = project;

  // Generate technology badges
  const techBadges = technologies.map((tech:any) => {
    const sanitizedTech = tech.toLowerCase().replace(/\s+/g, '-');
    return `![${tech}](https://img.shields.io/badge/-${encodeURIComponent(tech)}-05122A?style=flat&logo=${sanitizedTech})`;
  }).join(' ');

  // Format the README content
  return `# ${title}

${subtitle}

${techBadges}

## 📋 Project Overview

${description}

- **Complexity Level**: ${complexity.level.charAt(0).toUpperCase() + complexity.level.slice(1)} (${complexity.percentage}%)
- **Estimated Duration**: ${duration.estimate}
- **Team Size**: ${teamSize.count}
- **Generated with**: [Projectrix](https://projectrix.app)

## ✨ Features

### Core Features
${features.core.map((feature: any) => `- ${feature}`).join('\n')}

### Additional Features
${features.additional.map((feature:any) => `- ${feature}`).join('\n')}

## 🛠️ Technologies

${technologies.map((tech: any) => `- **${tech}**`).join('\n')}

## 👥 Team Structure

${teamStructure.roles.map((role: { title: any; skills: any[]; responsibilities: any[]; }) => {
  return `### ${role.title}
- **Required Skills**: ${role.skills.join(', ')}
- **Key Responsibilities**: ${role.responsibilities.join(', ')}
`;
}).join('\n')}

## 🚀 Getting Started

### Prerequisites

- List the required software and tools
- Add setup instructions for the development environment

### Installation

\`\`\`bash
# Clone the repository
git clone https://github.com/your-username/${title.toLowerCase().replace(/\s+/g, '-')}.git

# Navigate to the project directory
cd ${title.toLowerCase().replace(/\s+/g, '-')}

# Install dependencies
# Add specific install commands based on your tech stack
\`\`\`

## 📚 Documentation

More detailed documentation can be found in the \`docs\` directory, including:

- Role-specific documentation
- Architecture overview
- API documentation (when available)
- Development workflows

## 🌱 Learning Outcomes

This project provides opportunities to learn and practice:

${learningOutcomes.map((outcome: any) => `- ${outcome}`).join('\n')}

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

---

Generated with [Projectrix](https://projectrix.app) - AI-powered project ideas and team collaboration
`;
}

/**
 * Generate a Pull Request template for the repository
 */
export function generatePullRequestTemplate(): string {
  return `## Description
<!-- Provide a brief summary of the changes made in this PR -->

## Related Issue
<!-- Link to the issue this PR addresses, if applicable -->
Fixes #

## Type of Change
<!-- Mark the relevant option with an 'x' -->
- [ ] Bug fix (non-breaking change fixing an issue)
- [ ] New feature (non-breaking change adding functionality)
- [ ] Breaking change (fix or feature causing existing functionality to change)
- [ ] Code refactor (no functional changes)
- [ ] Documentation update
- [ ] Testing improvement

## How Has This Been Tested?
<!-- Describe the tests run to verify your changes -->

## Screenshots (if applicable)
<!-- Add screenshots to help explain your changes -->

## Checklist
<!-- Mark items with an 'x' once completed -->
- [ ] My code follows the project's coding style
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have updated the documentation accordingly
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix/feature works
- [ ] New and existing tests pass locally with my changes

## Additional Notes
<!-- Any other information that is important to this PR -->
`;
}

/**
 * Generate an Issue template for the repository
 */
export function generateIssueTemplate(): string {
  return `## Description
<!-- Provide a clear and concise description of the issue or feature -->

## Expected Behavior
<!-- What should happen? -->

## Current Behavior
<!-- What happens instead? -->

## Steps to Reproduce
<!-- For bugs, list steps to reproduce the issue -->
1.
2.
3.

## Context
<!-- Any additional context, screenshots, or examples -->

## Proposed Solution
<!-- If you have ideas on how to solve this, share them here -->

## Environment
<!-- Relevant environment information if applicable -->
- Browser/Device:
- Operating System:
- Project Version:
`;
}

/**
 * Generate a Code of Conduct for the repository
 */
export function generateCodeOfConduct(projectTitle: string): string {
  return `# Code of Conduct for ${projectTitle}

## Our Pledge

We as members, contributors, and leaders pledge to make participation in our
community a harassment-free experience for everyone, regardless of age, body
size, visible or invisible disability, ethnicity, sex characteristics, gender
identity and expression, level of experience, education, socio-economic status,
nationality, personal appearance, race, religion, or sexual identity
and orientation.

We pledge to act and interact in ways that contribute to an open, welcoming,
diverse, inclusive, and healthy community.

## Our Standards

Examples of behavior that contributes to a positive environment:

* Demonstrating empathy and kindness toward other people
* Being respectful of differing opinions, viewpoints, and experiences
* Giving and gracefully accepting constructive feedback
* Accepting responsibility and apologizing to those affected by our mistakes
* Focusing on what is best for the overall community

Examples of unacceptable behavior:

* The use of sexualized language or imagery and sexual attention or advances
* Trolling, insulting or derogatory comments, and personal or political attacks
* Public or private harassment
* Publishing others' private information without explicit permission
* Other conduct which could reasonably be considered inappropriate in a
  professional setting

## Enforcement Responsibilities

Project maintainers are responsible for clarifying and enforcing our standards of
acceptable behavior and will take appropriate and fair corrective action in
response to any behavior that they deem inappropriate, threatening, offensive,
or harmful.

## Scope

This Code of Conduct applies within all community spaces, and also applies when
an individual is representing the community in public spaces.

## Enforcement

Instances of abusive, harassing, or otherwise unacceptable behavior may be
reported to the project team. All complaints will be reviewed and investigated
promptly and fairly.

All project maintainers are obligated to respect the privacy and security of the
reporter of any incident.

## Attribution

This Code of Conduct is adapted from the [Contributor Covenant](https://www.contributor-covenant.org),
version 2.0, available at
https://www.contributor-covenant.org/version/2/0/code_of_conduct.html.
`;
}

/**
 * Generate a license file (MIT by default)
 */
export function generateLicense(): string {
  const currentYear = new Date().getFullYear();
  
  return `MIT License

Copyright (c) ${currentYear} Project Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;
}

/**
 * Generate folder structure guidance based on project technology stack
 */
export function generateFolderStructureGuide(project: any): string {
  const { technologies, category } = project;
  const techString = technologies.join(' ').toLowerCase();
  
  let structure = `# Recommended Folder Structure\n\n`;
  
  if (category === 'web' && (techString.includes('react') || techString.includes('next'))) {
    structure += `## React/Next.js Project Structure

\`\`\`
${project.title.toLowerCase().replace(/\s+/g, '-')}/
├── public/              # Static files
├── src/
│   ├── components/      # Reusable UI components
│   ├── pages/           # Page components (or app/ for Next.js 13+)
│   ├── hooks/           # Custom React hooks
│   ├── services/        # API services and external integrations
│   ├── utils/           # Utility functions
│   ├── styles/          # Global styles
│   ├── types/           # TypeScript type definitions
│   ├── context/         # React context providers
│   └── assets/          # Images, fonts, etc.
├── tests/               # Test files
├── docs/                # Documentation
│   └── roles/           # Role-specific documentation
├── .eslintrc.js         # ESLint configuration
├── .prettierrc          # Prettier configuration
├── tsconfig.json        # TypeScript configuration
├── README.md            # Project overview
└── package.json         # Dependencies and scripts
\`\`\``;
  } else if (category === 'web' && (techString.includes('node') || techString.includes('express'))) {
    structure += `## Node.js/Express Project Structure

\`\`\`
${project.title.toLowerCase().replace(/\s+/g, '-')}/
├── src/
│   ├── controllers/     # Request handlers
│   ├── models/          # Database models
│   ├── routes/          # Route definitions
│   ├── middleware/      # Express middleware
│   ├── services/        # Business logic
│   ├── utils/           # Utility functions
│   ├── types/           # TypeScript type definitions
│   └── config/          # Configuration files
├── tests/               # Test files
├── docs/                # Documentation
│   └── roles/           # Role-specific documentation
├── .eslintrc.js         # ESLint configuration
├── .prettierrc          # Prettier configuration
├── tsconfig.json        # TypeScript configuration
├── README.md            # Project overview
└── package.json         # Dependencies and scripts
\`\`\``;
  } else if (category === 'mobile' && techString.includes('react native')) {
    structure += `## React Native Project Structure

\`\`\`
${project.title.toLowerCase().replace(/\s+/g, '-')}/
├── src/
│   ├── components/      # Reusable UI components
│   ├── screens/         # Screen components
│   ├── navigation/      # Navigation configuration
│   ├── hooks/           # Custom React hooks
│   ├── services/        # API services and external integrations
│   ├── utils/           # Utility functions
│   ├── styles/          # Global styles and themes
│   ├── types/           # TypeScript type definitions
│   ├── context/         # React context providers
│   └── assets/          # Images, fonts, etc.
├── tests/               # Test files
├── docs/                # Documentation
│   └── roles/           # Role-specific documentation
├── .eslintrc.js         # ESLint configuration
├── .prettierrc          # Prettier configuration
├── tsconfig.json        # TypeScript configuration
├── README.md            # Project overview
└── package.json         # Dependencies and scripts
\`\`\``;
  } else if (category === 'mobile' && (techString.includes('flutter') || techString.includes('dart'))) {
    structure += `## Flutter Project Structure

\`\`\`
${project.title.toLowerCase().replace(/\s+/g, '-')}/
├── lib/
│   ├── screens/         # Screen widgets
│   ├── widgets/         # Reusable UI widgets
│   ├── models/          # Data models
│   ├── services/        # API services and external integrations
│   ├── utils/           # Utility functions
│   ├── providers/       # State management
│   ├── constants/       # Constants and configurations
│   └── routes/          # Navigation routes
├── assets/              # Images, fonts, etc.
├── test/                # Test files
├── docs/                # Documentation
│   └── roles/           # Role-specific documentation
├── pubspec.yaml         # Dependencies
└── README.md            # Project overview
\`\`\``;
  } else if (techString.includes('python') || techString.includes('django') || techString.includes('flask')) {
    structure += `## Python Project Structure

\`\`\`
${project.title.toLowerCase().replace(/\s+/g, '-')}/
├── app/                 # Main application package
│   ├── models/          # Data models
│   ├── views/           # View functions/classes
│   ├── controllers/     # Business logic
│   ├── utils/           # Utility functions
│   ├── templates/       # Templates for rendering
│   └── static/          # Static files (CSS, JS, images)
├── tests/               # Test files
├── docs/                # Documentation
│   └── roles/           # Role-specific documentation
├── requirements.txt     # Python dependencies
├── .env.example         # Example environment variables
└── README.md            # Project overview
\`\`\``;
  } else {
    structure += `## Generic Project Structure

\`\`\`
${project.title.toLowerCase().replace(/\s+/g, '-')}/
├── src/                 # Source code
│   ├── main/            # Main application code
│   ├── utils/           # Utility functions
│   ├── models/          # Data models
│   ├── services/        # Business logic
│   ├── controllers/     # Request handlers
│   └── config/          # Configuration
├── tests/               # Test files
├── docs/                # Documentation
│   └── roles/           # Role-specific documentation
├── README.md            # Project overview
└── dependencies file    # Project dependencies
\`\`\``;
  }
  
  return structure;
}