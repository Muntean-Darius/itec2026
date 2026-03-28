// ═══════════════════════════════════════════════════════════════════════════
// iTECify Mock Data
// ─────────────────
// This file provides mock data that simulates what would come from
// Prisma/Supabase queries in React Server Components. Each export is
// an async function to mirror the real data-fetching pattern:
//
//   // Today (mock):
//   const projects = await getProjects()
//
//   // Tomorrow (real RSC):
//   const projects = await prisma.project.findMany({ where: { ... } })
// ═══════════════════════════════════════════════════════════════════════════

import type {
  User,
  Project,
  FileNode,
  PresenceUser,
  AIAgent,
  AIZoneBlock,
  TerminalLine,
  Snapshot,
  SnapshotKind,
} from "./types"

// ─── Users ───────────────────────────────────────────────────────────────────

export const currentUser: User = {
  id: "user-1",
  name: "Alex Chen",
  email: "alex@itecify.dev",
  avatarUrl: null,
  cursorColor: "hsl(239, 84%, 67%)",
}

export const mockUsers: User[] = [
  currentUser,
  {
    id: "user-2",
    name: "Jordan Riley",
    email: "jordan@itecify.dev",
    avatarUrl: null,
    cursorColor: "hsl(330, 70%, 60%)",
  },
  {
    id: "user-3",
    name: "Sam Patel",
    email: "sam@itecify.dev",
    avatarUrl: null,
    cursorColor: "hsl(150, 60%, 50%)",
  },
]

// ─── Projects ────────────────────────────────────────────────────────────────

export const mockProjects: Project[] = [
  {
    id: "proj-1",
    name: "iTECify Frontend",
    description: "The main collaborative coding sandbox frontend",
    language: "TypeScript",
    createdAt: "2026-03-25T10:00:00Z",
    updatedAt: "2026-03-28T14:30:00Z",
    ownerId: "user-1",
    collaborators: mockUsers,
  },
  {
    id: "proj-2",
    name: "API Server",
    description: "Express + WebSocket collaboration server",
    language: "TypeScript",
    createdAt: "2026-03-26T08:00:00Z",
    updatedAt: "2026-03-28T12:00:00Z",
    ownerId: "user-1",
    collaborators: [mockUsers[0], mockUsers[1]],
  },
  {
    id: "proj-3",
    name: "Landing Page",
    description: "Marketing site for iTECify launch",
    language: "TypeScript",
    createdAt: "2026-03-27T16:00:00Z",
    updatedAt: "2026-03-28T09:00:00Z",
    ownerId: "user-2",
    collaborators: [mockUsers[0], mockUsers[1], mockUsers[2]],
  },
]

// ─── File System (Flat Y.Map simulation) ─────────────────────────────────────

export const mockFiles: FileNode[] = [
  {
    path: "/src/index.tsx",
    language: "typescript",
    content: `import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import "./styles/global.css"

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
)

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)`,
  },
  {
    path: "/src/App.tsx",
    language: "typescript",
    content: `import { useState } from "react"
import { Header } from "./components/Header"
import { Sidebar } from "./components/Sidebar"
import { Editor } from "./components/Editor"

export default function App() {
  const [activeFile, setActiveFile] = useState("/src/index.tsx")

  return (
    <div className="flex h-screen bg-gray-900">
      <Sidebar onFileSelect={setActiveFile} />
      <div className="flex flex-1 flex-col">
        <Header />
        <Editor filePath={activeFile} />
      </div>
    </div>
  )
}`,
  },
  {
    path: "/src/components/Header.tsx",
    language: "typescript",
    content: `interface HeaderProps {
  title?: string
}

export function Header({ title = "iTECify" }: HeaderProps) {
  return (
    <header className="flex h-12 items-center border-b px-4">
      <h1 className="text-lg font-semibold">{title}</h1>
    </header>
  )
}`,
  },
  {
    path: "/src/components/Sidebar.tsx",
    language: "typescript",
    content: `interface SidebarProps {
  onFileSelect: (path: string) => void
}

export function Sidebar({ onFileSelect }: SidebarProps) {
  const files = [
    "/src/index.tsx",
    "/src/App.tsx",
    "/src/components/Header.tsx",
  ]

  return (
    <aside className="w-60 border-r bg-gray-950 p-2">
      <div className="mb-2 px-2 text-xs font-medium uppercase text-gray-500">
        Files
      </div>
      {files.map((file) => (
        <button
          key={file}
          onClick={() => onFileSelect(file)}
          className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-gray-800"
        >
          {file.split("/").pop()}
        </button>
      ))}
    </aside>
  )
}`,
  },
  {
    path: "/src/utils/helpers.ts",
    language: "typescript",
    content: `export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date)
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}`,
  },
  {
    path: "/package.json",
    language: "json",
    content: `{
  "name": "itecify-demo",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0"
  }
}`,
  },
  {
    path: "/tsconfig.json",
    language: "json",
    content: `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src"]
}`,
  },
  {
    path: "/README.md",
    language: "markdown",
    content: `# iTECify Demo Project

A sample project to demonstrate the collaborative coding sandbox.

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

## Features

- Real-time collaboration
- AI-assisted code generation
- Secure sandboxed execution
`,
  },
]

