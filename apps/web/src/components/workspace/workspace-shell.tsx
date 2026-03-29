"use client"

import { useState, useCallback, useEffect, useRef, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelBottomClose,
  PanelBottomOpen,
  Play,
  Square,
  Share2,
  ArrowLeft,
  History,
  Pencil,
  Check,
  X,
  Copy,
  CheckCheck,
  Trash2,
  ClipboardCopy,
  FolderTree,
  Search,
  FolderGit2,
} from "lucide-react"
import Link from "next/link"
import type { User, Project, FileNode, PresenceUser, AIAgent, Snapshot } from "@/data/types"
import { updateProject, createSnapshot } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ResizeHandle } from "@/components/ui/resize-handle"
import { PresenceDock } from "./presence-dock"
import { FileTree, getFileIcon } from "./file-tree"
import { CodeEditor, type AIBlock, type RecentAIAccept, type RecentAIUndo } from "./code-editor"
import { TerminalPanel } from "./terminal-panel"
import { CommandPalette } from "./command-palette"
import { TimeTravelSlider } from "./time-travel-slider"
import { AgentRoster } from "./agent-roster"
import { AIInlinePrompt } from "./ai-inline-prompt"
import { AIPanel } from "./ai-panel"
import { SourceControlPanel } from "./source-control-panel"
import { SearchPanel } from "./search-panel"
import { BranchSelector } from "./branch-selector"
import { SyncIndicator } from "./sync-indicator"
import { DiffViewer } from "./diff-viewer"
import { GitProvider, useGitOptional } from "@/lib/git"
import { useCollaboration } from "@/lib/collaboration"
import { cn } from "@/lib/utils"
import { getWorkspaceInviteUrl } from "@/lib/workspace-share"

interface WorkspaceShellProps {
  project: Project
  initialFiles: FileNode[]
  initialPresence: PresenceUser[]
  currentUser: User
  agents: AIAgent[]
  snapshots: Snapshot[]
  initialGitCredentials?: {
    username: string
    password: string
  }
}

// Size constraints
const SIDEBAR_MIN = 180
const SIDEBAR_MAX = 400
const SIDEBAR_DEFAULT = 260
const TERMINAL_MIN = 80
const TERMINAL_MAX = 500
const TERMINAL_DEFAULT = 300
const AGENT_PANEL_MIN = 220
const AGENT_PANEL_MAX = 400
const AGENT_PANEL_DEFAULT = AGENT_PANEL_MAX

