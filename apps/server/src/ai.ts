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

// ─── Run Command Detection ───────────────────────────────────────────────

export interface RunCommandResult {
  /** The command to execute (e.g. "npm run dev", "python main.py") */
  command: string
  /** Install command if dependencies need to be installed first (e.g. "npm install") */
  installCommand?: string
  /** Brief explanation of why this command was chosen */
  explanation: string
}

const RUN_COMMAND_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    command: {
      type: Type.STRING,
      description: "The exact shell command to run the project. For compiled languages, chain compile and execute with && (e.g. 'g++ -o app main.cpp && ./app', 'javac Main.java && java Main'). For interpreted languages, just the run command (e.g. 'npm run dev', 'python main.py'). Follow README instructions exactly when available.",
    },
    installCommand: {
      type: Type.STRING,
      description: "Only for projects that need a separate dependency install step (e.g. 'npm install', 'pip install -r requirements.txt'). Leave empty for Rust (cargo run handles building), Go (go run handles building), C/C++ (make handles building), and any project where the run command already compiles. NEVER use 'cargo install'.",
    },
    explanation: {
      type: Type.STRING,
      description: "A brief one-sentence explanation of why you chose this command.",
    },
  },
  required: ["command", "explanation"],
}

/**
 * Use an LLM to determine the best command to run a project.
 * Considers file structure, package.json scripts, README instructions,
 * IDE run configurations, and other heuristics.
 */
export async function detectRunCommand(opts: {
  files: Map<string, string>
  fileList: string[]
  previousRunCommand?: string
}): Promise<RunCommandResult> {
  const { files, fileList, previousRunCommand } = opts

  // Build a focused context with the most relevant files
  const relevantFiles: string[] = []
  const relevantPatterns = [
    "package.json", "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb",
    "requirements.txt", "pyproject.toml", "setup.py", "Pipfile",
    "Cargo.toml", "go.mod", "go.sum",
    "Makefile", "CMakeLists.txt",
    "README.md", "README.rst", "README.txt", "readme.md",
    ".vscode/launch.json", ".vscode/tasks.json",
    ".idea/runConfigurations",
    "Dockerfile", "docker-compose.yml", "docker-compose.yaml",
    "main.py", "app.py", "index.py", "manage.py",
    "main.go", "main.rs", "Main.java",
    "index.ts", "index.js", "main.ts", "main.js",
    "src/index.ts", "src/index.js", "src/main.ts", "src/main.js",
    "src/App.tsx", "src/App.jsx",
    "tsconfig.json", "vite.config.ts", "vite.config.js",
    "next.config.ts", "next.config.js", "next.config.mjs",
    "webpack.config.js", "rollup.config.js",
    "deno.json", "deno.jsonc",
  ]

  const contextParts: string[] = []
  contextParts.push("FILE LISTING (all files in the project):")
  contextParts.push(fileList.join("\n"))
  contextParts.push("")

  const readmeFiles: string[] = []

  for (const [path, content] of files) {
    const normalizedPath = path.startsWith("/") ? path.slice(1) : path
    const basename = normalizedPath.split("/").pop() ?? ""
    const isReadme = /^readme(\.(md|rst|txt))?$/i.test(basename)
    if (relevantPatterns.some(p => normalizedPath === p || normalizedPath.endsWith("/" + p) || basename === p)) {
      // Truncate large files (like lock files) to just the first part
      const maxChars = basename.includes("lock") ? 500 : 5000
      const truncated = content.length > maxChars ? content.slice(0, maxChars) + "\n... (truncated)" : content
      const entry = `--- ${normalizedPath} ---\n${truncated}`
      if (isReadme) {
        readmeFiles.push(entry)
      } else {
        relevantFiles.push(entry)
      }
    }
  }

  // Present README first — it has highest priority
  if (readmeFiles.length > 0) {
    contextParts.push("⚠️ README FILES (HIGHEST PRIORITY — follow these instructions exactly):")
    contextParts.push(readmeFiles.join("\n\n"))
    contextParts.push("")
  }

  if (relevantFiles.length > 0) {
    contextParts.push("OTHER RELEVANT FILE CONTENTS:")
    contextParts.push(relevantFiles.join("\n\n"))
  }

  const previousContext = previousRunCommand
    ? `\nPREVIOUS RUN COMMAND (the user previously ran this command successfully): ${previousRunCommand}\nUnless there's a good reason to change it (e.g. project structure changed significantly), prefer using this command again.\n`
    : ""

  const systemPrompt = `You are an expert at detecting how to run software projects.
Your job is to analyze a project's file structure and configuration files, then determine the best command to start/run the project.

RULES:
- **README instructions take absolute priority.** If a README file (README.md, README.txt, etc.) contains any instructions about how to build or run the project, follow them exactly — ignore all other heuristics (Makefile presence, file extensions, lock files, etc.) unless the README is silent on the matter.
- Only fall back to heuristics below when the README does NOT mention how to run the project.
- Choose the most appropriate run command based on the project type and structure.
- For Node.js projects: prefer "dev" or "start" scripts from package.json. Check if it's a Next.js, Vite, Express, etc. project.
- For Python projects: check for Django (manage.py runserver), Flask (python app.py / flask run), FastAPI (uvicorn), or plain scripts.
- For Go: use "go run ." or "go run main.go". ("go run" compiles and runs in one step — leave installCommand empty.)
- For Rust: use "cargo run". For Rust workspaces, use "cargo run --package <name>" or "cargo run --bin <name>". NEVER use "cargo install" — it tries to install binaries globally and will fail with permission errors. "cargo run" compiles and runs in one step — leave installCommand empty.
- For Java (no build system): compile first, then run — chain with &&. Example: "javac Main.java && java Main". If there are multiple .java files, compile all of them: "javac *.java && java Main". If Maven (pom.xml) is present, use "mvn compile exec:java -Dexec.mainClass=Main" or "mvn package && java -jar target/app.jar". If Gradle (build.gradle) is present, use "gradle run" or "./gradlew run".
- For C (no build system): compile then run — "gcc -o app main.c && ./app" (or list all .c files if multiple). If a Makefile exists, use "make" and then run the resulting binary (e.g. "make && ./app").
- For C++ (no build system): compile then run — "g++ -o app main.cpp && ./app" (or list all .cpp files if multiple). If a Makefile exists, use "make" and then run the resulting binary (e.g. "make && ./app").
- For C/C++ with CMake (CMakeLists.txt): "cmake -B build && cmake --build build && ./build/app" (adjust binary name as appropriate).
- Leave installCommand empty for compiled languages (Rust, Go, C, C++, Java without Maven/Gradle) — the compile step is part of the command itself.
- Detect the package manager: use npm if package-lock.json exists, yarn if yarn.lock exists, pnpm if pnpm-lock.yaml exists.
- If there's a Makefile with a "run" or "dev" target, prefer that (unless README overrides this).
- If .vscode/launch.json or .vscode/tasks.json exists, consider those configurations.
- Only provide installCommand when the project genuinely needs a separate dependency installation step (e.g. "npm install", "pip install -r requirements.txt"). Do NOT provide installCommand for languages where the build/run tool handles everything (Rust/cargo, Go, C/C++/make).
- The command will run inside a Docker container with Ubuntu 22.04 that has Node.js 20, Python 3, Java 17, Go, Rust, and C/C++ build tools pre-installed. All tools are on PATH.
- For web dev servers, prefer commands that bind to 0.0.0.0 so the port is accessible.
${previousContext}`

  const response = await genai.models.generateContent({
    model: GEMINI_MODEL,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      responseSchema: RUN_COMMAND_SCHEMA,
    },
    contents: [{ role: "user", parts: [{ text: contextParts.join("\n") }] }],
  })

  const text = response.text ?? ""
  try {
    return JSON.parse(text) as RunCommandResult
  } catch {
    // Fallback: try to guess from file structure
    return fallbackDetectRunCommand(files, fileList)
  }
}