// ─── Presence ────────────────────────────────────────────────────────────────

export const mockPresence: PresenceUser[] = [
  {
    ...currentUser,
    activeFile: "/src/App.tsx",
    cursorPosition: { line: 8, column: 12 },
    isTyping: false,
    isOnline: true,
  },
  {
    ...mockUsers[1],
    activeFile: "/src/components/Header.tsx",
    cursorPosition: { line: 3, column: 5 },
    isTyping: true,
    isOnline: true,
  },
  {
    ...mockUsers[2],
    activeFile: null,
    cursorPosition: null,
    isTyping: false,
    isOnline: false,
  },
]

// ─── AI Agents ───────────────────────────────────────────────────────────────

export const mockAgents: AIAgent[] = [
  {
    id: "agent-1",
    name: "CodePilot",
    persona: "Full-Stack Assistant",
    avatarUrl: null,
    systemPrompt: "You are a helpful full-stack development assistant.",
    color: "hsl(172, 66%, 50%)",
    isActive: true,
  },
  {
    id: "agent-2",
    name: "SecurityBot",
    persona: "Security Auditor",
    avatarUrl: null,
    systemPrompt:
      "You are a security-focused code reviewer. Find vulnerabilities and suggest fixes.",
    color: "hsl(0, 62%, 55%)",
    isActive: false,
  },
  {
    id: "agent-3",
    name: "StyleGuard",
    persona: "Frontend Lead",
    avatarUrl: null,
    systemPrompt:
      "You are an expert frontend developer focused on React best practices and clean UI.",
    color: "hsl(270, 70%, 60%)",
    isActive: false,
  },
]

// ─── AI Zone Blocks ──────────────────────────────────────────────────────────

export const mockAIZoneBlocks: AIZoneBlock[] = [
  {
    id: "zone-1",
    agentId: "agent-1",
    filePath: "/src/App.tsx",
    startLine: 6,
    endLine: 10,
    originalCode: `  return (
    <div className="flex h-screen bg-gray-900">
      <Sidebar onFileSelect={setActiveFile} />
      <div className="flex flex-1 flex-col">
        <Header />`,
    suggestedCode: `  return (
    <div className="flex h-screen bg-background">
      <Sidebar onFileSelect={setActiveFile} activeFile={activeFile} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title={activeFile.split("/").pop()} />`,
    prompt: "Improve the layout structure and pass proper props",
    status: "pending",
  },
]

// ─── Terminal ────────────────────────────────────────────────────────────────

export const mockTerminalLines: TerminalLine[] = [
  {
    id: "t-1",
    type: "stdin",
    content: "npm run dev",
    timestamp: "2026-03-28T14:30:00Z",
    userId: "user-1",
  },
  {
    id: "t-2",
    type: "stdout",
    content: "\n  VITE v6.0.0  ready in 142 ms\n\n  ➜  Local:   http://localhost:5173/\n  ➜  Network: http://192.168.1.42:5173/\n  ➜  press h + enter to show help\n",
    timestamp: "2026-03-28T14:30:01Z",
  },
  {
    id: "t-3",
    type: "stdout",
    content: "[vite] hmr update /src/App.tsx",
    timestamp: "2026-03-28T14:31:15Z",
  },
]

// ─── Time-Travel Snapshots ───────────────────────────────────────────────────
// Generate 12 hours of snapshots with mixed types (cron every ~60s, AI & human checkpoints)