export function WorkspaceShell({
  project,
  initialFiles,
  initialPresence,
  currentUser,
  agents,
  snapshots,
  initialGitCredentials,
}: WorkspaceShellProps) {
  // Real-time collaboration
  const collab = useCollaboration({
    projectId: project.id,
    currentUser,
    initialFiles,
  })

  // Use collab files + presence, with initialPresence as fallback
  const liveFiles = collab.files.length > 0 ? collab.files : initialFiles
  const livePresence = collab.presence.length > 0 ? collab.presence : initialPresence
  const [timelineSnapshots, setTimelineSnapshots] = useState<Snapshot[]>(
    () =>
      [...snapshots].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
  )

  const [activeFilePath, setActiveFilePath] = useState<string>(
    initialFiles[0]?.path ?? ""
  )
  const [openFiles, setOpenFiles] = useState<string[]>(
    initialFiles.length > 0 ? [initialFiles[0].path] : []
  )

  // Panel toggles
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [terminalOpen, setTerminalOpen] = useState(true)
  const [agentRosterOpen, setAgentRosterOpen] = useState(false)
  const [sidebarTab, setSidebarTab] = useState<"files" | "search" | "git">("files")
  const [diffViewPath, setDiffViewPath] = useState<string | null>(null)

  // Panel sizes (resizable)
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT)
  const [terminalHeight, setTerminalHeight] = useState(TERMINAL_DEFAULT)
  const [agentPanelWidth, setAgentPanelWidth] = useState(AGENT_PANEL_DEFAULT)

  // Workspace state
  const [timeTravelActive, setTimeTravelActive] = useState(false)
  const [timeTravelSnapshot, setTimeTravelSnapshot] = useState<Snapshot | null>(null)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [aiPromptOpen, setAiPromptOpen] = useState(false)
  const [createFileTrigger, setCreateFileTrigger] = useState(0)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [tabContextMenu, setTabContextMenu] = useState<{ x: number; y: number; path: string } | null>(null)
  const [editorRevealLine, setEditorRevealLine] = useState<number | null>(null)
  const shareUrl = typeof window !== "undefined"
    ? getWorkspaceInviteUrl(project.id, window.location.origin)
    : ""

  useEffect(() => {
    setTimelineSnapshots(
      [...snapshots].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
    )
  }, [snapshots])

  const resolveSnapshotFileStates = useCallback(
    (snapshot: Snapshot | null): Record<string, string> | null => {
      if (!snapshot) return null

      // Find raw fileStates from the snapshot or walk back through timeline
      let raw = snapshot.fileStates
      if (!raw) {
        const idx = timelineSnapshots.findIndex((s) => s.id === snapshot.id)
        if (idx === -1) return null
        for (let i = idx - 1; i >= 0; i--) {
          if (timelineSnapshots[i].fileStates) {
            raw = timelineSnapshots[i].fileStates
            break
          }
        }
      }
      if (!raw) return null

      // Normalize all keys to have a leading "/" so they match the convention
      // used by syncFilesFromDoc, buildTree, and the rest of the UI.
      // Server cron snapshots store keys WITHOUT "/" (raw Yjs map keys),
      // while client snapshots store keys WITH "/".
      const normalized: Record<string, string> = {}
      for (const [path, content] of Object.entries(raw)) {
        const key = path.startsWith("/") ? path : "/" + path
        normalized[key] = content
      }
      return normalized
    },
    [timelineSnapshots]
  )

  // When time-traveling, show historical files from the selected snapshot state.
  // Otherwise fall back to current files.
  const files = useMemo(() => {
    const resolvedFileStates = resolveSnapshotFileStates(timeTravelSnapshot)
    if (timeTravelActive && resolvedFileStates) {
      // Convert snapshot fileStates to FileNode array
      return Object.entries(resolvedFileStates).map(([path, content]) => ({
        path,
        content,
        language: path.endsWith(".ts") || path.endsWith(".tsx")
          ? "typescript"
          : path.endsWith(".js") || path.endsWith(".jsx")
            ? "javascript"
            : path.endsWith(".json")
              ? "json"
              : path.endsWith(".md")
                ? "markdown"
                : "plaintext",
      }))
    }
    return liveFiles
  }, [timeTravelActive, timeTravelSnapshot, liveFiles, resolveSnapshotFileStates])

  // Active terminal session
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null)

  // AI streaming messages: messageId → accumulated text
  const [streamingMessages, setStreamingMessages] = useState<Record<string, string>>({})

  // Recent AI accepts for quick-undo (expires after 15 seconds)
  const [recentAIAccepts, setRecentAIAccepts] = useState<RecentAIAccept[]>([])

  // Recent AI undos for redo (expires after 15 seconds)
  const [recentAIUndos, setRecentAIUndos] = useState<RecentAIUndo[]>([])

  // Listen for snapshot broadcasts from other clients
  useEffect(() => {
    const unsub = collab.onSnapshotCreated((data: { snapshot: Record<string, unknown> }) => {
      const snap = data.snapshot as unknown as Snapshot
      if (!snap?.id) return
      setTimelineSnapshots((prev) => {
        // Skip if we already have this snapshot
        if (prev.some((s) => s.id === snap.id)) return prev
        return [...prev, snap].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )
      })
    })
    return unsub
  }, [collab])

  // Cleanup expired accepts and undos periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      setRecentAIAccepts((prev) =>
        prev.filter((a) => now - a.acceptedAt < 15000)
      )
      setRecentAIUndos((prev) =>
        prev.filter((u) => now - u.undoneAt < 15000)
      )
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  // Subscribe to AI stream chunks
  useEffect(() => {
    const unsub = collab.onAIStreamChunk((data: { chatId: string; messageId: string; chunk: string; done?: boolean }) => {
      if (data.done) {
        // Remove streaming entry once finalized
        setStreamingMessages((prev) => {
          const next = { ...prev }
          delete next[data.messageId]
          return next
        })
      } else {
        setStreamingMessages((prev) => ({
          ...prev,
          [data.messageId]: (prev[data.messageId] ?? "") + data.chunk,
        }))
      }
    })
    return unsub
  }, [collab])

  // Editable project info — initialised from project, then synced with collab.meta
  const [editingTitle, setEditingTitle] = useState(false)
  const [projectName, setProjectName] = useState(project.name)
  const [projectDescription, setProjectDescription] = useState(project.description ?? "")
  const titleInputRef = useRef<HTMLInputElement>(null)

  // Sync meta from Yjs → local state (only when NOT editing)
  useEffect(() => {
    if (!editingTitle && collab.meta.name) {
      setProjectName(collab.meta.name)
    }
  }, [collab.meta.name, editingTitle])

  useEffect(() => {
    if (!editingTitle && collab.meta.description !== undefined) {
      setProjectDescription(collab.meta.description)
    }
  }, [collab.meta.description, editingTitle])

  // Auto-select first terminal session
  useEffect(() => {
    if (collab.terminalSessions.length > 0 && !activeTerminalId) {
      setActiveTerminalId(collab.terminalSessions[0].id)
    }
    // If active session was deleted, select first remaining
    if (activeTerminalId && !collab.terminalSessions.find(s => s.id === activeTerminalId)) {
      setActiveTerminalId(collab.terminalSessions[0]?.id ?? null)
    }
  }, [collab.terminalSessions, activeTerminalId])

  const activeFile = files.find((f) => f.path === activeFilePath)

  useEffect(() => {
    if (!timeTravelActive) return
    if (files.length === 0) return
    if (!files.some((f) => f.path === activeFilePath)) {
      const fallbackPath = files[0].path
      setActiveFilePath(fallbackPath)
      setOpenFiles([fallbackPath])
    }
  }, [timeTravelActive, files, activeFilePath])

  const handleSaveTitle = useCallback(async () => {
    if (!projectName.trim()) {
      setProjectName(project.name)
      setEditingTitle(false)
      return
    }
    setEditingTitle(false)
    // Sync to Yjs (real-time to other tabs)
    collab.updateMeta("name", projectName.trim())
    collab.updateMeta("description", projectDescription.trim())
    // Persist to DB
    const formData = new FormData()
    formData.set("projectId", project.id)
    formData.set("name", projectName.trim())
    formData.set("description", projectDescription.trim())
    await updateProject(formData)
  }, [project.id, project.name, projectName, projectDescription, collab])

  useEffect(() => {
    if (editingTitle && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [editingTitle])

  const handleOpenFile = useCallback(
    (path: string) => {
      // Normalize: ensure leading "/" to match UI convention
      const normalized = path.startsWith("/") ? path : "/" + path
      setActiveFilePath(normalized)
      setOpenFiles((prev) => (prev.includes(normalized) ? prev : [...prev, normalized]))
      collab.updateAwareness({ activeFile: normalized })
    },
    [collab]
  )

  // Navigate to a specific file + line (used by Search panel)
  const handleNavigateTo = useCallback(
    (path: string, line: number) => {
      handleOpenFile(path)
      setEditorRevealLine(line)
    },
    [handleOpenFile]
  )

  const handleCloseTab = useCallback(
    (path: string) => {
      setOpenFiles((prev) => {
        const next = prev.filter((p) => p !== path)
        if (activeFilePath === path && next.length > 0) {
          setActiveFilePath(next[next.length - 1])
        }
        return next
      })
    },
    [activeFilePath]
  )

  const handleDeleteFile = useCallback(
    (path: string) => {
      collab.deleteFile(path)
      // Also close the tab if open
      handleCloseTab(path)
    },
    [collab, handleCloseTab]
  )

  const isRunning = activeTerminalId ? (collab.terminalBusy[activeTerminalId] ?? false) : false

  const handleRun = useCallback(() => {
    setTerminalOpen(true)
    if (isRunning && activeTerminalId) {
      // If already running, send interrupt
      collab.interruptTerminal(activeTerminalId)
      return
    }
    // Create a new "Run" terminal session and invoke run-project
    const newId = collab.createTerminalSession("Run")
    if (newId) {
      setActiveTerminalId(newId)
      // Small delay to ensure the Yjs session is synced to server
      setTimeout(() => {
        collab.runProject(newId)
      }, 300)
    }
  }, [isRunning, activeTerminalId, collab])

  const handleCreateFile = useCallback(
    (path: string) => {
      const normalizedPath = path.startsWith("/") ? path : "/" + path
      collab.createFile(normalizedPath)
      handleOpenFile(normalizedPath)
    },
    [handleOpenFile, collab]
  )

  const buildCurrentFileStates = useCallback((): Record<string, string> => {
    const entries = liveFiles.map((f) => [f.path, f.content] as const)
    return Object.fromEntries(entries)
  }, [liveFiles])

  const createLocalSnapshot = useCallback(
    (
      kind: "cron" | "ai" | "human",
      opts?: {
        label?: string | null
        promptSummary?: string
        filePath?: string
        fileStates?: Record<string, string>
      }
    ): Promise<Snapshot> => {
      const snapshot: Snapshot = {
        id: `local-${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        projectId: project.id,
        createdAt: new Date().toISOString(),
        label: opts?.label ?? null,
        changeCount: 1,
        userId: currentUser.id,
        userName: currentUser.name,
        kind,
        promptSummary: opts?.promptSummary,
        filePath: opts?.filePath ?? (activeFilePath || liveFiles[0]?.path),
        fileStates: opts?.fileStates ?? buildCurrentFileStates(),
      }
      setTimelineSnapshots((prev) =>
        [...prev, snapshot].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )
      )

      // Broadcast to other clients so their timelines stay in sync
      collab.broadcastSnapshot(snapshot as unknown as Record<string, unknown>)

      void createSnapshot({
        projectId: project.id,
        kind,
        label: snapshot.label,
        promptSummary: snapshot.promptSummary,
        filePath: snapshot.filePath,
        fileStates: snapshot.fileStates,
        changeCount: snapshot.changeCount,
      }).then((result) => {
        if (!result.snapshot) return
        setTimelineSnapshots((prev) =>
          [...prev.filter((s) => s.id !== snapshot.id), result.snapshot!].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          )
        )
      })

      return Promise.resolve(snapshot)
    },
    [project.id, currentUser.id, currentUser.name, activeFilePath, liveFiles, buildCurrentFileStates, collab]
  )

  const handleToggleTimeTravel = useCallback(() => {
    setTimeTravelActive((prev) => {
      const next = !prev
      if (next) {
        setTimeTravelSnapshot(timelineSnapshots[timelineSnapshots.length - 1] ?? null)
      } else {
        setTimeTravelSnapshot(null)
      }
      return next
    })
  }, [timelineSnapshots])

  useEffect(() => {
    const interval = setInterval(() => {
      if (timeTravelActive) return
      if (liveFiles.length === 0) return
      void createLocalSnapshot("cron")
    }, 60_000)
    return () => clearInterval(interval)
  }, [timeTravelActive, liveFiles.length, createLocalSnapshot])

  // Resize handlers
  const handleSidebarResize = useCallback(
    (delta: number) => {
      setSidebarWidth((w) => Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, w + delta)))
    },
    []
  )

  const handleTerminalResize = useCallback(
    (delta: number) => {
      setTerminalHeight((h) => Math.min(TERMINAL_MAX, Math.max(TERMINAL_MIN, h - delta)))
    },
    []
  )

  const handleAgentPanelResize = useCallback(
    (delta: number) => {
      setAgentPanelWidth((w) => Math.min(AGENT_PANEL_MAX, Math.max(AGENT_PANEL_MIN, w - delta)))
    },
    []
  )

  // ── Compute AI blocks for the currently open file ──
  const activeFileAIBlocks = useMemo<AIBlock[]>(() => {
    if (!activeFilePath) return []
    const blocks: AIBlock[] = []
    for (const session of collab.aiChatSessions) {
      for (const msg of session.messages) {
        if (msg.role !== "assistant" || !msg.operations) continue
        msg.operations.forEach((op, idx) => {
          if (op.path === activeFilePath || op.path === activeFilePath.replace(/^\//, "")) {
            blocks.push({
              messageId: msg.id,
              chatId: session.id,
              operationIndex: idx,
              operation: op,
              status: msg.operationStatuses?.[idx] ?? "pending",
              agentColor: (collab.aiAgents.find(a => a.id === session.agentId) ?? agents.find(a => a.id === session.agentId))?.color,
            })
          }
        })
      }
    }
    return blocks
  }, [activeFilePath, collab.aiChatSessions, collab.aiAgents, agents])

  // Handler for AI block actions that also tracks accepts for quick-undo
  const handleAIBlockAction = useCallback(
    (chatId: string, messageId: string, opIndex: number, action: "accept" | "reject") => {
      if (action === "accept" && activeFile) {
        // Track this accept for quick-undo
        const block = activeFileAIBlocks.find(
          (b) => b.chatId === chatId && b.messageId === messageId && b.operationIndex === opIndex
        )
        const content = block?.operation.content
        if (block && content) {
          setRecentAIAccepts((prev) => [
            ...prev,
            {
              messageId,
              chatId,
              operationIndex: opIndex,
              originalContent: activeFile.content,
              newContent: content,
              acceptedAt: Date.now(),
              filePath: activeFile.path,
              startLine: 1, // In production, calculate from operation
            },
          ])

          void createLocalSnapshot("ai", {
            promptSummary: `AI ${block.operation.type}d ${block.operation.path}`,
            filePath: block.operation.path,
          })
        }
      }
      // Call the actual collab action
      collab.aiOperationAction(chatId, messageId, opIndex, action)
    },
    [activeFile, activeFileAIBlocks, collab, createLocalSnapshot]
  )

  // Handler for quick-undo
  const handleQuickUndo = useCallback(
    (accept: RecentAIAccept) => {
      // Revert the file content using the original content
      collab.updateFileContent(accept.filePath, accept.originalContent)

      // Remove from recent accepts
      setRecentAIAccepts((prev) =>
        prev.filter((a) => a.messageId !== accept.messageId)
      )

      // Add to recent undos for potential redo
      setRecentAIUndos((prev) => [
        ...prev,
        {
          messageId: accept.messageId,
          originalContent: accept.originalContent,
          newContent: accept.newContent,
          undoneAt: Date.now(),
          filePath: accept.filePath,
          startLine: accept.startLine,
        },
      ])

      // Show toast
      import("sonner").then(({ toast }) => {
        toast.success("AI change reverted")
      })
    },
    [collab]
  )

  // Handler for quick-redo
  const handleQuickRedo = useCallback(
    (undo: RecentAIUndo) => {
      // Restore the AI-generated content
      collab.updateFileContent(undo.filePath, undo.newContent)

      // Remove from recent undos
      setRecentAIUndos((prev) =>
        prev.filter((u) => u.messageId !== undo.messageId)
      )

      // Show toast
      import("sonner").then(({ toast }) => {
        toast.success("AI change restored")
      })
    },
    [collab]
  )

  return (
    <GitProvider
      projectId={project.id}
      ydoc={collab.getYdoc()}
      Y={collab.getYjs()}
      initialAuthor={{
        name: currentUser.name,
        email: currentUser.email,
      }}
      initialCredentials={initialGitCredentials}
    >
    <div className="flex h-full flex-col bg-background">
      {/* ─── Top Bar ─── */}
      <header className="grid h-11 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-border-subtle px-3">
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/dashboard">
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
            </TooltipTrigger>
            <TooltipContent>Back to dashboard</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-5" />

          {/* Connection indicator */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5">
                <div
                  className={cn(
                    "h-2 w-2 rounded-full transition-colors",
                    collab.connected ? "bg-success" : "bg-warning animate-pulse"
                  )}
                />
                {!collab.connected && (
                  <span className="text-[10px] text-warning font-medium">Offline</span>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {collab.connected
                ? "Connected — real-time sync active"
                : "Lost connection — reconnecting automatically. You can still edit locally."}
            </TooltipContent>
          </Tooltip>

          {editingTitle ? (
            <div className="flex items-center gap-1.5">
              <input
                ref={titleInputRef}
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveTitle()
                  if (e.key === "Escape") {
                    setProjectName(project.name)
                    setProjectDescription(project.description ?? "")
                    setEditingTitle(false)
                  }
                }}
                className="h-6 w-40 rounded border border-border-default bg-elevated px-2 text-sm font-medium text-text-primary outline-none focus:border-brand"
                placeholder="Project name"
              />
              <input
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveTitle()
                  if (e.key === "Escape") {
                    setProjectName(project.name)
                    setProjectDescription(project.description ?? "")
                    setEditingTitle(false)
                  }
                }}
                className="h-6 w-44 rounded border border-border-default bg-elevated px-2 text-xs text-text-secondary outline-none focus:border-brand"
                placeholder="Description (optional)"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleSaveTitle}
              >
                <Check className="h-3 w-3 text-success" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  setProjectName(project.name)
                  setProjectDescription(project.description ?? "")
                  setEditingTitle(false)
                }}
              >
                <X className="h-3 w-3 text-text-tertiary" />
              </Button>
            </div>
          ) : (
            <button
              className="group flex items-center gap-1.5 rounded-md px-1 py-0.5 transition-colors hover:bg-hover"
              onClick={() => setEditingTitle(true)}
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium text-text-primary truncate max-w-[200px]">
                  {projectName}
                </span>
                {projectDescription && (
                  <span className="text-[10px] text-text-tertiary truncate max-w-[200px]">
                    {projectDescription}
                  </span>
                )}
              </div>
              <Pencil className="h-3 w-3 text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )}
        </div>

        {/* Center: Run button */}
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant={isRunning ? "destructive" : "default"}
                onClick={handleRun}
                className="h-7 gap-1.5 px-3 text-xs"
                disabled={!collab.connected || collab.dockerStatus !== "ready"}
              >
                {isRunning ? (
                  <>
                    <Square className="h-3 w-3" />
                    Stop
                  </>
                ) : (
                  <>
                    <Play className="h-3 w-3" />
                    Run
                  </>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {!collab.connected
                ? "Server connection required to run code"
                : collab.dockerStatus !== "ready"
                  ? "Waiting for Docker container..."
                  : isRunning
                    ? "Stop the running process (Ctrl+C)"
                    : "Auto-detect & run the project"}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Right: Actions + Presence */}
        <div className="flex items-center justify-end gap-2">
          {/* Git: Branch Selector & Sync */}
          <BranchSelector />
          <SyncIndicator />

          <Separator orientation="vertical" className="h-5" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={timeTravelActive ? "secondary" : "ghost"}
                size="icon"
                className="h-7 w-7"
                onClick={handleToggleTimeTravel}
              >
                <History className={cn("h-4 w-4", !collab.connected && "text-text-tertiary")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Time Travel <kbd className="ml-1.5 text-[10px] text-text-tertiary">⌘⇧T</kbd>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  setShareDialogOpen(true)
                  setLinkCopied(false)
                }}
              >
                <Share2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Share workspace</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-5" />

          <PresenceDock
            users={livePresence}
            currentUser={currentUser}
            onToggleAgentRoster={() => setAgentRosterOpen(!agentRosterOpen)}
          />
        </div>
      </header>

      {/* ─── Main Area ─── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {sidebarOpen && (
          <>
            <aside
              style={{ width: sidebarWidth }}
              className="shrink-0 overflow-hidden border-r border-border-subtle bg-surface flex flex-col"
            >
              {/* Sidebar Tabs */}
              <Tabs
                value={sidebarTab}
                onValueChange={(v) => setSidebarTab(v as "files" | "search" | "git")}
                className="flex flex-col h-full"
              >
                <TabsList className="h-9 shrink-0 rounded-none border-b border-border-subtle bg-transparent p-0 justify-start">
                  <TabsTrigger
                    value="files"
                    className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-brand data-[state=active]:bg-transparent px-3 text-xs"
                  >
                    <FolderTree className="h-3.5 w-3.5 mr-1.5" />
                    Files
                  </TabsTrigger>
                  <TabsTrigger
                    value="search"
                    className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-brand data-[state=active]:bg-transparent px-3 text-xs"
                  >
                    <Search className="h-3.5 w-3.5 mr-1.5" />
                    Search
                  </TabsTrigger>
                  <TabsTrigger
                    value="git"
                    className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-brand data-[state=active]:bg-transparent px-3 text-xs"
                  >
                    <FolderGit2 className="h-3.5 w-3.5 mr-1.5" />
                    Git
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="files" className="flex-1 overflow-hidden m-0 min-h-0 data-[state=active]:flex data-[state=active]:flex-col">
                  <FileTree
                    files={files}
                    activeFilePath={activeFilePath}
                    presence={livePresence}
                    onOpenFile={handleOpenFile}
                    onDeleteFile={handleDeleteFile}
                    onRenameFile={(oldPath, newPath) => collab.renameFile(oldPath, newPath)}
                    onCreateFile={handleCreateFile}
                    createFileTrigger={createFileTrigger}
                  />
                </TabsContent>

                <TabsContent value="search" className="flex-1 overflow-hidden m-0 min-h-0 data-[state=active]:flex data-[state=active]:flex-col">
                  <SearchPanel
                    files={files}
                    onNavigateTo={handleNavigateTo}
                    onReplaceInFile={(path, search, replacement) => {
                      const file = files.find((f) => f.path === path)
                      if (!file) return
                      const updated = file.content.replace(search, replacement)
                      collab.updateFileContent(path, updated)
                    }}
                  />
                </TabsContent>

                <TabsContent value="git" className="flex-1 overflow-hidden m-0 min-h-0 data-[state=active]:flex data-[state=active]:flex-col">
                  <SourceControlPanel
                    onViewDiff={(filepath) => setDiffViewPath(filepath)}
                  />
                </TabsContent>
              </Tabs>
            </aside>
            <ResizeHandle
              direction="horizontal"
              onResize={handleSidebarResize}
            />
          </>
        )}

        {/* Editor + Terminal Column */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Editor Toolbar */}
          <div className="flex h-9 shrink-0 items-center border-b border-border-subtle bg-surface px-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 mr-1"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                >
                  {sidebarOpen ? (
                    <PanelLeftClose className="h-4 w-4" />
                  ) : (
                    <PanelLeftOpen className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {sidebarOpen ? "Hide sidebar" : "Show sidebar"}
              </TooltipContent>
            </Tooltip>

            {/* Tab bar */}
            <div className="flex flex-1 items-center gap-px overflow-x-auto">
              {openFiles.map((filePath) => {
                const isActive = filePath === activeFilePath
                const fileName = filePath.split("/").pop() ?? filePath
                return (
                  <div
                    key={filePath}
                    role="tab"
                    tabIndex={0}
                    aria-selected={isActive}
                    onClick={() => { setActiveFilePath(filePath); collab.updateAwareness({ activeFile: filePath }) }}
                    onKeyDown={(e) => { if (e.key === "Enter") { setActiveFilePath(filePath); collab.updateAwareness({ activeFile: filePath }) } }}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      setTabContextMenu({ x: e.clientX, y: e.clientY, path: filePath })
                    }}
                    className={cn(
                      "group flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1 text-xs transition-colors",
                      isActive
                        ? "bg-elevated text-text-primary"
                        : "text-text-tertiary hover:bg-hover/50 hover:text-text-secondary"
                    )}
                  >
                    {getFileIcon(fileName, "h-3.5 w-3.5")}
                    <span className="truncate max-w-[120px]">{fileName}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleCloseTab(filePath)
                      }}
                      className="ml-1 rounded-sm opacity-0 transition-opacity group-hover:opacity-100 hover:bg-active"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )
              })}
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 ml-1"
                  onClick={() => setTerminalOpen(!terminalOpen)}
                >
                  {terminalOpen ? (
                    <PanelBottomClose className="h-4 w-4" />
                  ) : (
                    <PanelBottomOpen className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {terminalOpen ? "Hide terminal" : "Show terminal"}
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Editor */}
          <div className="flex-1 overflow-hidden relative">
            {activeFile ? (
              <>
                <CodeEditor
                  key={`${activeFilePath}:${timeTravelActive ? "tt" : "live"}:${collab.getYText(activeFilePath) ? "bound" : "static"}`}
                  file={activeFile}
                  readOnly={timeTravelActive}
                  yText={timeTravelActive ? undefined : collab.getYText(activeFilePath)}
                  awareness={timeTravelActive ? undefined : collab.getAwareness()}
                  onContentChange={(content) => collab.updateFileContent(activeFile.path, content)}
                  aiBlocks={activeFileAIBlocks}
                  onAIBlockAction={handleAIBlockAction}
                  recentAccepts={recentAIAccepts}
                  recentUndos={recentAIUndos}
                  onQuickUndo={handleQuickUndo}
                  onQuickRedo={handleQuickRedo}
                  revealLine={editorRevealLine}
                />
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-text-tertiary">
                <p className="text-sm">Select a file to start editing</p>
              </div>
            )}

            {/* Time-Travel overlay — full vignette when viewing past */}
            <AnimatePresence>
              {timeTravelActive && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="pointer-events-none absolute inset-0 z-20"
                  style={{
                    background: `
                      radial-gradient(ellipse at center, transparent 40%, hsla(230, 13%, 7%, 0.4) 100%),
                      linear-gradient(180deg, hsla(230, 13%, 7%, 0.1) 0%, transparent 20%, transparent 80%, hsla(239, 84%, 67%, 0.08) 100%)
                    `,
                    boxShadow: "inset 0 0 100px hsla(230, 13%, 7%, 0.3)",
                  }}
                >
                  {/* "Viewing Past" indicator badge */}
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-elevated/90 border border-brand-muted-border backdrop-blur-sm">
                    <div className="w-2 h-2 rounded-full bg-warning animate-pulse" />
                    <span className="text-xs font-medium text-text-secondary">
                      Viewing historical state — Read only
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* AI Inline Prompt (Cmd+K in editor) */}
            <AnimatePresence>
              {aiPromptOpen && activeFile && (
                <AIInlinePrompt
                  filePath={activeFile.path}
                  onClose={() => setAiPromptOpen(false)}
                />
              )}
            </AnimatePresence>
          </div>

          {/* Terminal (resizable) */}
          {terminalOpen && (
            <>
              <ResizeHandle
                direction="vertical"
                onResize={handleTerminalResize}
              />
              <div
                style={{ height: terminalHeight }}
                className="shrink-0 overflow-hidden border-t border-border-subtle"
              >
                <TerminalPanel
                  sessions={collab.terminalSessions}
                  activeSessionId={activeTerminalId}
                  onSelectSession={setActiveTerminalId}
                  onCreateSession={() => {
                    const newId = collab.createTerminalSession()
                    if (newId) setActiveTerminalId(newId)
                  }}
                  onDeleteSession={(id) => collab.deleteTerminalSession(id)}
                  onInput={(content) => {
                    if (activeTerminalId) collab.sendTerminalInput(activeTerminalId, content)
                  }}
                  inputYText={activeTerminalId ? collab.getTerminalInputYText(activeTerminalId) : undefined}
                  awareness={collab.getAwareness()}
                  presenceUsers={livePresence}
                  currentUserId={currentUser.id}
                  dockerStatus={collab.dockerStatus}
                  dockerError={collab.dockerError}
                  terminalBusy={collab.terminalBusy}
                  terminalCwds={collab.terminalCwds}
                  onResetContainer={collab.resetContainer}
                  onInterrupt={(sessionId) => collab.interruptTerminal(sessionId)}
                />
              </div>
            </>
          )}

          {/* Time Travel Slider */}
          <AnimatePresence>
            {timeTravelActive && (
              <TimeTravelSlider
                snapshots={timelineSnapshots}
                onClose={() => {
                  setTimeTravelActive(false)
                  setTimeTravelSnapshot(null)
                }}
                onRestore={(snapshot) => {
                  void createLocalSnapshot("human", {
                    label: "Checkpoint before restore",
                  })

                  const restoredState = resolveSnapshotFileStates(snapshot)
                  if (restoredState) {
                    const restoredEntries = Object.entries(restoredState)
                    const restoredPaths = new Set(restoredEntries.map(([path]) => path))
                    const livePaths = new Set(liveFiles.map((f) => f.path))

                    // Batch all Yjs mutations in a single doc transaction so the
                    // entire restore is one atomic Yjs update for other clients.
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const ydoc = collab.getYdoc() as any
                    const txnBody = () => {
                      for (const livePath of livePaths) {
                        if (!restoredPaths.has(livePath)) {
                          collab.deleteFile(livePath)
                        }
                      }

                      for (const [path, content] of restoredEntries) {
                        collab.updateFileContent(path, content)
                      }
                    }
                    if (ydoc?.transact) {
                      ydoc.transact(txnBody)
                    } else {
                      txnBody()
                    }

                    const firstPath = restoredEntries[0]?.[0]
                    if (firstPath) {
                      setActiveFilePath(firstPath)
                      setOpenFiles([firstPath])
                    }
                  }

                  // Ask the server to persist a Yjs snapshot immediately so the
                  // DB is up-to-date if any client refreshes before the 60 s cron.
                  collab.requestSnapshotSave()

                  setTimeTravelActive(false)
                  setTimeTravelSnapshot(null)
                  // Show toast confirmation
                  if (typeof window !== "undefined") {
                    const time = new Date(snapshot.createdAt).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    })
                    // Using sonner toast
                    import("sonner").then(({ toast }) => {
                      toast.success(`Workspace restored to ${time}`)
                    })
                  }

                  void createLocalSnapshot("human", {
                    label: `Restored to ${new Date(snapshot.createdAt).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    })}`,
                    fileStates: restoredState ?? undefined,
                  })
                }}
                onScrub={(snapshot) => {
                  const resolvedFileStates = resolveSnapshotFileStates(snapshot)
                  const nextSnapshot = resolvedFileStates ? { ...snapshot, fileStates: resolvedFileStates } : snapshot
                  setTimeTravelSnapshot(nextSnapshot)

                  const stateEntries = Object.entries(nextSnapshot.fileStates ?? {})
                  if (stateEntries.length > 0) {
                    const hasActive = stateEntries.some(([path]) => path === activeFilePath)
                    if (!hasActive) {
                      const nextPath = stateEntries[0][0]
                      setActiveFilePath(nextPath)
                      setOpenFiles([nextPath])
                    }
                  }
                }}
              />
            )}
          </AnimatePresence>
        </div>

        {/* AI Panel (resizable) */}
        {agentRosterOpen && (
          <>
            <ResizeHandle
              direction="horizontal"
              onResize={handleAgentPanelResize}
            />
            <aside
              style={{ width: agentPanelWidth }}
              className="shrink-0 overflow-hidden border-l border-border-subtle bg-surface flex flex-col min-h-0"
            >
              <AIPanel
                agents={collab.aiAgents.length > 0 ? collab.aiAgents : agents}
                chatSessions={collab.aiChatSessions}
                presenceUsers={livePresence}
                currentUserId={currentUser.id}
                streamingMessages={streamingMessages}
                onClose={() => setAgentRosterOpen(false)}
                onSendChat={collab.sendAIChat}
                onOperationAction={collab.aiOperationAction}
                onBulkAction={collab.aiBulkAction}
                onCreateAgent={collab.createAgent}
                onUpdateAgent={collab.updateAgent}
                onDeleteAgent={collab.deleteAgent}
                onOpenFile={handleOpenFile}
                onRenameChat={collab.renameAIChat}
                onDeleteChat={collab.deleteAIChat}
                getChatInputYText={collab.getAIChatInputYText}
              />
            </aside>
          </>
        )}
      </div>

      {/* ─── Status Bar ─── */}
      <div className="flex h-6 shrink-0 items-center justify-between border-t border-border-subtle bg-surface px-3 text-[11px] text-text-tertiary">
        <div className="flex items-center gap-3">
          {collab.dockerStatus === "ready" && (
            <span className="flex items-center gap-1">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-success" />
              Docker
            </span>
          )}
          {collab.dockerStatus === "creating" && (
            <span className="flex items-center gap-1">
              <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-warning" />
              Docker starting...
            </span>
          )}
          {collab.dockerStatus === "error" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex cursor-help items-center gap-1">
                  <span className="inline-flex h-1.5 w-1.5 rounded-full bg-error" />
                  <span className="text-error">Docker error</span>
                </span>
              </TooltipTrigger>
              <TooltipContent>{collab.dockerError || "Unknown error"}</TooltipContent>
            </Tooltip>
          )}
          {collab.connected && (
            <span className="flex items-center gap-1">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-success" />
              Connected
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {collab.dockerStats && collab.dockerStatus === "ready" && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1 tabular-nums">
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="4" y="4" width="16" height="16" rx="2" />
                      <path d="M9 9h6v6H9z" />
                    </svg>
                    {collab.dockerStats.cpuPercent}%
                  </span>
                </TooltipTrigger>
                <TooltipContent>CPU Usage</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1 tabular-nums">
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="7" height="7" rx="1" />
                      <rect x="14" y="3" width="7" height="7" rx="1" />
                      <rect x="3" y="14" width="7" height="7" rx="1" />
                      <rect x="14" y="14" width="7" height="7" rx="1" />
                    </svg>
                    {collab.dockerStats.memoryUsageMB} / {collab.dockerStats.memoryLimitMB} MB
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Memory: {collab.dockerStats.memoryPercent}% used
                </TooltipContent>
              </Tooltip>
            </>
          )}
          {activeFilePath && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help tabular-nums">{activeFilePath}</span>
              </TooltipTrigger>
              <TooltipContent>Active file path in the workspace</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Share / Invite Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share workspace</DialogTitle>
            <DialogDescription>
              Anyone with this link can join <strong>{project.name}</strong> as a collaborator.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={shareUrl}
              className="flex-1 text-sm"
              onFocus={(e) => e.target.select()}
            />
            <Button
              variant="default"
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={() => {
                navigator.clipboard.writeText(shareUrl)
                setLinkCopied(true)
                setTimeout(() => setLinkCopied(false), 2000)
              }}
            >
              {linkCopied ? (
                <>
                  <CheckCheck className="h-4 w-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Command Palette (Cmd+K) */}
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        files={files}
        onOpenFile={handleOpenFile}
        onToggleSourceControl={() => {
          setSidebarOpen(true)
          setSidebarTab("git")
        }}
      />

      {/* Diff Viewer Dialog */}
      {diffViewPath && (
        <Dialog open={!!diffViewPath} onOpenChange={() => setDiffViewPath(null)}>
          <DialogContent className="max-w-4xl h-[80vh] p-0 overflow-hidden">
            <DiffViewer
              filepath={diffViewPath}
              onClose={() => setDiffViewPath(null)}
              className="h-full"
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Tab Context Menu (reuses sidebar file context menu) */}
      <AnimatePresence>
        {tabContextMenu && (
          <TabContextMenu
            x={tabContextMenu.x}
            y={tabContextMenu.y}
            path={tabContextMenu.path}
            onClose={() => setTabContextMenu(null)}
            onCloseTab={handleCloseTab}
            onCloseOtherTabs={(path) => {
              setOpenFiles([path])
              setActiveFilePath(path)
            }}
            onDeleteFile={handleDeleteFile}
            onRenameFile={(oldPath, newPath) => collab.renameFile(oldPath, newPath)}
            onCopyPath={(path) => navigator.clipboard?.writeText(path)}
          />
        )}
      </AnimatePresence>

      {/* Keyboard shortcut listener */}
      <KeyboardShortcuts
        onToggleCommandPalette={() => setCommandPaletteOpen((prev) => !prev)}
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        onToggleTerminal={() => setTerminalOpen((prev) => !prev)}
        onRun={handleRun}
        onToggleAiPrompt={() => setAiPromptOpen((prev) => !prev)}
        onNewFile={() => setCreateFileTrigger((n) => n + 1)}
        onToggleTimeTravel={handleToggleTimeTravel}
        onSaveSnapshot={() => {
          void createLocalSnapshot("human", {
            label: "Manual checkpoint",
          })
          import("sonner").then(({ toast }) => {
            toast.success("Checkpoint saved")
          })
        }}
      />
    </div>
    </GitProvider>
  )
}

/** Invisible component that registers global keyboard shortcuts */
function KeyboardShortcuts({
  onToggleCommandPalette,
  onToggleSidebar,
  onToggleTerminal,
  onRun,
  onToggleAiPrompt,
  onNewFile,
  onToggleTimeTravel,
  onSaveSnapshot,
}: {
  onToggleCommandPalette: () => void
  onToggleSidebar: () => void
  onToggleTerminal: () => void
  onRun: () => void
  onToggleAiPrompt: () => void
  onNewFile: () => void
  onToggleTimeTravel: () => void
  onSaveSnapshot: () => void
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey

      if (isMeta && e.key === "k") {
        e.preventDefault()
        onToggleAiPrompt()
      }
      if (isMeta && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault()
        onToggleCommandPalette()
      }
      if (isMeta && e.key === "b") {
        e.preventDefault()
        onToggleSidebar()
      }
      if (isMeta && e.key === "`") {
        e.preventDefault()
        onToggleTerminal()
      }
      if (isMeta && e.shiftKey && e.key.toLowerCase() === "r") {
        e.preventDefault()
        onRun()
      }
      // Cmd+Shift+T for time travel (use keyCode to bypass browser shortcut)
      // KeyCode 84 = T
      if (isMeta && e.shiftKey && (e.key === "T" || e.key === "t" || e.keyCode === 84)) {
        e.preventDefault()
        e.stopPropagation()
        onToggleTimeTravel()
      }
      // Cmd+S for manual snapshot/save
      if (isMeta && e.key === "s") {
        e.preventDefault()
        onSaveSnapshot()
      }
      // "a" for new file (when not focused in an input/editor)
      if (
        e.key === "a" &&
        !isMeta &&
        !e.shiftKey &&
        !e.altKey &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement) &&
        !(e.target as HTMLElement)?.closest?.(".monaco-editor")
      ) {
        e.preventDefault()
        onNewFile()
      }
    }

    // Use capture phase to intercept before browser handles it
    window.addEventListener("keydown", handler, true)
    return () => window.removeEventListener("keydown", handler, true)
  }, [onToggleCommandPalette, onToggleSidebar, onToggleTerminal, onRun, onToggleAiPrompt, onNewFile, onToggleTimeTravel, onSaveSnapshot])

  return null
}