/** Fallback heuristic-based detection when LLM fails */
function fallbackDetectRunCommand(files: Map<string, string>, fileList: string[]): RunCommandResult {
  const hasFile = (name: string) => fileList.some(f => {
    const normalized = f.startsWith("/") ? f.slice(1) : f
    return normalized === name || normalized.endsWith("/" + name)
  })
  const getFile = (name: string) => {
    for (const [path, content] of files) {
      const normalized = path.startsWith("/") ? path.slice(1) : path
      if (normalized === name) return content
    }
    return null
  }

  // Node.js
  const pkgJson = getFile("package.json")
  if (pkgJson) {
    try {
      const pkg = JSON.parse(pkgJson)
      const scripts = pkg.scripts ?? {}
      const pm = hasFile("yarn.lock") ? "yarn" : hasFile("pnpm-lock.yaml") ? "pnpm" : "npm"
      const installCmd = `${pm} install`

      if (scripts.dev) return { command: `${pm} run dev`, installCommand: installCmd, explanation: "Detected package.json with 'dev' script." }
      if (scripts.start) return { command: `${pm} ${pm === "npm" ? "run " : ""}start`, installCommand: installCmd, explanation: "Detected package.json with 'start' script." }
      if (scripts.serve) return { command: `${pm} run serve`, installCommand: installCmd, explanation: "Detected package.json with 'serve' script." }
    } catch { /* ignore parse errors */ }
  }

  // Python
  if (hasFile("manage.py")) return { command: "python manage.py runserver 0.0.0.0:8000", installCommand: hasFile("requirements.txt") ? "pip install -r requirements.txt" : undefined, explanation: "Detected Django project." }
  if (hasFile("app.py")) return { command: "python app.py", installCommand: hasFile("requirements.txt") ? "pip install -r requirements.txt" : undefined, explanation: "Detected Python app.py." }
  if (hasFile("main.py")) return { command: "python main.py", installCommand: hasFile("requirements.txt") ? "pip install -r requirements.txt" : undefined, explanation: "Detected Python main.py." }

  // Go
  if (hasFile("go.mod")) return { command: "go run .", explanation: "Detected Go module." }

  // Rust
  if (hasFile("Cargo.toml")) return { command: "cargo run", explanation: "Detected Rust/Cargo project." }

  // C/C++ with Makefile
  if (hasFile("Makefile")) return { command: "make && ./app", explanation: "Detected Makefile — running make then ./app." }

  // C++ without Makefile
  const cppFiles = fileList.filter(f => f.endsWith(".cpp"))
  if (cppFiles.length > 0) {
    const src = cppFiles.map(f => f.startsWith("/") ? f.slice(1) : f).join(" ")
    return { command: `g++ -o app ${src} && ./app`, explanation: "Detected C++ source files — compiling with g++ then running." }
  }

  // C without Makefile
  const cFiles = fileList.filter(f => f.endsWith(".c"))
  if (cFiles.length > 0) {
    const src = cFiles.map(f => f.startsWith("/") ? f.slice(1) : f).join(" ")
    return { command: `gcc -o app ${src} && ./app`, explanation: "Detected C source files — compiling with gcc then running." }
  }

  // Java — compile then run
  if (hasFile("Main.java")) return { command: "javac *.java && java Main", explanation: "Detected Java Main class — compiling then running." }

  return { command: "echo 'Could not detect how to run this project. Please run manually.'", explanation: "No recognizable project structure found." }
}
