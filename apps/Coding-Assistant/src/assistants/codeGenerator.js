// src/assistants/codeGenerator.js
import axios from 'axios';
import { logAction, logError } from '../utils/logger.js';
import { loadConfig } from '../config/config.js';

const config = loadConfig();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'; // Updated to ChatGPT endpoint

export async function generateInitialCode(prompt) {
    try {
        const response = await axios.post(
            OPENAI_API_URL,
            {
                model: 'gpt-4-turbo', // Use your preferred model
                messages: [
                    { role: 'system', content: buildSystemPrompt(config) },
                    { role: 'user', content: prompt },
                ],
                max_tokens: 1500, // Adjust as needed
                temperature: 0.2, // Lower temperature for more deterministic output
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${OPENAI_API_KEY}`,
                },
            }
        );

        const code = response.data.choices[0].message.content.trim();
        logAction('Generated initial code from OpenAI.');
        return code;
    } catch (error) {
        logError(`Error generating initial code: ${error.message}`);
        throw error;
    }
}

export async function refineCode(refinementPrompt, originalCode) {
    try {
        const response = await axios.post(
            OPENAI_API_URL,
            {
                model: 'gpt-4-turbo',
                messages: [
                    { role: 'system', content: buildSystemPrompt(config) },
                    { role: 'user', content: refinementPrompt },
                    { role: 'assistant', content: originalCode },
                ],
                max_tokens: 1500,
                temperature: 0.2,
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${OPENAI_API_KEY}`,
                },
            }
        );

        const refinedCode = response.data.choices[0].message.content.trim();
        logAction('Refined code using OpenAI.');
        return refinedCode;
    } catch (error) {
        logError(`Error refining code: ${error.message}`);
        throw error;
    }
}

function buildSystemPrompt(config) {
    const {
        stylePreferences,
        codeModularity,
        testing,
        documentationStyle,
    } = config;

    return `
    You are a professional JavaScript developer with expertise in ${stylePreferences.indentation} indentation, ${stylePreferences.variableNaming} variable naming, and ${stylePreferences.classNaming} class naming conventions.
    
    Preferences:
    - Indentation: ${stylePreferences.indentation}
    - Variable Naming: ${stylePreferences.variableNaming}
    - Class Naming: ${stylePreferences.classNaming}
    - Function Comments: ${stylePreferences.comments.functionComments}
    - API Documentation: ${stylePreferences.comments.apiDocumentation}
    - Code Modularity: ${codeModularity.approach}
    - Testing: ${JSON.stringify(testing)}
    - Documentation Style: ${JSON.stringify(documentationStyle)}
    
    Ensure that the code adheres to these preferences.
    `;
}