/** Context menu for tab chips (right-click on tab) */
function TabContextMenu({
  x,
  y,
  path,
  onClose,
  onCloseTab,
  onCloseOtherTabs,
  onDeleteFile,
  onRenameFile,
  onCopyPath,
}: {
  x: number
  y: number
  path: string
  onClose: () => void
  onCloseTab: (path: string) => void
  onCloseOtherTabs: (path: string) => void
  onDeleteFile: (path: string) => void
  onRenameFile: (oldPath: string, newPath: string) => void
  onCopyPath: (path: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("mousedown", handler)
    document.addEventListener("keydown", keyHandler)
    return () => {
      document.removeEventListener("mousedown", handler)
      document.removeEventListener("keydown", keyHandler)
    }
  }, [onClose])

  const actions = [
    { label: "Close", action: () => { onCloseTab(path); onClose() } },
    { label: "Close Others", action: () => { onCloseOtherTabs(path); onClose() } },
    { divider: true },
    { label: "Rename", icon: Pencil, action: () => {
      const name = path.split("/").pop()!
      const newName = prompt("Rename to:", name)
      if (newName?.trim() && newName.trim() !== name) {
        const parentPath = path.substring(0, path.lastIndexOf("/"))
        onRenameFile(path, `${parentPath}/${newName.trim()}`)
      }
      onClose()
    }},
    { label: "Copy Path", icon: ClipboardCopy, action: () => { onCopyPath(path); onClose() } },
    { divider: true },
    { label: "Delete", icon: Trash2, destructive: true, action: () => { onDeleteFile(path); onClose() } },
  ]

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.1 }}
      className="fixed z-50 min-w-[160px] rounded-lg border border-border-default bg-popover p-1 shadow-xl"
      style={{ left: x, top: y }}
    >
      {actions.map((item, i) => {
        if ("divider" in item && item.divider) {
          return <div key={`d-${i}`} className="my-1 h-px bg-border-subtle" />
        }
        const Icon = "icon" in item ? item.icon : null
        return (
          <button
            key={item.label}
            onClick={item.action}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
              "destructive" in item && item.destructive
                ? "text-error hover:bg-error-muted"
                : "text-text-secondary hover:bg-hover hover:text-text-primary"
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            <span className="flex-1 text-left">{item.label}</span>
          </button>
        )
      })}
    </motion.div>
  )
}
