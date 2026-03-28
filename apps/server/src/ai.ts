// ═══════════════════════════════════════════════════════════════════════════
// iTECify — AI Utilities (Gemini)
// Central AI engine for code generation, refactoring, and merging.
// Used by the collaboration server to process AI chat requests.
// ═══════════════════════════════════════════════════════════════════════════

import { GoogleGenAI, Type } from "@google/genai"

// ─── Configuration ───────────────────────────────────────────────────────

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ""
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite"

const genai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })

// ─── Types ───────────────────────────────────────────────────────────────

export interface FileOperation {
  type: "create" | "update" | "delete"
  path: string
  /** Full content for create; new full content for update; ignored for delete */
  content?: string
}

export interface AIResponse {
  /** Natural language explanation of what the AI did */
  message: string
  /** File operations to apply */
  operations: FileOperation[]
  /** Suggested short chat name (only on first response in a conversation) */
  suggestedChatName?: string
}

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
  /** If assistant, the operations it proposed */
  operations?: FileOperation[]
}

// ─── Schema for structured output ────────────────────────────────────────

const FILE_OPERATION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    type: {
      type: Type.STRING,
      enum: ["create", "update", "delete"],
      description: "The type of operation to perform on the file.",
    },
    path: {
      type: Type.STRING,
      description: "The full file path starting with / (e.g. /src/utils/helpers.ts).",
    },
    content: {
      type: Type.STRING,
      description: "The full file content for create/update operations. Omit for delete.",
    },
  },
  required: ["type", "path"],
}

const AI_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    message: {
      type: Type.STRING,
      description: "A concise explanation of the changes you made and why.",
    },
    operations: {
      type: Type.ARRAY,
      items: FILE_OPERATION_SCHEMA,
      description: "The file operations to apply to the project.",
    },
    suggestedChatName: {
      type: Type.STRING,
      description: "A short (2-5 word) name for this chat conversation based on the topic. Only include this on the first message in a conversation.",
    },
  },
  required: ["message", "operations"],
}

// ─── System prompt ───────────────────────────────────────────────────────

function buildSystemPrompt(agentInstructions?: string): string {
  return `You are an expert AI coding assistant working inside iTECify, a collaborative coding platform.
You help users by creating, updating, and deleting files in their project.

RULES:
- When updating a file, provide the COMPLETE new file content, not just the changed parts.
- When creating a file, provide the full file content.
- For delete operations, only the path is needed.
- File paths always start with / (e.g. /src/index.tsx).
- Write clean, idiomatic, production-quality code.
- Keep your explanation concise but informative.
- If the user asks a question that doesn't require file changes, respond with a helpful message and an empty operations array.
- Consider the existing file contents and project structure when making changes.
- Do not modify files that don't need to change.
- On the first message in a conversation (when there is no chat history), include a "suggestedChatName" field with a short 2-5 word name summarizing the topic.
${agentInstructions ? `\nAGENT-SPECIFIC INSTRUCTIONS:\n${agentInstructions}` : ""}`
}

function buildProjectContext(
  files: Map<string, string>
): string {
  const parts: string[] = ["CURRENT PROJECT FILES:\n"]
  for (const [path, content] of files) {
    parts.push(`--- ${path} ---\n${content}\n`)
  }
  return parts.join("\n")
}

// ─── Streaming AI chat ───────────────────────────────────────────────────

/**
 * Stream an AI response for a chat message.
 * Yields partial text chunks as they arrive, returns the final parsed response.
 */
export async function streamAIChat(opts: {
  userMessage: string
  files: Map<string, string>
  chatHistory: ChatMessage[]
  agentInstructions?: string
  onTextChunk: (chunk: string) => void
}): Promise<AIResponse> {
  const { userMessage, files, chatHistory, agentInstructions, onTextChunk } = opts

  const systemPrompt = buildSystemPrompt(agentInstructions)
  const projectContext = buildProjectContext(files)

  // Build conversation history
  const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = []

  // Add project context as first user message
  contents.push({
    role: "user",
    parts: [{ text: `${projectContext}\n\n---\n\nUser request: ${chatHistory.length === 0 ? userMessage : chatHistory[0].content}` }],
  })

  // Add history (skip the first user message since it's already in contents)
  for (let i = 0; i < chatHistory.length; i++) {
    const msg = chatHistory[i]
    if (i === 0 && msg.role === "user") continue // already included above

    contents.push({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    })
  }

  // Add the new user message if there's history (otherwise it's already included)
  if (chatHistory.length > 0) {
    contents.push({
      role: "user",
      parts: [{ text: userMessage }],
    })
  }

  // Use streaming with generateContentStream
  const response = await genai.models.generateContentStream({
    model: GEMINI_MODEL,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      responseSchema: AI_RESPONSE_SCHEMA,
    },
    contents,
  })

  let fullText = ""

  for await (const chunk of response) {
    const text = chunk.text ?? ""
    if (text) {
      fullText += text
      onTextChunk(text)
    }
  }

  // Parse the final JSON response
  try {
    const parsed = JSON.parse(fullText) as AIResponse
    return parsed
  } catch {
    // If JSON parsing fails, return the raw text as message with no ops
    return {
      message: fullText || "I encountered an issue processing your request.",
      operations: [],
    }
  }
}

// ─── AI Merge ────────────────────────────────────────────────────────────

/**
 * Use AI to merge two conflicting file updates into a single coherent result.
 */
export async function mergeWithAI(opts: {
  filePath: string
  originalContent: string
  versionA: string
  versionB: string
  contextA: string
  contextB: string
}): Promise<{ merged: string; explanation: string }> {
  const { filePath, originalContent, versionA, versionB, contextA, contextB } = opts

  const prompt = `You need to merge two conflicting edits to the same file.

FILE: ${filePath}

ORIGINAL CONTENT:
\`\`\`
${originalContent}
\`\`\`

VERSION A (from: ${contextA}):
\`\`\`
${versionA}
\`\`\`

VERSION B (from: ${contextB}):
\`\`\`
${versionB}
\`\`\`

Merge both changes together intelligently. If changes are to different parts of the file, include both.
If changes conflict on the same lines, combine them in a way that preserves the intent of both.
Return the complete merged file content.`

  const response = await genai.models.generateContent({
    model: GEMINI_MODEL,
    config: {
      systemInstruction: "You are a code merge assistant. Merge the two versions and explain what you did.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          merged: { type: Type.STRING, description: "The complete merged file content." },
          explanation: { type: Type.STRING, description: "Brief explanation of how you merged the changes." },
        },
        required: ["merged", "explanation"],
      },
    },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  })

  const text = response.text ?? ""
  try {
    return JSON.parse(text) as { merged: string; explanation: string }
  } catch {
    return { merged: versionA, explanation: "Failed to merge automatically. Keeping version A." }
  }
}
