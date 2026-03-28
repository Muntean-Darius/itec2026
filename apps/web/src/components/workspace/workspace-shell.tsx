"use client"

import { useState, useCallback, useEffect, useRef } from "react"
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
} from "lucide-react"
import Link from "next/link"
import type { User, Project, FileNode, PresenceUser, AIAgent, Snapshot } from "@/data/types"
import { updateProject } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ResizeHandle } from "@/components/ui/resize-handle"
import { PresenceDock } from "./presence-dock"
import { FileTree } from "./file-tree"
import { CodeEditor } from "./code-editor"
import { TerminalPanel } from "./terminal-panel"
import { CommandPalette } from "./command-palette"
import { TimeTravelSlider } from "./time-travel-slider"
import { AgentRoster } from "./agent-roster"
import { AIInlinePrompt } from "./ai-inline-prompt"
import { NewFileDialog } from "./new-file-dialog"
import { useCollaboration } from "@/lib/collaboration"

interface WorkspaceShellProps {
  project: Project
  initialFiles: FileNode[]
  initialPresence: PresenceUser[]
  currentUser: User
  agents: AIAgent[]
  snapshots: Snapshot[]
}

// Size constraints
const SIDEBAR_MIN = 180
const SIDEBAR_MAX = 400
const SIDEBAR_DEFAULT = 260
const TERMINAL_MIN = 80
const TERMINAL_MAX = 500
const TERMINAL_DEFAULT = 220
const AGENT_PANEL_MIN = 220
const AGENT_PANEL_MAX = 400
const AGENT_PANEL_DEFAULT = 280

