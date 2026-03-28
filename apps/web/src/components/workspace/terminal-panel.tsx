"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import { Terminal as TermIcon, Plus, X } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import type { TerminalLine, PresenceUser } from "@/data/types"
import type { TerminalSession } from "@/lib/collaboration"

interface TerminalDraft {
  userId: string
  name: string
  cursorColor: string
  sessionId: string
  text: string
}

interface TerminalPanelProps {
  isRunning: boolean
  sessions: TerminalSession[]
  activeSessionId: string | null
  onSelectSession: (id: string) => void
  onCreateSession: () => void
  onDeleteSession: (id: string) => void
  onInput?: (content: string) => void
  /** Other users' draft terminal input (from awareness) */
  terminalDrafts?: TerminalDraft[]
  /** Called when user types in terminal (for awareness sharing) */
  onDraftChange?: (sessionId: string, text: string) => void
}

export function TerminalPanel({
  isRunning,
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  onInput,
  terminalDrafts = [],
  onDraftChange,
}: TerminalPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // Per-session input state to prevent leaking between tabs
  const [inputPerSession, setInputPerSession] = useState<Record<string, string>>({})

  const activeSession = sessions.find((s) => s.id === activeSessionId)
  const lines: TerminalLine[] = activeSession?.lines ?? []
  const inputValue = (activeSessionId ? inputPerSession[activeSessionId] : "") ?? ""

  const setInputValue = useCallback((value: string) => {
    if (!activeSessionId) return
    setInputPerSession(prev => ({ ...prev, [activeSessionId]: value }))
    onDraftChange?.(activeSessionId, value)
  }, [activeSessionId, onDraftChange])

  // Auto-focus input when switching sessions or when created
  useEffect(() => {
    if (activeSessionId) {
      // Small delay to let React render the new session
      const timer = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(timer)
    }
  }, [activeSessionId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [lines, isRunning])

  const handleSubmit = useCallback(() => {
    if (!inputValue.trim()) return
    onInput?.(inputValue.trim())
    setInputValue("")
  }, [inputValue, onInput, setInputValue])

  // Other users' drafts for the active terminal session
  const activeDrafts = terminalDrafts.filter(
    (d) => d.sessionId === activeSessionId && d.text.length > 0
  )

  return (
    <div className="flex h-full flex-col bg-terminal-bg">
      {/* Terminal header with session tabs */}
      <div className="flex h-8 shrink-0 items-center border-b border-border-subtle px-1">
        <div className="flex flex-1 items-center gap-0.5 overflow-x-auto">
          {sessions.map((session) => {
            const isActive = session.id === activeSessionId
            return (
              <div
                key={session.id}
                role="tab"
                tabIndex={0}
                aria-selected={isActive}
                onClick={() => onSelectSession(session.id)}
                onKeyDown={(e) => { if (e.key === "Enter") onSelectSession(session.id) }}
                className={cn(
                  "group flex cursor-pointer items-center gap-1 rounded-md px-2 py-0.5 text-xs transition-colors",
                  isActive
                    ? "bg-elevated text-text-primary"
                    : "text-text-tertiary hover:bg-hover hover:text-text-secondary"
                )}
              >
                <TermIcon className="h-3 w-3" />
                <span className="truncate max-w-[90px]">{session.name}</span>
                {sessions.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteSession(session.id)
                    }}
                    className="ml-0.5 rounded-sm opacity-0 transition-opacity group-hover:opacity-100 hover:bg-active"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            )
          })}

          {/* Create new session button */}
          <button
            onClick={onCreateSession}
            className="flex items-center justify-center rounded-md p-1 text-text-tertiary transition-colors hover:bg-hover hover:text-text-secondary"
            title="New terminal session"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {isRunning && (
          <span className="ml-auto flex items-center gap-1.5 pr-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            <span className="text-xs text-success">Running</span>
          </span>
        )}
      </div>

      {/* Terminal output for active session */}
      {activeSession ? (
        <ScrollArea
          className="flex-1 font-mono text-xs"
          onClick={() => inputRef.current?.focus()}
        >
          <div className="p-3 leading-relaxed">
            {lines.map((line) => (
              <div
                key={line.id}
                className={cn(
                  "whitespace-pre-wrap",
                  line.type === "stdin" && "text-brand",
                  line.type === "stdout" && "text-text-primary",
                  line.type === "stderr" && "text-error"
                )}
              >
                {line.type === "stdin" && (
                  <span className="text-text-tertiary">$ </span>
                )}
                {line.content}
              </div>
            ))}

            {isRunning && (
              <div className="mt-1 flex items-center gap-2">
                <span className="text-text-tertiary">$</span>
                <span className="text-ai">Scanning for vulnerabilities...</span>
                <span className="inline-block animate-pulse text-text-tertiary">▊</span>
              </div>
            )}

            {/* Other users' draft input */}
            {activeDrafts.map((draft) => (
              <div key={draft.userId} className="flex items-center gap-1 opacity-50">
                <span
                  className="text-[10px]"
                  style={{ color: draft.cursorColor }}
                >
                  {draft.name}:
                </span>
                <span className="text-text-tertiary">$ </span>
                <span
                  className="text-text-secondary"
                  style={{ borderLeft: `2px solid ${draft.cursorColor}`, paddingLeft: 2 }}
                >
                  {draft.text}
                </span>
              </div>
            ))}

            {!isRunning && (
              <div className="flex items-center gap-1">
                <span className="text-text-tertiary">~/itecify $&nbsp;</span>
                <input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSubmit()
                  }}
                  className="flex-1 bg-transparent text-text-primary outline-none font-mono text-xs caret-brand"
                  spellCheck={false}
                  autoComplete="off"
                  autoFocus
                />
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
