import { ProjectPlan, ProjectExpansionPlan, RepositoryEditPlan } from '../types';

// Updated to use the exhaustive list for the Autonomous Architect swarm
export const primaryModels = [
  "gemini-3.1-pro-preview",
  "gemini-3.1-flash-lite-preview",
  "gemini-3-pro-preview",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash-preview-09-2025",
  "gemini-2.5-flash-lite-preview-09-2025",
  "gemini-2.0-flash",
  "gemini-2.0-flash-001",
  "gemini-2.0-flash-exp",
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash-lite-001",
  "gemini-2.0-flash-lite-preview",
  "gemini-2.0-flash-lite-preview-02-05",
  "gemini-pro-latest",
  "gemini-exp-1206",
  "gemma-3-27b-it",
  "gemma-3-12b-it",
  "gemma-3-4b-it",
  "gemma-3-1b-it",
  "gemma-3n-e4b-it",
  "gemma-3n-e2b-it"
];

// FALLBACK MODELS: Redundancy for the SAVE America Infrastructure
export const fallbackModels = [
    "gemini-1.5-flash-8b",
    "gemini-1.0-pro",
    "gemma-2-27b-it",
    "gemma-2-9b-it"
];

export const modelsToUse = [...primaryModels, ...fallbackModels];

const MAX_CONTEXT_CHARACTERS = 4000000; // Cap to prevent token limit errors, approx 250k tokens.

// Mutable variable to store the API key provided by the UI
let geminiApiKey = '';

export const setGeminiApiKey = (key: string) => {
    geminiApiKey = key;
};

// Helper function to intelligently build file context without exceeding token limits
const prepareFileContext = (
    allFiles: { path: string, content: string }[],
    activeFilePath?: string
): string => {
    let context = '';
    let remainingChars = MAX_CONTEXT_CHARACTERS;
    
    const filesWithHeaders = allFiles.map(f => {
        const header = `--- START OF FILE ${f.path} ---\n`;
        const footer = `\n`;
        const fullContent = header + f.content + footer;
        return { ...f, fullContent, length: fullContent.length };
    });

    const activeFile = activeFilePath ? filesWithHeaders.find(f => f.path === activeFilePath) : null;
    const otherFiles = filesWithHeaders.filter(f => !activeFilePath || f.path !== activeFilePath);

    // Prioritize active file
    if (activeFile && activeFile.length <= remainingChars) {
        context += activeFile.fullContent;
        remainingChars -= activeFile.length;
    }

    // Add other files until limit is reached
    for (const file of otherFiles) {
        if (file.length <= remainingChars) {
            context += file.fullContent;
            remainingChars -= file.length;
        } else {
            // Stop when we can't fit the next full file
            break;
        }
    }
    
    return context;
};

/**
 * Removes markdown code fences from a string.
 * e.g., "```tsx\nconst a = 1;\n```" -> "const a = 1;"
 * @param rawContent The raw string from the AI, which may contain code fences.
 * @returns The cleaned code string.
 */