export function WorkspaceShell({
  project,
  initialFiles,
  initialPresence,
  currentUser,
  agents,
  snapshots,
}: WorkspaceShellProps) {
  // Real-time collaboration
  const collab = useCollaboration({
    projectId: project.id,
    currentUser,
    initialFiles,
  })

  // Use collab files + presence, with initialPresence as fallback
  const files = collab.files.length > 0 ? collab.files : initialFiles
  const livePresence = collab.presence.length > 0 ? collab.presence : initialPresence

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

  // Panel sizes (resizable)
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT)
  const [terminalHeight, setTerminalHeight] = useState(TERMINAL_DEFAULT)
  const [agentPanelWidth, setAgentPanelWidth] = useState(AGENT_PANEL_DEFAULT)

  // Workspace state
  const [isRunning, setIsRunning] = useState(false)
  const [timeTravelActive, setTimeTravelActive] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [aiPromptOpen, setAiPromptOpen] = useState(false)
  const [newFileDialogOpen, setNewFileDialogOpen] = useState(false)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  // Active terminal session
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null)

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

  // Terminal draft awareness: extract other users' draft text from presence
  const terminalDrafts = livePresence
    .filter((p) => {
      const userId = p.id.split(":")[0]
      return userId !== currentUser.id
    })
    .map((p) => ({
      userId: p.id,
      name: p.name,
      cursorColor: p.cursorColor,
      sessionId: p.terminalSessionId ?? "",
      text: p.terminalDraft ?? "",
    }))
    .filter((d) => d.sessionId && d.text)

  const handleTerminalDraftChange = useCallback(
    (sessionId: string, text: string) => {
      collab.updateAwareness({
        terminalSessionId: sessionId,
        terminalDraft: text,
      } as Record<string, unknown>)
    },
    [collab]
  )

  const activeFile = files.find((f) => f.path === activeFilePath)

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
      setActiveFilePath(path)
      setOpenFiles((prev) => (prev.includes(path) ? prev : [...prev, path]))
      collab.updateAwareness({ activeFile: path })
    },
    [collab]
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

  const handleRun = useCallback(() => {
    setIsRunning(true)
    setTerminalOpen(true)
    setTimeout(() => setIsRunning(false), 3000)
  }, [])

  const handleCreateFile = useCallback(
    (path: string) => {
      const normalizedPath = path.startsWith("/") ? path : "/" + path
      collab.createFile(normalizedPath)
      handleOpenFile(normalizedPath)
    },
    [handleOpenFile, collab]
  )

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

  return (
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
              <div
                className={`h-2 w-2 rounded-full transition-colors ${
                  collab.connected
                    ? "bg-success"
                    : "bg-warning animate-pulse"
                }`}
              />
            </TooltipTrigger>
            <TooltipContent>
              {collab.connected ? "Connected — real-time sync active" : "Reconnecting..."}
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
          <Button
            size="sm"
            variant={isRunning ? "destructive" : "default"}
            onClick={isRunning ? () => setIsRunning(false) : handleRun}
            className="h-7 gap-1.5 px-3 text-xs"
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
        </div>

        {/* Right: Actions + Presence */}
        <div className="flex items-center justify-end gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setTimeTravelActive(!timeTravelActive)}
              >
                <History className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Time Travel</TooltipContent>
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
              className="shrink-0 overflow-hidden border-r border-border-subtle bg-surface"
            >
              <FileTree
                files={files}
                activeFilePath={activeFilePath}
                presence={livePresence}
                onOpenFile={handleOpenFile}
                onNewFile={() => setNewFileDialogOpen(true)}
                onDeleteFile={(path) => collab.deleteFile(path)}
                onRenameFile={(oldPath, newPath) => collab.renameFile(oldPath, newPath)}
                onCreateFile={handleCreateFile}
              />
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
            <div className="flex flex-1 items-center gap-0.5 overflow-x-auto">
              {openFiles.map((filePath) => {
                const isActive = filePath === activeFilePath
                const fileName = filePath.split("/").pop()
                return (
                  <div
                    key={filePath}
                    role="tab"
                    tabIndex={0}
                    aria-selected={isActive}
                    onClick={() => setActiveFilePath(filePath)}
                    onKeyDown={(e) => { if (e.key === "Enter") setActiveFilePath(filePath) }}
                    className={`group flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1 text-xs transition-colors ${
                      isActive
                        ? "bg-elevated text-text-primary"
                        : "text-text-secondary hover:bg-hover hover:text-text-primary"
                    }`}
                  >
                    <span className="truncate max-w-[120px]">{fileName}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleCloseTab(filePath)
                      }}
                      className="ml-1 rounded-sm opacity-0 transition-opacity group-hover:opacity-100 hover:bg-active"
                    >
                      <span className="text-[10px] leading-none px-0.5">✕</span>
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
                  key={activeFilePath}
                  file={activeFile}
                  readOnly={timeTravelActive}
                  yText={collab.getYText(activeFilePath)}
                  awareness={collab.getAwareness()}
                  onContentChange={(content) => collab.updateFileContent(activeFile.path, content)}
                />
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-text-tertiary">
                <p className="text-sm">Select a file to start editing</p>
              </div>
            )}

            {/* Time-Travel overlay */}
            <AnimatePresence>
              {timeTravelActive && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(180deg, transparent 80%, hsla(239, 84%, 67%, 0.05) 100%)",
                    boxShadow: "inset 0 0 60px hsla(239, 84%, 67%, 0.03)",
                  }}
                />
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
                  isRunning={isRunning}
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
                  terminalDrafts={terminalDrafts}
                  onDraftChange={handleTerminalDraftChange}
                />
              </div>
            </>
          )}

          {/* Time Travel Slider */}
          <AnimatePresence>
            {timeTravelActive && (
              <TimeTravelSlider
                snapshots={snapshots}
                onClose={() => setTimeTravelActive(false)}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Agent Roster Panel (resizable) */}
        {agentRosterOpen && (
          <>
            <ResizeHandle
              direction="horizontal"
              onResize={handleAgentPanelResize}
            />
            <aside
              style={{ width: agentPanelWidth }}
              className="shrink-0 overflow-hidden border-l border-border-subtle bg-surface"
            >
              <AgentRoster
                agents={agents}
                onClose={() => setAgentRosterOpen(false)}
              />
            </aside>
          </>
        )}
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
              value={typeof window !== "undefined" ? `${window.location.origin}/workspace/join/${project.id}` : ""}
              className="flex-1 text-sm"
              onFocus={(e) => e.target.select()}
            />
            <Button
              variant="default"
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/workspace/join/${project.id}`)
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
      />

      {/* New File Dialog */}
      <NewFileDialog
        open={newFileDialogOpen}
        onOpenChange={setNewFileDialogOpen}
        existingPaths={files.map((f) => f.path)}
        onCreateFile={handleCreateFile}
      />

      {/* Keyboard shortcut listener */}
      <KeyboardShortcuts
        onToggleCommandPalette={() => setCommandPaletteOpen((prev) => !prev)}
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        onToggleTerminal={() => setTerminalOpen((prev) => !prev)}
        onRun={handleRun}
        onToggleAiPrompt={() => setAiPromptOpen((prev) => !prev)}
        onNewFile={() => setNewFileDialogOpen(true)}
      />
    </div>
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
}: {
  onToggleCommandPalette: () => void
  onToggleSidebar: () => void
  onToggleTerminal: () => void
  onRun: () => void
  onToggleAiPrompt: () => void
  onNewFile: () => void
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey

      if (isMeta && e.key === "k") {
        e.preventDefault()
        onToggleAiPrompt()
      }
      if (isMeta && e.shiftKey && e.key === "p") {
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
      if (isMeta && e.key === "r" && e.shiftKey) {
        e.preventDefault()
        onRun()
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

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onToggleCommandPalette, onToggleSidebar, onToggleTerminal, onRun, onToggleAiPrompt, onNewFile])

  return null
}
