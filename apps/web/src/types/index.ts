/* ═══════════════════════════════════════════════
   Shared type definitions for the iTECify frontend.
   These mirror the Prisma models but are plain TS
   interfaces usable in both Server & Client Components.
   ═══════════════════════════════════════════════ */

export interface Session {
  id: string
  name: string
  language: string
  ownerId: string
  createdAt: string
  joinCode?: string
}

export interface SessionUser {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  /** HSL color assigned for cursor / presence */
  color: string
  cursor?: { line: number; col: number }
  isOnline?: boolean
}

export interface FileTreeEntry {
  path: string
  type: "file" | "directory"
}

/** Language metadata — color in HSL, file extension */
export interface LangMeta {
  color: string
  ext: string
  monacoId: string
}
