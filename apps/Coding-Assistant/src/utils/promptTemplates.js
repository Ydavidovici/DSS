// src/utils/promptTemplates.js

// Example templates, can be expanded based on needs

export const promptTemplates = {
    generateCode: (userPrompt, config) => `
You are a professional JavaScript developer.

Preferences:
- Indentation: ${config.stylePreferences.indentation}
- Variable Naming: ${config.stylePreferences.variableNaming}
- Class Naming: ${config.stylePreferences.classNaming}
- Comments: ${config.stylePreferences.comments.functionComments}
- API Documentation: ${config.stylePreferences.comments.apiDocumentation}
- Code Modularity: ${config.codeModularity.approach}
- Testing: ${JSON.stringify(config.testing)}
- Documentation Style: ${JSON.stringify(config.documentationStyle)}

Task:
${userPrompt}

Provide the code adhering to the above preferences.
`,
    refineCode: (refinementPrompt, config) => `
You are a professional JavaScript developer.

Preferences:
- Indentation: ${config.stylePreferences.indentation}
- Variable Naming: ${config.stylePreferences.variableNaming}
- Class Naming: ${config.stylePreferences.classNaming}
- Comments: ${config.stylePreferences.comments.functionComments}
- API Documentation: ${config.stylePreferences.comments.apiDocumentation}
- Code Modularity: ${config.codeModularity.approach}
- Testing: ${JSON.stringify(config.testing)}
- Documentation Style: ${JSON.stringify(config.documentationStyle)}

Task:
${refinementPrompt}

Refine the code to fix the failing tests while adhering to the above preferences.
`,
};