export const cleanAiCodeResponse = (rawContent: string): string => {
  if (!rawContent) return '';
  let cleaned = rawContent.trim();
  
  // This regex handles ```, ```json, ```typescript, etc. at the beginning of the string
  const startFenceRegex = /^```\w*\s*\n/;
  // This regex handles ``` at the end of the string
  const endFenceRegex = /\n```$/;

  cleaned = cleaned.replace(startFenceRegex, '');
  cleaned = cleaned.replace(endFenceRegex, '');
  
  return cleaned.trim();
};

async function streamAiResponse(
    model: string,
    prompt: string | (string | { type: string; text: string })[],
    onChunk: (chunk: string) => void,
    getFullResponse: () => string
): Promise<void> {
    const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-gemini-key': geminiApiKey
        },
        body: JSON.stringify({
            TargetModel: model,
            prompt: typeof prompt === 'string' ? prompt : JSON.stringify(prompt),
            isStream: true,
            config: {
                temperature: 0.1,
                topP: 0.95,
                topK: 64
            }
        })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to stream AI response');
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No reader available');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.text) {
                        onChunk(parsed.text);
                    }
                } catch (e) {
                    console.error('Error parsing stream chunk', e);
                }
            }
        }
    }
}

async function getAiJsonResponse<T>(
    model: string,
    prompt: string,
    schema: any
): Promise<T> {
    const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-gemini-key': geminiApiKey
        },
        body: JSON.stringify({
            TargetModel: model,
            prompt,
            isStream: false,
            config: {
                responseMimeType: 'application/json',
                responseSchema: schema,
                temperature: 0.0,
                topP: 0.95,
                topK: 64
            }
        })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to get AI JSON response');
    }

    const result = await response.json();
    return JSON.parse(result.text.trim()) as T;
}


export const bulkEditFileWithAI = async (
  originalContent: string,
  instruction: string,
  filePath: string,
  onChunk: (chunk: string) => void,
  getFullResponse: () => string,
  model: string,
): Promise<void> => {
  const prompt = `
    You are an expert AI programmer. Your task is to modify a file based on a high-level instruction.

    **HYPER-AGGRESSIVE RESEARCH REQUIREMENT:**
    You MUST use Google Search to perform an exhaustive deep-dive into the instruction: "${instruction}".
    - Pull from at least 10+ distinct authoritative sources (MDN, official GitHub repositories, documentation sites, technical whitepapers).
    - Research the LATEST stable versions of all included libraries.
    - If this is part of a multi-file edit, ensure you cross-reference the research across ALL files to maintain a unified architectural vision.
    - Do NOT stop at the first result. Look for the most modern, optimized, and secure implementation patterns (e.g., Performance, Accessibility, Scalability).

    **CRITICAL RULE: Your entire response must be ONLY the raw source code for the file.**
    - Do NOT output markdown code fences (like \`\`\`tsx), any explanatory text, or any preamble.
    - Your response will be saved directly to a file, so it must be 100% valid code.
    - If the instruction does not require any changes to this specific file, return the original content verbatim.
    - Ensure the new code is syntactically correct and preserves the overall structure and logic where appropriate.

    Instruction: "${instruction}"
    File Path: "${filePath}"
    Original Content:
    ---
    ${originalContent}
    ---
  `;
  await streamAiResponse(model, prompt, onChunk, getFullResponse);
};


export const generateProjectPlan = async (
    prompt: string,
    model: string
): Promise<ProjectPlan> => {
    const promptForAI = `
        You are a 10x software architect. A user wants to create a new project.
        Your task is to analyze their prompt and generate a file structure and a brief description for each file.
        - The user prompt is: "${prompt}"
        - Based on the prompt, create a logical file structure.
        - For each file, provide a concise one-sentence description of its purpose.
        - The output must be a JSON object that adheres to the provided schema.
        - Only include files that would contain code or text. Do not include directories as separate entries.
        - Be comprehensive. Create all the necessary files for a basic, runnable version of the described project.
    `;
    const schema = {
        type: "object",
        properties: {
            files: {
                type: "array",
                description: 'A list of files to be created for the project.',
                items: {
                    type: "object",
                    properties: {
                        path: {
                            type: "string",
                            description: 'The full path of the file, including directories. E.g., "src/components/Button.tsx".'
                        },
                        description: {
                            type: "string",
                            description: 'A concise, one-sentence description of what this file will contain or its purpose.'
                        }
                    },
                    required: ['path', 'description']
                }
            }
        },
        required: ['files']
    };
    return getAiJsonResponse<ProjectPlan>(model, promptForAI, schema);
};


export const generateFileContent = async (
    projectPrompt: string,
    filePath: string,
    fileDescription: string,
    onChunk: (chunk: string) => void,
    getFullResponse: () => string,
    model: string
): Promise<void> => {
    const prompt = `
        You are an expert AI programmer generating code for a new project.
        The overall project goal is: "${projectPrompt}"
        You are creating the file at this path: "${filePath}"
        The purpose of this file is: "${fileDescription}"

        **DEEP-RESEARCH INTEGRITY:**
        Perform a comprehensive web search to identify the most stable, secure, and performant versions of all libraries required for "${projectPrompt}". 
        - Analyze multiple implementation patterns (e.g., Hooks vs. Context vs. Logic isolation).
        - Ensure the code follows the absolute "Gold Standard" of current industry best practices.
        - The resulting file must be ready for a high-traffic production environment.

        Your task is to generate the complete, production-quality code for this single file.
        
        **CRITICAL RULE: Your entire response must be ONLY the raw source code for the file.**
        - Do NOT output markdown code fences (like \`\`\`tsx), any explanatory text, or any preamble.
        - Your response will be saved directly to a file, so it must be 100% valid code.
        - The code should be fully functional and align with the file's described purpose within the larger project.
    `;
    await streamAiResponse(model, prompt, onChunk, getFullResponse);
};


export const planProjectExpansionEdits = async (
    seedFiles: { path: string, content: string }[],
    randomFiles: { path: string, content: string }[],
    prompt: string,
    model: string,
    focusArea?: string
): Promise<ProjectExpansionPlan> => {
    const seedContext = seedFiles.map(f => `--- START OF SEED FILE ${f.path} ---\n${f.content}\n`).join('');
    const randomContext = randomFiles.map(f => `--- START OF REPO CONTEXT ${f.path} ---\n${f.content}\n`).join('');

    const promptForAI = `
        You are an Omega-Level AI Software Architect specializing in massive-scale hyper-growth project expansions.
        Your task is to analyze a set of SEED files and the overall REPOSITORY context, then plan a MASSIVE expansion that scales the system by orders of magnitude.

        **USER GOAL:** "${prompt}"

        **SWARM FOCUS AREA:** ${focusArea || 'General Global Expansion'}
        (You are part of a swarm. Focus your planned files on this specific architectural domain to prevent redundancy with other agents.)

        **CONTEXT PROVIDED:**
        1. **SEED FILES**: ${seedFiles.length} files selected by the user as the functional core for expansion.
        2. **REPO CONTEXT**: 50 random files providing the architectural blueprint.

        **CRITICAL OBJECTIVES:**
        1. **UNRESTRICTED SCALE**: Do NOT be conservative. If the goal is massive expansion, plan for 20-50 batches of 10 files each. We want HUNDREDS of files that form a rich, interconnected ecosystem.
        2. **RESEARCH-FIRST PLANNING**: Use Google Search to analyze the existing libraries in the repo context and find their most powerful, underutilized features to include in the expansion.
        3. **COHESIVE BATCHING**: Group new files into clusters (EXACTLY 10 files). Each cluster must be a functional "Vertical Slice" (e.g., "Full Authentication Backend", "Interactive Dashboard Tier", "Real-time Notification Layer").
        4. **GLOBAL SWARM COORDINATION**: Distribute across Agent Indexes (0 to 127). Ensure the plan describes how these parts talk to each other to avoid overlap.
        5. **CONSISTENCY & QUALITY**: Every file MUST follow the architectural blueprint from the repo context.
        6. **DEEP EXPLANATION**: In your 'reasoning', be extremely verbose. Detail every architectural decision, library choice, and inter-file relationship.
        
        **OUTPUT REQUIREMENTS:**
        - A JSON object with 'reasoning' and 'batches'.
        - Aim for MAX VOLUME. If you can think of a feature that adds value, add a batch for it. We want HUNDREDS of files.
        - Ensure EVERY batch has exactly 10 files unless the domain is truly exhausted.

        **SEED FILES SUMMARY:**
        ${seedContext.slice(0, 500000)} ${seedContext.length > 500000 ? '...[TRUNCATED FOR TOKENS]...' : ''}

        **REPOSITORY CONTEXT:**
        ${randomContext.slice(0, 500000)}
    `;
    const schema = {
        type: "object",
        properties: {
            reasoning: { type: "string", description: 'Architectural explanation.' },
            batches: {
                type: "array",
                description: 'A list of batches to be generated.',
                items: {
                    type: "object",
                    properties: {
                        agentIndex: { type: "number", description: 'Agent index (0-22) assigned to this batch.' },
                        files: {
                            type: "array",
                            description: 'Files in this batch. Max 10 per batch.',
                            items: {
                                type: "object",
                                properties: {
                                    path: { type: "string", description: 'Full path of the new file.' },
                                    description: { type: "string", description: 'Purpose and content of the file.' }
                                },
                                required: ['path', 'description']
                            }
                        }
                    },
                    required: ['agentIndex', 'files']
                }
            }
        },
        required: ['reasoning', 'batches']
    };
    return getAiJsonResponse<ProjectExpansionPlan>(model, promptForAI, schema);
};

export const generateMultipleFilesContent = async (
    projectPrompt: string,
    batch: { path: string, description: string }[],
    onChunk: (chunk: string) => void,
    model: string
): Promise<{ files: { path: string, content: string }[], explanation: string }> => {
    const batchDescription = batch.map(f => `- ${f.path}: ${f.description}`).join('\n');
    const prompt = `
        You are an expert AI programmer generating multiple files for a project expansion.
        The overall project goal is: "${projectPrompt}"
        
        **YOUR TASK:**
        1. Analyze the required files and provide a detailed 3-5 sentence explanation of how these files integrate into the project and the libraries/patterns you are using.
        2. Generate content for the following ${batch.length} files:
        ${batchDescription}

        **OUTPUT FORMAT:**
        You MUST output a valid JSON object with detailed source code.
        Example:
        {
          "explanation": "...",
          "files": [
            { "path": "src/file1.ts", "content": "..." },
            { "path": "src/file2.ts", "content": "..." }
          ]
        }

        **STRICT RULES:**
        1. Output ONLY the JSON. No preamble, no markdown fences.
        2. The content of each file should be the raw source code.
    `;
    
    // We use getAiJsonResponse for structured output
    const schema = {
        type: "object",
        properties: {
            explanation: { type: "string", description: 'Explanation of this batch and its architectural role.' },
            files: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        path: { type: "string" },
                        content: { type: "string" }
                    },
                    required: ['path', 'content']
                }
            }
        },
        required: ['explanation', 'files']
    };
    
    // Since streaming logic is complex for JSON, we use getAiJsonResponse directly
    const result = await getAiJsonResponse<{ files: { path: string, content: string }[], explanation: string }>(model, prompt, schema);
    onChunk(JSON.stringify(result, null, 2));
    return result;
};

