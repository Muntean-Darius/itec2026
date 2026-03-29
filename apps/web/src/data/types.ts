// ═══════════════════════════════════════════════════════════════════════════
// iTECify Data Types
// These types mirror the Prisma schema and are used throughout the app.
// ═══════════════════════════════════════════════════════════════════════════

export interface User {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  /** HSL color assigned for presence (e.g. "hsl(239, 84%, 67%)") */
  cursorColor: string
}

export interface Project {
  id: string
  name: string
  description: string | null
  language: string
  createdAt: string
  updatedAt: string
  ownerId: string
  collaborators: User[]
}

export interface FileNode {
  /** Full path e.g. "/src/components/Button.tsx" — flat map key */
  path: string
  content: string
  language: string
}

export interface PresenceUser extends User {
  /** File path the user is currently viewing */
  activeFile: string | null
  /** Cursor position in the active file */
  cursorPosition: { line: number; column: number } | null
  isTyping: boolean
  isOnline: boolean
  /** Terminal draft sharing */
  terminalSessionId?: string
  terminalDraft?: string
  /** Terminal cursor position (character offset in shared input) */
  terminalCursorPos?: number
  /** Active AI chat prompt being edited */
  aiPromptChatId?: string
  /** AI prompt cursor position (character offset in shared input) */
  aiPromptCursorPos?: number
}

export interface AIAgent {
  id: string
  name: string
  persona: string
  avatarUrl: string | null
  systemPrompt: string
  color: string
  isActive: boolean
}

export interface AIZoneBlock {
  id: string
  agentId: string
  filePath: string
  startLine: number
  endLine: number
  originalCode: string
  suggestedCode: string
  prompt: string
  status: "generating" | "pending" | "accepted" | "rejected"
}

export interface TerminalLine {
  id: string
  type: "stdin" | "stdout" | "stderr"
  content: string
  timestamp: string
  userId?: string
  cwd?: string
}

/** Snapshot kind for time-travel timeline visualization */
export type SnapshotKind = "cron" | "ai" | "human"

export interface Snapshot {
  id: string
  projectId: string
  createdAt: string
  label: string | null
  /** Number of lines changed since previous snapshot */
  changeCount: number
  userId: string
  userName?: string
  /** Type of snapshot for visual distinction in timeline */
  kind: SnapshotKind
  /** For AI snapshots: summary of the AI action (e.g., "Refactored Auth Flow") */
  promptSummary?: string
  /** File path affected (for tooltips) */
  filePath?: string
  /** Serialized file state at this snapshot (for time-travel preview) */
  fileStates?: Record<string, string>
}

// ─── AI Chat & Operations ────────────────────────────────────────────────

export interface FileOperation {
  type: "create" | "update" | "delete"
  path: string
  /** Full content for create; new full content for update; ignored for delete */
  content?: string
}

export type AIChatMessageRole = "user" | "assistant"

export interface AIChatMessage {
  id: string
  role: AIChatMessageRole
  content: string
  /** If assistant, the file operations it proposes */
  operations?: FileOperation[]
  /** Per-operation accept/reject status: "pending" | "accepted" | "rejected" */
  operationStatuses?: ("pending" | "accepted" | "rejected")[]
  /** Timestamp */
  timestamp: string
  /** User who sent (if role=user) */
  userId?: string
  userName?: string
}

export interface AIChatSession {
  id: string
  agentId: string
  agentName: string
  /** Custom chat name (suggested by AI or renamed by user) */
  name?: string
  messages: AIChatMessage[]
  /** Whether AI is currently generating a response */
  isGenerating: boolean
}
