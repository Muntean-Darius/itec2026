"use client"

import { useState, useCallback, useEffect } from "react"
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
} from "lucide-react"
import Link from "next/link"
import type { User, Project, FileNode, PresenceUser, AIAgent, Snapshot } from "@/data/types"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Separator } from "@/components/ui/separator"
import { ResizeHandle } from "@/components/ui/resize-handle"
import { PresenceDock } from "./presence-dock"
import { FileTree } from "./file-tree"
import { CodeEditor } from "./code-editor"
import { TerminalPanel } from "./terminal-panel"
import { CommandPalette } from "./command-palette"
import { TimeTravelSlider } from "./time-travel-slider"
import { AgentRoster } from "./agent-roster"
import { AIInlinePrompt } from "./ai-inline-prompt"
import { CollaborationCursors } from "./collaboration-cursors"
import { NewFileDialog } from "./new-file-dialog"

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
  // File state
  const [files, setFiles] = useState<FileNode[]>(initialFiles)
  const [activeFilePath, setActiveFilePath] = useState<string>(
    initialFiles[0]?.path ?? ""
  )
  const [openFiles, setOpenFiles] = useState<string[]>([
    initialFiles[0]?.path ?? "",
  ])

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

  const activeFile = files.find((f) => f.path === activeFilePath)

  const handleOpenFile = useCallback(
    (path: string) => {
      setActiveFilePath(path)
      setOpenFiles((prev) => (prev.includes(path) ? prev : [...prev, path]))
    },
    []
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
      const ext = path.split(".").pop() ?? ""
      const langMap: Record<string, string> = {
        ts: "typescript",
        tsx: "typescript",
        js: "javascript",
        jsx: "javascript",
        json: "json",
        css: "css",
        md: "markdown",
        html: "html",
      }
      const newFile: FileNode = {
        path: path.startsWith("/") ? path : "/" + path,
        content: "",
        language: langMap[ext] ?? "plaintext",
      }
      setFiles((prev) => [...prev, newFile])
      handleOpenFile(newFile.path)
    },
    [handleOpenFile]
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
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-border-subtle px-3">
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

          <span className="text-sm font-medium text-text-primary truncate max-w-[200px]">
            {project.name}
          </span>
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
        <div className="flex items-center gap-2">
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
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Share2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Share workspace</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-5" />

          <PresenceDock
            users={initialPresence}
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
                presence={initialPresence}
                onOpenFile={handleOpenFile}
                onNewFile={() => setNewFileDialogOpen(true)}
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
                  <button
                    key={filePath}
                    onClick={() => setActiveFilePath(filePath)}
                    className={`group flex items-center gap-1.5 rounded-md px-3 py-1 text-xs transition-colors ${
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
                  </button>
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
                  file={activeFile}
                  readOnly={timeTravelActive}
                />
                {/* Collaboration cursors overlay */}
                <CollaborationCursors
                  presence={initialPresence}
                  currentUserId={currentUser.id}
                  activeFilePath={activeFilePath}
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
                <TerminalPanel isRunning={isRunning} />
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