function generateMockSnapshots(): Snapshot[] {
  const now = new Date()
  const snapshots: Snapshot[] = []
  const users = ["user-1", "user-2", "user-3"]
  const files = ["/src/App.tsx", "/src/index.tsx", "/src/components/Header.tsx", "/src/utils/helpers.ts"]
  const baseFileStates = Object.fromEntries(mockFiles.map((f) => [f.path, f.content]))
  
  // AI prompt summaries for variety
  const aiPrompts = [
    "Refactored Auth Flow",
    "Added input validation",
    "Optimized render performance",
    "Fixed TypeScript errors",
    "Improved error handling",
    "Added accessibility attributes",
    "Extracted reusable hook",
    "Updated API endpoints",
  ]

  // Human save labels
  const humanLabels = [
    "Manual save before refactor",
    "Checkpoint: working state",
    "Pre-merge backup",
    "Feature complete",
    "Bug fix checkpoint",
  ]

  let snapId = 1
  
  // Generate snapshots going back 12 hours
  for (let hoursAgo = 12; hoursAgo >= 0; hoursAgo--) {
    const hourBase = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000)
    
    // Generate ~60 cron snapshots per hour (every 60 seconds)
    for (let min = 0; min < 60; min++) {
      const snapTime = new Date(hourBase.getTime() + min * 60 * 1000)
      
      // Skip future times
      if (snapTime > now) continue
      
      const userId = users[Math.floor(Math.random() * users.length)]
      const filePath = files[Math.floor(Math.random() * files.length)]
      
      // Randomly insert AI checkpoint (~5% chance)
      if (Math.random() < 0.05) {
        snapshots.push({
          id: `snap-${snapId++}`,
          projectId: "proj-1",
          createdAt: snapTime.toISOString(),
          label: null,
          changeCount: Math.floor(Math.random() * 50) + 10,
          userId,
          kind: "ai",
          promptSummary: aiPrompts[Math.floor(Math.random() * aiPrompts.length)],
          filePath,
          fileStates: baseFileStates,
        })
      }
      // Randomly insert human checkpoint (~2% chance)
      else if (Math.random() < 0.02) {
        snapshots.push({
          id: `snap-${snapId++}`,
          projectId: "proj-1",
          createdAt: snapTime.toISOString(),
          label: humanLabels[Math.floor(Math.random() * humanLabels.length)],
          changeCount: Math.floor(Math.random() * 30) + 5,
          userId,
          kind: "human",
          filePath,
          fileStates: baseFileStates,
        })
      }
      // Standard cron snapshot
      else {
        snapshots.push({
          id: `snap-${snapId++}`,
          projectId: "proj-1",
          createdAt: snapTime.toISOString(),
          label: null,
          changeCount: Math.floor(Math.random() * 15) + 1,
          userId,
          kind: "cron",
          filePath,
          fileStates: baseFileStates,
        })
      }
    }
  }
  
  return snapshots
}

export const mockSnapshots: Snapshot[] = generateMockSnapshots()

// ─── Async fetch wrappers (to be replaced with Prisma queries in RSC) ────────

/** @rsc Replace with: prisma.user.findUnique({ where: { id: session.userId } }) */
export async function getCurrentUser(): Promise<User> {
  return currentUser
}

/** @rsc Replace with: prisma.project.findMany({ where: { ... }, include: { collaborators: true } }) */
export async function getProjects(): Promise<Project[]> {
  return mockProjects
}

/** @rsc Replace with: prisma.project.findUnique({ where: { id }, include: { collaborators: true } }) */
export async function getProject(id: string): Promise<Project | null> {
  return mockProjects.find((p) => p.id === id) ?? null
}

/** @rsc Replace with: Read from Yjs server state or Supabase snapshot */
export async function getProjectFiles(_projectId: string): Promise<FileNode[]> {
  return mockFiles
}

/** @rsc Replace with: Yjs awareness protocol data */
export async function getPresence(_projectId: string): Promise<PresenceUser[]> {
  return mockPresence
}

/** @rsc Replace with: prisma.agent.findMany({ where: { projectId } }) */
export async function getAgents(_projectId: string): Promise<AIAgent[]> {
  return mockAgents
}

/** @rsc Replace with: prisma.snapshot.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' } }) */
export async function getSnapshots(_projectId: string): Promise<Snapshot[]> {
  return mockSnapshots
}
