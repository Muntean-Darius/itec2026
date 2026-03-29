"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import { Terminal as TermIcon, Plus, X } from "lucide-react"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { TerminalLine, PresenceUser } from "@/data/types"
import type { TerminalSession, DockerStatus } from "@/lib/collaboration"

interface TerminalPanelProps {
  sessions: TerminalSession[]
  activeSessionId: string | null
  onSelectSession: (id: string) => void
  onCreateSession: () => void
  onDeleteSession: (id: string) => void
  onInput?: (content: string) => void
  /** Y.Text for the shared terminal input (from collab hook) */
  inputYText?: unknown
  /** Awareness instance for collaborative cursor in terminal */
  awareness?: unknown
  /** Other users in the workspace (for terminal cursors) */
  presenceUsers?: PresenceUser[]
  /** Current user's ID */
  currentUserId?: string
  /** Docker container status */
  dockerStatus?: DockerStatus
  /** Docker error message */
  dockerError?: string | null
  /** Docker creation log lines */
  dockerLogs?: string[]
  /** Per-session busy state (command is running) */
  terminalBusy?: Record<string, boolean>
  /** Per-session current working directory */
  terminalCwds?: Record<string, string>
  /** Callback to send CTRL+C interrupt to a session */
  onInterrupt?: (sessionId: string) => void
}

/** Format cwd for display: replace /home/itecify/workspace with ~ */
function formatCwd(cwd: string): string {
  return cwd
    .replace(/^\/home\/itecify\/workspace\/?/, "~/workspace/")
    .replace(/\/$/, "") || "~"
}