export const streamSingleFileEdit = async (
    originalContent: string,
    instruction: string,
    filePath: string,
    onChunk: (chunk: string) => void,
    model: string
): Promise<void> => {
    const prompt = `
        You are an AI code assistant. Rewrite the following file content based on the user's instruction.

        **CRITICAL RULE: Your entire response must be ONLY the new, complete file content.**
        - Do NOT output markdown code fences (e.g., \`\`\`).
        - The output will be saved directly to a file, so it must be clean.

        Instruction: "${instruction}"
        File Path: "${filePath}"
        Original Content:
        ---
        ${originalContent}
        ---
    `;
    await streamAiResponse(model, prompt, onChunk, () => ''); // getFullResponse not needed here as parent handles it.
};


export const planRepositoryEdit = async (
    instruction: string,
    activeFilePath: string,
    allFiles: { path: string, content: string, sha: string }[],
    model: string
): Promise<RepositoryEditPlan> => {

    const fileContext = prepareFileContext(allFiles, activeFilePath);

    const promptForAI = `
        You are an autonomous AI software engineer. Your task is to implement a user's request by planning a series of file edits.
        
        **CRITICAL DIRECTIVE:**
        You have complete and unrestricted access to the full source code of every file in the repository, provided below. 
        You MUST use this context to inform your plan. Do not, under any circumstances, claim you cannot see a file or that the code is incomplete. Base your entire plan on the provided code.

        **User Request:** "${instruction}"
        (The user was viewing this file when they made the request: "${activeFilePath}")

        **DEEP RESEARCH INJUNCTION:**
        You MUST use Google Search to exhaustively research: "${instruction}".
        - Scan the latest v2026/2027 documentation for all libraries in the context.
        - Identify potential architectural conflicts before they happen.
        - Plan for SCALE: If the user request implies a large feature, plan for MANY files, not just 1 or 2.

        **Your Task:**
        1.  **Reasoning:** Explain your deep-research findings and architectural strategy. Identify which files will be created or edited to ensure a robust system.
        2.  **filesToEdit:** Create a precise, massive list of files. For each, provide granular, non-repetitive change instructions. Use your research to guide specific implementation details (e.g., "Use the new AsyncLocalStorage API for session tracking as per latest Node.js docs").

        Your output must be a single JSON object that strictly follows the provided schema.

        **These are the existing files in the app:**
        ${fileContext}
    `;

    const schema = {
        type: "object",
        properties: {
            reasoning: {
                type: "string",
                description: "A high-level explanation of your plan, which files you will edit, and why."
            },
            filesToEdit: {
                type: "array",
                description: 'A list of files to modify and the specific changes for each.',
                items: {
                    type: "object",
                    properties: {
                        path: { type: "string", description: 'Path of the file to edit.' },
                        changes: { type: "string", description: 'Detailed, step-by-step instructions for the code modifications.' }
                    },
                    required: ['path', 'changes']
                }
            }
        },
        required: ['reasoning', 'filesToEdit']
    };
    return getAiJsonResponse<RepositoryEditPlan>(model, promptForAI, schema);
};