export function TerminalPanel({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  onInput,
  inputYText,
  awareness,
  presenceUsers = [],
  currentUserId,
  dockerStatus,
  dockerError,
  dockerLogs = [],
  terminalBusy = {},
  terminalCwds = {},
  onInterrupt,
}: TerminalPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [inputValue, setInputValue] = useState("")
  const suppressYTextSync = useRef(false)
  // Track which terminal session the user last viewed & line count for highlights
  const [lastSeenLines, setLastSeenLines] = useState<Record<string, number>>({})
  // Track unread counts for badge
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  // Command history per session
  const [commandHistory, setCommandHistory] = useState<Record<string, string[]>>({})
  const [historyIndex, setHistoryIndex] = useState<number>(-1)
  // Stash the current input when browsing history
  const historyStash = useRef<string>("")

  const isSessionBusy = activeSessionId ? (terminalBusy[activeSessionId] ?? false) : false
  const sessionCwd = activeSessionId ? (terminalCwds[activeSessionId] ?? "/home/itecify/workspace") : ""

  const activeSession = sessions.find((s) => s.id === activeSessionId)
  const lines: TerminalLine[] = activeSession?.lines ?? []

  // Show toast on Docker error
  useEffect(() => {
    if (dockerStatus === "error" && dockerError) {
      toast.error("Docker Container Error", {
        description: dockerError,
        duration: 10_000,
      })
    }
  }, [dockerStatus, dockerError])

  // Mark current session as read when viewing
  useEffect(() => {
    if (activeSessionId && activeSession) {
      setLastSeenLines((prev) => ({ ...prev, [activeSessionId]: activeSession.lines.length }))
      setUnreadCounts((prev) => ({ ...prev, [activeSessionId]: 0 }))
    }
  }, [activeSessionId, activeSession])

  // Track unread lines for inactive sessions
  useEffect(() => {
    for (const session of sessions) {
      if (session.id === activeSessionId) continue
      const lastSeen = lastSeenLines[session.id] ?? 0
      const newCount = Math.max(0, session.lines.length - lastSeen)
      if (newCount > 0) {
        setUnreadCounts((prev) => ({
          ...prev,
          [session.id]: newCount,
        }))
      }
    }
  }, [sessions, activeSessionId, lastSeenLines])

  // Compute which lines are "new" in the current active session
  const currentLastSeen = activeSessionId ? (lastSeenLines[activeSessionId] ?? lines.length) : lines.length
  const newLinesStartIdx = currentLastSeen

  // ── Y.Text sync for shared terminal input ──
  useEffect(() => {
    if (!inputYText) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const yt = inputYText as any
    // Sync initial value
    setInputValue(yt.toString())

    const observer = () => {
      if (suppressYTextSync.current) return
      setInputValue(yt.toString())
    }
    yt.observe(observer)
    return () => yt.unobserve(observer)
  }, [inputYText])

  // Auto-focus input when switching sessions
  useEffect(() => {
    if (activeSessionId) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(timer)
    }
  }, [activeSessionId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [lines, isSessionBusy])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    const cursorPos = e.target.selectionStart ?? newValue.length
    setInputValue(newValue)

    // Sync to Y.Text for collaborative editing
    if (inputYText) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const yt = inputYText as any
      suppressYTextSync.current = true
      // Simple diff: replace entire content. For more granular edits we'd compute a diff,
      // but Y.Text handles concurrent edits correctly regardless.
      const current = yt.toString()
      if (current !== newValue) {
        yt.doc.transact(() => {
          if (yt.length > 0) yt.delete(0, yt.length)
          if (newValue) yt.insert(0, newValue)
        })
      }
      suppressYTextSync.current = false
    }

    // Update terminal cursor position in awareness
    if (awareness && activeSessionId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const aw = awareness as any
      const current = aw.getLocalState()?.user || {}
      aw.setLocalStateField("user", {
        ...current,
        terminalSessionId: activeSessionId,
        terminalCursorPos: cursorPos,
      })
    }
  }, [inputYText, awareness, activeSessionId])

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const sessionId = activeSessionId
    if (!sessionId) return

    // CTRL+C: interrupt running process
    if (e.key === "c" && (e.ctrlKey || e.metaKey)) {
      const isBusy = terminalBusy[sessionId] ?? false
      if (isBusy && onInterrupt) {
        e.preventDefault()
        onInterrupt(sessionId)
        return
      }
      // If not busy, let the browser handle copy
      return
    }

    const history = commandHistory[sessionId] ?? []
    const isBusy = terminalBusy[sessionId] ?? false

    if (e.key === "Enter" && (inputValue.trim() || isBusy)) {
      const cmd = inputValue
      if (!isBusy && cmd.trim()) {
        // Add to command history (only for shell commands, not process input)
        setCommandHistory((prev) => {
          const sessionHist = prev[sessionId] ?? []
          return { ...prev, [sessionId]: [...sessionHist, cmd.trim()] }
        })
      }
      setHistoryIndex(-1)
      historyStash.current = ""

      onInput?.(isBusy ? cmd : cmd.trim())
      setInputValue("")
      // Clear Y.Text
      if (inputYText) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const yt = inputYText as any
        suppressYTextSync.current = true
        if (yt.length > 0) {
          yt.doc.transact(() => { yt.delete(0, yt.length) })
        }
        suppressYTextSync.current = false
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      if (history.length === 0) return
      const newIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1)
      if (historyIndex === -1) {
        // Stash current input before browsing
        historyStash.current = inputValue
      }
      setHistoryIndex(newIndex)
      const histCmd = history[newIndex] ?? ""
      setInputValue(histCmd)
      syncInputToYText(histCmd)
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      if (historyIndex === -1) return
      const newIndex = historyIndex + 1
      if (newIndex >= history.length) {
        // Restore stashed input
        setHistoryIndex(-1)
        setInputValue(historyStash.current)
        syncInputToYText(historyStash.current)
      } else {
        setHistoryIndex(newIndex)
        const histCmd = history[newIndex] ?? ""
        setInputValue(histCmd)
        syncInputToYText(histCmd)
      }
    }
  }, [inputValue, onInput, inputYText, activeSessionId, commandHistory, historyIndex, terminalBusy, onInterrupt])

  /** Helper: sync a value to Y.Text */
  const syncInputToYText = useCallback((value: string) => {
    if (!inputYText) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const yt = inputYText as any
    suppressYTextSync.current = true
    const current = yt.toString()
    if (current !== value) {
      yt.doc.transact(() => {
        if (yt.length > 0) yt.delete(0, yt.length)
        if (value) yt.insert(0, value)
      })
    }
    suppressYTextSync.current = false
  }, [inputYText])

  const handleInputClick = useCallback(() => {
    if (awareness && activeSessionId && inputRef.current) {
      const cursorPos = inputRef.current.selectionStart ?? 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const aw = awareness as any
      const current = aw.getLocalState()?.user || {}
      aw.setLocalStateField("user", {
        ...current,
        terminalSessionId: activeSessionId,
        terminalCursorPos: cursorPos,
      })
    }
  }, [awareness, activeSessionId])

  // Get other users' terminal cursor positions for this session
  const otherTerminalCursors = presenceUsers
    .filter((p) => {
      const userId = p.id.split(":")[0]
      return userId !== currentUserId &&
        p.terminalSessionId === activeSessionId &&
        p.isOnline
    })

  return (
    <div className="relative flex h-full flex-col bg-terminal-bg">
      {/* Terminal header with session tabs */}
      <div className="flex h-8 shrink-0 items-center border-b border-border-subtle px-1">
        <div className="flex flex-1 items-center gap-0.5 overflow-x-auto">
          {sessions.map((session) => {
            const isActive = session.id === activeSessionId
            const unread = unreadCounts[session.id] ?? 0
            return (
              <div
                key={session.id}
                role="tab"
                tabIndex={0}
                aria-selected={isActive}
                onClick={() => onSelectSession(session.id)}
                onKeyDown={(e) => { if (e.key === "Enter") onSelectSession(session.id) }}
                className={cn(
                  "group relative flex cursor-pointer items-center gap-1 rounded-md px-2 py-0.5 text-xs transition-colors",
                  isActive
                    ? "bg-elevated text-text-primary"
                    : "text-text-tertiary hover:bg-hover hover:text-text-secondary"
                )}
              >
                <TermIcon className="h-3 w-3" />
                <span className="truncate max-w-[90px]">{session.name}</span>
                {unread > 0 && !isActive && (
                  <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-medium text-white">
                    {unread}
                  </span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteSession(session.id)
                  }}
                  className="ml-0.5 rounded-sm opacity-0 transition-opacity group-hover:opacity-100 hover:bg-active"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )
          })}

          <button
            onClick={onCreateSession}
            className="flex items-center justify-center rounded-md p-1 text-text-tertiary transition-colors hover:bg-hover hover:text-text-secondary"
            title="New terminal session"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>



        {isSessionBusy && (
          <span className="ml-auto flex items-center gap-1.5 pr-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            <span className="text-xs text-success">Running</span>
          </span>
        )}

        {!isSessionBusy && dockerStatus && dockerStatus !== "ready" && (
          <span className="ml-auto flex items-center gap-1.5 pr-2">
            {dockerStatus === "creating" && (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-warning" />
                </span>
                <span className="text-xs text-warning">Docker starting...</span>
              </>
            )}
            {dockerStatus === "error" && (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-error" />
                </span>
                <span className="text-xs text-error">Docker error</span>
              </>
            )}
            {dockerStatus === "destroyed" && (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-text-tertiary" />
                </span>
                <span className="text-xs text-text-tertiary">Docker stopped</span>
              </>
            )}
          </span>
        )}

        {!isSessionBusy && dockerStatus === "ready" && (
          <span className="ml-auto flex items-center gap-1.5 pr-2">
            <span className="relative flex h-2 w-2">
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            <span className="text-xs text-success">Docker ready</span>
          </span>
        )}

        {!isSessionBusy && dockerStatus === null && (
          <span className="ml-auto flex items-center gap-1.5 pr-2">
            <span className="relative flex h-2 w-2">
              <span className="relative inline-flex h-2 w-2 rounded-full bg-text-tertiary opacity-50" />
            </span>
            <span className="text-xs text-text-tertiary">Docker idle</span>
          </span>
        )}
      </div>

      {/* Docker loading overlay — only when actively creating container */}
      {dockerStatus === "creating" && activeSession && (
        <div className="absolute inset-0 top-8 z-10 flex flex-col items-center justify-center gap-3 bg-terminal-bg/90 text-text-tertiary">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm font-medium">Starting Docker instance...</span>
          </div>
          {dockerLogs.length > 0 ? (
            <div className="w-full max-w-sm rounded-md bg-black/40 px-3 py-2 font-mono text-xs text-text-secondary">
              {dockerLogs.map((line, i) => (
                <div key={i} className="flex items-center gap-1.5 leading-relaxed">
                  <span className="select-none text-brand">$</span>
                  <span>{line}</span>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-xs text-text-tertiary">
              Your workspace container is being prepared. This usually takes a few seconds.
            </span>
          )}
        </div>
      )}

      {/* Docker error overlay */}
      {dockerStatus === "error" && activeSession && (
        <div className="absolute inset-0 top-8 z-10 flex flex-col items-center justify-center gap-3 bg-terminal-bg/90 text-text-tertiary">
          <span className="text-sm font-medium text-error">Docker instance failed to start</span>
          {dockerError && (
            <code className="max-w-md rounded-md bg-elevated px-3 py-2 text-xs text-error/80 break-all">
              {dockerError}
            </code>
          )}
          <span className="text-xs text-text-tertiary">
            Try refreshing the page. If the problem persists, contact support.
          </span>
        </div>
      )}

      {/* Terminal output for active session */}
      {activeSession ? (
        <ScrollArea
          className="flex-1 font-mono text-xs"
          onClick={() => inputRef.current?.focus()}
        >
          <div className="p-3 leading-relaxed">
            {lines.map((line, idx) => {
              const isNew = idx >= newLinesStartIdx
              return (
                <div
                  key={line.id}
                  className={cn(
                    "whitespace-pre-wrap",
                    line.type === "stdin" && "text-brand",
                    line.type === "stdout" && "text-text-primary",
                    line.type === "stderr" && "text-error",
                    isNew && "border-l-2 border-brand/40 pl-2 bg-brand/5 -ml-2 rounded-r-sm"
                  )}
                >
                  {line.type === "stdin" && (
                    <span className="text-text-tertiary">{line.cwd ? formatCwd(line.cwd) + " $ " : "$ "}</span>
                  )}
                  {line.content}
                </div>
              )
            })}

            {isSessionBusy && (
              <div className="relative">
                <div className="flex items-center gap-1">
                  <span className="inline-block animate-pulse text-text-tertiary">▊</span>
                  <div className="relative flex-1">
                    <input
                      ref={inputRef}
                      value={inputValue}
                      onChange={handleInputChange}
                      onKeyDown={handleInputKeyDown}
                      className="w-full bg-transparent text-text-primary outline-none font-mono text-xs caret-brand"
                      spellCheck={false}
                      autoComplete="off"
                      placeholder=""
                      autoFocus
                    />
                  </div>
                </div>
              </div>
            )}

            {!isSessionBusy && (
              <div className="relative">
                <div className="flex items-center gap-1">
                  <span className="text-text-tertiary shrink-0">{formatCwd(sessionCwd)} $&nbsp;</span>
                  <div className="relative flex-1">
                    <input
                      ref={inputRef}
                      value={inputValue}
                      onChange={handleInputChange}
                      onKeyDown={handleInputKeyDown}
                      onClick={handleInputClick}
                      onSelect={handleInputClick}
                      className="w-full bg-transparent text-text-primary outline-none font-mono text-xs caret-brand"
                      spellCheck={false}
                      autoComplete="off"
                      autoFocus
                    />
                    {/* Remote cursors in terminal input */}
                    {otherTerminalCursors.map((user) => {
                      const pos = (user as PresenceUser & { terminalCursorPos?: number }).terminalCursorPos ?? 0
                      // Approximate character width for cursor positioning
                      const charWidth = 7.2 // monospace ~7.2px at 12px font size
                      return (
                        <div
                          key={user.id}
                          className="absolute top-0 pointer-events-none"
                          style={{ left: `${pos * charWidth}px` }}
                        >
                          <div
                            className="w-0.5 h-4 animate-pulse"
                            style={{ backgroundColor: user.cursorColor }}
                          />
                          <div
                            className="absolute -top-3.5 left-0 whitespace-nowrap rounded px-1 py-0.5 text-[9px] text-white"
                            style={{ backgroundColor: user.cursorColor }}
                          >
                            {user.name.split(" ")[0]}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      ) : (
        <div className="flex flex-1 items-center justify-center text-text-tertiary">
          <button
            onClick={onCreateSession}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-xs transition-colors hover:bg-hover"
          >
            <Plus className="h-4 w-4" />
            Create a terminal session
          </button>
        </div>
      )}
    </div>
  )
}