export const streamRepositoryFileEdit = async (
    originalContent: string,
    changesInstruction: string,
    filePath: string,
    onChunk: (chunk: string) => void,
    model: string
): Promise<void> => {
    const prompt = `
        You are an expert AI programmer. Your task is to meticulously modify a single file based on a detailed change instruction.
        
        **CRITICAL RULE: Your entire response must be ONLY the new, complete, raw source code for the file.**
        - Do NOT output markdown code fences (like \`\`\`tsx), any explanatory text, or any preamble.
        - Your response will be saved directly to a file, so it must be 100% valid code.
        - Follow the instructions exactly to produce the final version of the file.

        Instruction: "${changesInstruction}"
        File Path: "${filePath}"
        Original Content:
        ---
        ${originalContent}
        ---
    `;
    await streamAiResponse(model, prompt, onChunk, () => '');
};

export const correctCodeFromBuildError = async (
    originalInstruction: string,
    allFiles: { path: string, content: string, sha: string }[],
    previousEdits: { path: string, newContent: string }[],
    buildLogs: string,
    model: string,
): Promise<RepositoryEditPlan> => {

    const fileContext = prepareFileContext(allFiles);

    const previousEditsContext = previousEdits.map(e => 
        `I previously tried to edit "${e.path}" to have this content:\n---\n${e.newContent}\n---\n`
    ).join('\n');

    const promptForAI = `
        You are an autonomous AI software engineer. Your previous attempt to modify the code resulted in a failed build. Your task is to analyze the build logs, understand the error, and create a NEW plan to fix it.

        **CRITICAL DIRECTIVE:**
        You have complete and unrestricted access to the full source code of every file in the repository, provided below. 
        You MUST use this context. Do not claim you cannot see a file or that the code is truncated. Your fix must be based on the actual code provided.

        **Original User Request:** "${originalInstruction}"

        **Build Error Logs:**
        ---
        ${buildLogs}
        ---

        **My Previous (Failed) Edits:**
        ${previousEditsContext}
        
        **Your Corrective Task:**
        1.  **Analyze & Reason:** Read the build logs and my previous edits. In a few sentences, explain the root cause of the build failure. Then, describe your new plan to fix the code.
        2.  **filesToEdit:** Create a new, precise list of files to edit to fix the error. For each file, provide a detailed, step-by-step description of the exact changes needed. This plan will completely replace the previous one. If you need to revert a change in one file and edit another, specify both actions.

        Your output must be a single JSON object that strictly follows the provided schema.

        **These are the current files in the app (reflecting your previous failed attempt):**
        ${fileContext}
    `;

    const schema = {
        type: "object",
        properties: {
            reasoning: {
                type: "string",
                description: "An analysis of the build failure and a high-level explanation of your new plan to fix it."
            },
            filesToEdit: {
                type: "array",
                description: 'A new list of files to modify and the specific changes for each to fix the build.',
                items: {
                    type: "object",
                    properties: {
                        path: { type: "string", description: 'Path of the file to edit.' },
                        changes: { type: "string", description: 'Detailed, step-by-step instructions for the new code modifications.' }
                    },
                    required: ['path', 'changes']
                }
            }
        },
        required: ['reasoning', 'filesToEdit']
    };
    return getAiJsonResponse<RepositoryEditPlan>(model, promptForAI, schema);
};