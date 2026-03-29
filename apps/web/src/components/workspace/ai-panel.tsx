"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Bot,
  Sparkles,
  Send,
  X,
  Plus,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FilePlus,
  FileX,
  FileEdit,
  Loader2,
  Settings2,
  Power,
  Trash2,
  MessageSquare,
  CheckCheck,
  XOctagon,
  Pencil,
} from "lucide-react"
import type { AIAgent, AIChatSession, AIChatMessage, FileOperation, PresenceUser } from "@/data/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

// ─── Types ───────────────────────────────────────────────────────────────

interface AIPanelProps {
  agents: AIAgent[]
  chatSessions: AIChatSession[]
  presenceUsers: PresenceUser[]
  currentUserId: string
  /** Streaming state per message: messageId → accumulated text */
  streamingMessages: Record<string, string>
  onClose: () => void
  onSendChat: (opts: {
    chatId: string
    content: string
    agentId: string
    agentName: string
    agentInstructions?: string
  }) => void
  onOperationAction: (chatId: string, messageId: string, opIndex: number, action: "accept" | "reject") => void
  onBulkAction: (chatId: string, messageId: string, action: "accept" | "reject") => void
  onCreateAgent: (agent: { name: string; persona: string; systemPrompt: string; color: string }) => string
  onUpdateAgent: (id: string, updates: Partial<{ name: string; persona: string; systemPrompt: string; color: string; isActive: boolean }>) => void
  onDeleteAgent: (id: string) => void
  onOpenFile: (path: string) => void
  onRenameChat: (chatId: string, name: string) => void
  onDeleteChat: (chatId: string) => void
  /** Collaborative input Y.Text getter */
  getChatInputYText: (chatId: string) => unknown
  /** Update presence state for collaborative prompt editing */
  onPromptPresenceUpdate?: (state: {
    aiPromptChatId?: string | null
    aiPromptCursorPos?: number | null
    isTyping?: boolean
  }) => void
}

// ─── Agent Colors ────────────────────────────────────────────────────────

const AGENT_COLORS = [
  "hsl(172, 66%, 50%)", // teal (AI default)
  "hsl(270, 70%, 60%)", // purple
  "hsl(330, 70%, 60%)", // pink
  "hsl(30, 85%, 55%)",  // orange
  "hsl(200, 70%, 55%)", // blue
  "hsl(150, 60%, 50%)", // green
]

// ─── Sidebar Modes ───────────────────────────────────────────────────────

type PanelMode = "chats" | "agents" | "new-agent" | "edit-agent"
const SHARED_DRAFT_CHAT_ID = "__draft__"
const PROMPT_LINE_LIMIT = 36
const PROMPT_LINE_HEIGHT = 16
const PROMPT_CHAR_WIDTH = 7.2

function wrapPromptText(value: string, limit = PROMPT_LINE_LIMIT) {
  return value
    .split("\n")
    .map((line) => {
      if (line.length <= limit) return line
      let wrapped = ""
      for (let i = 0; i < line.length; i += limit) {
        if (i > 0) wrapped += "\n"
        wrapped += line.slice(i, i + limit)
      }
      return wrapped
    })
    .join("\n")
}

function mapOffsetToWrapped(value: string, offset: number, limit = PROMPT_LINE_LIMIT) {
  const safeOffset = Math.max(0, Math.min(offset, value.length))
  return wrapPromptText(value.slice(0, safeOffset), limit).length
}

function offsetToLineColumn(value: string, offset: number) {
  const safeOffset = Math.max(0, Math.min(offset, value.length))
  let line = 0
  let column = 0
  for (let i = 0; i < safeOffset; i++) {
    if (value[i] === "\n") {
      line++
      column = 0
    } else {
      column++
    }
  }
  return { line, column }
}

export function AIPanel({
  agents,
  chatSessions,
  presenceUsers,
  currentUserId,
  streamingMessages,
  onClose,
  onSendChat,
  onOperationAction,
  onBulkAction,
  onCreateAgent,
  onUpdateAgent,
  onDeleteAgent,
  onOpenFile,
  onRenameChat,
  onDeleteChat,
  getChatInputYText,
  onPromptPresenceUpdate,
}: AIPanelProps) {
  const [mode, setMode] = useState<PanelMode>("chats")
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null)

  // ── Find current chat ──
  const activeChat = chatSessions.find((c) => c.id === (activeChatId ?? (chatSessions.length > 0 ? chatSessions[0].id : null)))

  return (
    <div className="flex h-full w-full min-w-0 min-h-0 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border-subtle px-3 min-w-0">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-ai" />
          <span className="text-sm font-medium text-text-primary">AI Workspace</span>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setMode(mode === "agents" ? "chats" : "agents")}
              >
                <Settings2 className={cn("h-4 w-4", mode === "agents" ? "text-ai" : "text-text-tertiary")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{mode === "agents" ? "Back to chats" : "Manage agents"}</TooltipContent>
          </Tooltip>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {mode === "chats" && (
        <ChatView
          agents={agents}
          chatSessions={chatSessions}
          activeChatId={activeChatId}
          activeChat={activeChat}
          streamingMessages={streamingMessages}
          currentUserId={currentUserId}
          presenceUsers={presenceUsers}
          onSelectChat={setActiveChatId}
          onNewChat={() => {
            const chatId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
            setActiveChatId(chatId)
            // Agent selection is handled inside ChatView
          }}
          onSendChat={onSendChat}
          onOperationAction={onOperationAction}
          onBulkAction={onBulkAction}
          onOpenFile={onOpenFile}
          onRenameChat={onRenameChat}
          onDeleteChat={(chatId) => {
            onDeleteChat(chatId)
            if (activeChatId === chatId) {
              setActiveChatId(chatSessions.find(s => s.id !== chatId)?.id ?? null)
            }
          }}
          getChatInputYText={getChatInputYText}
          onPromptPresenceUpdate={onPromptPresenceUpdate}
        />
      )}

      {mode === "agents" && (
        <AgentsView
          agents={agents}
          onToggle={(id) => {
            const agent = agents.find((a) => a.id === id)
            if (agent) onUpdateAgent(id, { isActive: !agent.isActive })
          }}
          onEdit={(id) => {
            setEditingAgentId(id)
            setMode("edit-agent")
          }}
          onDelete={onDeleteAgent}
          onNewAgent={() => setMode("new-agent")}
        />
      )}

      {mode === "new-agent" && (
        <AgentForm
          onSave={(agent) => {
            onCreateAgent(agent)
            setMode("agents")
          }}
          onCancel={() => setMode("agents")}
        />
      )}

      {mode === "edit-agent" && editingAgentId && (
        <AgentForm
          initial={agents.find((a) => a.id === editingAgentId)}
          onSave={(updates) => {
            onUpdateAgent(editingAgentId, updates)
            setMode("agents")
          }}
          onCancel={() => setMode("agents")}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Chat View
// ═══════════════════════════════════════════════════════════════════════════

function ChatView({
  agents,
  chatSessions,
  activeChatId,
  activeChat,
  streamingMessages,
  currentUserId,
  presenceUsers,
  onSelectChat,
  onNewChat,
  onSendChat,
  onOperationAction,
  onBulkAction,
  onOpenFile,
  onRenameChat,
  onDeleteChat,
  getChatInputYText,
  onPromptPresenceUpdate,
}: {
  agents: AIAgent[]
  chatSessions: AIChatSession[]
  activeChatId: string | null
  activeChat: AIChatSession | undefined
  streamingMessages: Record<string, string>
  currentUserId: string
  presenceUsers: PresenceUser[]
  onSelectChat: (id: string) => void
  onNewChat: (agentId?: string) => void
  onSendChat: AIPanelProps["onSendChat"]
  onOperationAction: AIPanelProps["onOperationAction"]
  onBulkAction: AIPanelProps["onBulkAction"]
  onOpenFile: (path: string) => void
  onRenameChat: (chatId: string, name: string) => void
  onDeleteChat: (chatId: string) => void
  getChatInputYText: (chatId: string) => unknown
  onPromptPresenceUpdate?: AIPanelProps["onPromptPresenceUpdate"]
}) {
  const [inputValue, setInputValue] = useState("")
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [showAgentPicker, setShowAgentPicker] = useState(false)
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null)
  const [renamingValue, setRenamingValue] = useState("")
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; chatId: string } | null>(null)
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null)
  const suppressYTextSync = useRef(false)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const activeAgents = agents.filter((a) => a.isActive)

  // Derive selected agent — auto-select first active if none selected
  const effectiveAgentId = selectedAgentId ?? (activeAgents.length > 0 ? activeAgents[0].id : null)

  // Effective chat ID for Y.Text binding
  const effectiveChatId = activeChatId ?? (chatSessions.length > 0 ? chatSessions[0].id : SHARED_DRAFT_CHAT_ID)

  // ── Y.Text sync for shared chat input ──
  useEffect(() => {
    if (!effectiveChatId || !getChatInputYText) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const yt = getChatInputYText(effectiveChatId) as any
    if (!yt) return
    // Sync initial value via microtask to avoid synchronous setState in effect
    queueMicrotask(() => setInputValue(wrapPromptText(yt.toString())))
    const observer = () => {
      if (suppressYTextSync.current) return
      const wrapped = wrapPromptText(yt.toString())
      setInputValue(wrapped)
      if (wrapped !== yt.toString()) {
        suppressYTextSync.current = true
        yt.doc.transact(() => {
          if (yt.length > 0) yt.delete(0, yt.length)
          if (wrapped) yt.insert(0, wrapped)
        })
        suppressYTextSync.current = false
      }
    }
    yt.observe(observer)
    return () => yt.unobserve(observer)
  }, [effectiveChatId, getChatInputYText])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [activeChat?.messages.length, streamingMessages])

  // Auto-focus rename input
  useEffect(() => {
    if (renamingChatId && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renamingChatId])

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return
    const handler = () => setContextMenu(null)
    window.addEventListener("click", handler)
    return () => window.removeEventListener("click", handler)
  }, [contextMenu])

  const commitRename = useCallback(() => {
    if (renamingChatId && renamingValue.trim()) {
      onRenameChat(renamingChatId, renamingValue.trim())
    }
    setRenamingChatId(null)
    setRenamingValue("")
  }, [renamingChatId, renamingValue, onRenameChat])

  const selectedAgent = agents.find((a) => a.id === effectiveAgentId)

  const otherPromptCursors = useMemo(
    () =>
      presenceUsers.filter((user) => {
        const userId = user.id.split(":")[0]
        return (
          userId !== currentUserId &&
          user.isOnline &&
          user.aiPromptChatId === effectiveChatId &&
          typeof user.aiPromptCursorPos === "number"
        )
      }),
    [currentUserId, effectiveChatId, presenceUsers]
  )

  const renderedPromptCursors = useMemo(
    () =>
      otherPromptCursors.map((user) => {
        const pos = user.aiPromptCursorPos ?? 0
        const { line, column } = offsetToLineColumn(inputValue, pos)
        return { user, line, column }
      }),
    [inputValue, otherPromptCursors]
  )

  const updatePromptPresence = useCallback(
    (cursorPos: number | null, typing: boolean) => {
      onPromptPresenceUpdate?.({
        aiPromptChatId: effectiveChatId ?? null,
        aiPromptCursorPos: cursorPos,
        isTyping: typing,
      })
    },
    [effectiveChatId, onPromptPresenceUpdate]
  )

  const handleInputCursorUpdate = useCallback(() => {
    const input = inputRef.current
    if (!input) return
    const cursorPos = input.selectionStart ?? input.value.length
    updatePromptPresence(cursorPos, input.value.length > 0)
  }, [updatePromptPresence])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const rawValue = e.target.value
    const rawCursorPos = e.target.selectionStart ?? rawValue.length
    const wrappedValue = wrapPromptText(rawValue)
    const wrappedCursorPos = mapOffsetToWrapped(rawValue, rawCursorPos)
    setInputValue(wrappedValue)
    // Sync to Y.Text for collaborative editing
    if (effectiveChatId && getChatInputYText) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const yt = getChatInputYText(effectiveChatId) as any
      if (yt) {
        suppressYTextSync.current = true
        const current = yt.toString()
        if (current !== wrappedValue) {
          yt.doc.transact(() => {
            if (yt.length > 0) yt.delete(0, yt.length)
            if (wrappedValue) yt.insert(0, wrappedValue)
          })
        }
        suppressYTextSync.current = false
      }
    }
    queueMicrotask(() => {
      if (document.activeElement === inputRef.current) {
        inputRef.current?.setSelectionRange(wrappedCursorPos, wrappedCursorPos)
      }
    })
    updatePromptPresence(wrappedCursorPos, wrappedValue.length > 0)
  }, [effectiveChatId, getChatInputYText, updatePromptPresence])

  const handleSend = useCallback(() => {
    if (!inputValue.trim()) return

    // Use existing activeChatId, or create a new one if we have none
    let chatId = activeChatId
    if (!chatId) {
      chatId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      onSelectChat(chatId)
    }

    onSendChat({
      chatId: chatId!,
      content: inputValue.trim(),
      agentId: selectedAgent?.id ?? "__default__",
      agentName: selectedAgent?.name ?? "AI Assistant",
      agentInstructions: selectedAgent?.systemPrompt,
    })

    setInputValue("")
    // Clear Y.Text
    if (effectiveChatId && getChatInputYText) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const yt = getChatInputYText(effectiveChatId) as any
      if (yt && yt.length > 0) {
        suppressYTextSync.current = true
        yt.doc.transact(() => { yt.delete(0, yt.length) })
        suppressYTextSync.current = false
      }
    }
    updatePromptPresence(0, false)
    inputRef.current?.focus()
  }, [inputValue, selectedAgent, activeChatId, onSendChat, onSelectChat, effectiveChatId, getChatInputYText, updatePromptPresence])

  useEffect(() => {
    if (document.activeElement !== inputRef.current) return
    const cursorPos = inputRef.current?.selectionStart ?? inputValue.length
    updatePromptPresence(cursorPos, inputValue.length > 0)
  }, [effectiveChatId, inputValue.length, updatePromptPresence])

  useEffect(
    () => () => {
      onPromptPresenceUpdate?.({ aiPromptChatId: null, aiPromptCursorPos: null, isTyping: false })
    },
    [onPromptPresenceUpdate]
  )

  return (
    <div className="flex flex-1 flex-col overflow-hidden min-h-0 min-w-0">
      {/* Chat tabs */}
      {chatSessions.length > 0 && (
        <div className="flex items-center gap-px border-b border-border-subtle bg-surface overflow-x-auto shrink-0 px-1 py-1">
          {chatSessions.map((session) => {
            const agent = agents.find((a) => a.id === session.agentId)
            const isRenaming = renamingChatId === session.id
            return (
              <div
                key={session.id}
                className={cn(
                  "group/tab flex items-center gap-1 rounded-md px-2 py-1 text-xs whitespace-nowrap transition-colors min-w-0",
                  session.id === activeChatId
                    ? "bg-elevated text-text-primary"
                    : "text-text-tertiary hover:bg-hover/50 hover:text-text-secondary"
                )}
              >
                <button
                  onClick={() => onSelectChat(session.id)}
                  onDoubleClick={() => {
                    setRenamingChatId(session.id)
                    setRenamingValue(session.name || session.agentName)
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setContextMenu({ x: e.clientX, y: e.clientY, chatId: session.id })
                  }}
                  className="flex items-center gap-1.5 min-w-0"
                >
                  <div
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: agent?.color ?? "var(--ai)" }}
                  />
                  {isRenaming ? (
                    <input
                      ref={renameInputRef}
                      value={renamingValue}
                      onChange={(e) => setRenamingValue(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename()
                        if (e.key === "Escape") { setRenamingChatId(null); setRenamingValue("") }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-20 bg-elevated border border-border-default rounded px-1 py-0 text-xs text-text-primary outline-none focus:border-brand"
                    />
                  ) : (
                    <span className="truncate max-w-[80px]">{session.name || session.agentName}</span>
                  )}
                  {session.isGenerating && (
                    <Loader2 className="h-3 w-3 animate-spin text-ai shrink-0" />
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeletingChatId(session.id)
                  }}
                  className={cn(
                    "shrink-0 rounded p-0.5 transition-colors hover:bg-hover",
                    session.id === activeChatId
                      ? "opacity-60 hover:opacity-100"
                      : "opacity-0 group-hover/tab:opacity-60 group-hover/tab:hover:opacity-100"
                  )}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )
          })}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onNewChat()}
                className="flex items-center justify-center h-6 w-6 rounded-md text-text-tertiary hover:bg-hover hover:text-text-secondary transition-colors ml-1 shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>New chat</TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Agent picker dropdown */}
      <AnimatePresence>
        {showAgentPicker && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-b border-border-subtle bg-elevated overflow-hidden"
          >
            <div className="p-2 space-y-1">
              <p className="text-[10px] text-text-tertiary px-2 mb-1">Select agent to chat with:</p>
              {activeAgents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => {
                    onNewChat(agent.id)
                    setSelectedAgentId(agent.id)
                    setShowAgentPicker(false)
                  }}
                  className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-xs hover:bg-hover transition-colors"
                >
                  <div
                    className="h-5 w-5 rounded-md flex items-center justify-center"
                    style={{ backgroundColor: agent.color + "22" }}
                  >
                    <Sparkles className="h-3 w-3" style={{ color: agent.color }} />
                  </div>
                  <span className="text-text-primary">{agent.name}</span>
                  <span className="text-text-tertiary ml-auto">{agent.persona}</span>
                </button>
              ))}
              {activeAgents.length === 0 && (
                <p className="text-xs text-text-tertiary px-2 py-2">No active agents. Enable one in agent settings.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
        <div className="p-3 space-y-3 overflow-hidden">
          {!activeChat && chatSessions.length === 0 && (
            <EmptyState agents={activeAgents} onStartChat={(agentId) => {
              if (agentId) {
                setSelectedAgentId(agentId)
              }
              const chatId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
              onSelectChat(chatId)
            }} />
          )}

          {activeChat?.messages.map((message) => (
            <ChatMessageBubble
              key={message.id}
              message={message}
              chatId={activeChat.id}
              agents={agents}
              agentColor={agents.find((a) => a.id === activeChat.agentId)?.color}
              presenceUsers={presenceUsers}
              currentUserId={currentUserId}
              onOperationAction={onOperationAction}
              onBulkAction={onBulkAction}
              onOpenFile={onOpenFile}
            />
          ))}

          {/* Streaming indicator for response being built */}
          {activeChat?.isGenerating && (
            <div className="flex items-start gap-2">
              <div
                className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-lg shrink-0"
                style={{ backgroundColor: (agents.find(a => a.id === activeChat.agentId)?.color ?? "var(--ai)") + "22" }}
              >
                <Sparkles className="h-3.5 w-3.5" style={{ color: agents.find(a => a.id === activeChat.agentId)?.color ?? "var(--ai)" }} />
              </div>
              <div className="space-y-1.5 pt-0.5">
                <div className="skeleton h-3 w-48 rounded" />
                <div className="skeleton h-3 w-32 rounded" />
                <div className="skeleton h-3 w-40 rounded" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="border-t border-border-subtle p-2 shrink-0 min-w-0">
        {/* Agent selector */}
        <div className="flex items-center gap-1.5 mb-2 min-w-0 overflow-hidden">
          {selectedAgent && (
            <button
              onClick={() => setShowAgentPicker(!showAgentPicker)}
              className="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] bg-ai-muted text-ai border border-ai-muted-border hover:bg-ai-muted/80 transition-colors"
            >
              <Sparkles className="h-3 w-3" style={{ color: selectedAgent.color }} />
              <span>{selectedAgent.name}</span>
              <ChevronDown className="h-3 w-3" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative min-w-0 flex-1">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={handleInputChange}
              onClick={handleInputCursorUpdate}
              onSelect={handleInputCursorUpdate}
              onKeyUp={handleInputCursorUpdate}
              onFocus={handleInputCursorUpdate}
              onBlur={() => onPromptPresenceUpdate?.({ aiPromptChatId: null, aiPromptCursorPos: null, isTyping: false })}
              placeholder={selectedAgent ? `Ask ${selectedAgent.name}...` : "Ask AI Assistant..."}
              disabled={activeChat?.isGenerating}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              rows={3}
              className="w-full resize-none rounded-lg border-0 bg-elevated px-3 py-2 font-mono text-xs leading-4 text-text-primary placeholder:text-text-tertiary outline-none focus:ring-1 focus:ring-brand/40 disabled:opacity-50 min-w-0"
            />
            {renderedPromptCursors.map(({ user, line, column }) => {
              return (
                <div
                  key={user.id}
                  className="absolute pointer-events-none"
                  style={{
                    top: `${8 + line * PROMPT_LINE_HEIGHT}px`,
                    left: `${12 + column * PROMPT_CHAR_WIDTH}px`,
                  }}
                >
                  <div className="w-0.5 h-4 animate-pulse" style={{ backgroundColor: user.cursorColor }} />
                  <div
                    className="absolute -top-4 left-0 whitespace-nowrap rounded px-1 py-0.5 text-[9px] text-white"
                    style={{ backgroundColor: user.cursorColor }}
                  >
                    {user.name.split(" ")[0]}
                  </div>
                </div>
              )
            })}
          </div>
          <Button
            size="icon"
            className="h-7 w-7 shrink-0"
            disabled={!inputValue.trim() || activeChat?.isGenerating}
            onClick={handleSend}
          >
            {activeChat?.isGenerating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Context menu for chat tabs */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{ position: "fixed", left: contextMenu.x, top: contextMenu.y, zIndex: 100 }}
            className="rounded-lg border border-border-subtle bg-elevated shadow-lg py-1 min-w-[140px]"
          >
            <button
              onClick={() => {
                const session = chatSessions.find(s => s.id === contextMenu.chatId)
                setRenamingChatId(contextMenu.chatId)
                setRenamingValue(session?.name || session?.agentName || "")
                setContextMenu(null)
              }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-text-primary hover:bg-hover transition-colors"
            >
              <Pencil className="h-3 w-3" />
              Rename
            </button>
            <button
              onClick={() => {
                setDeletingChatId(contextMenu.chatId)
                setContextMenu(null)
              }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-error hover:bg-hover transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deletingChatId} onOpenChange={(open) => { if (!open) setDeletingChatId(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete chat</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this chat? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setDeletingChatId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (deletingChatId) onDeleteChat(deletingChatId)
                setDeletingChatId(null)
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Chat Message Bubble
// ═══════════════════════════════════════════════════════════════════════════

function ChatMessageBubble({
  message,
  chatId,
  agentColor,
  presenceUsers,
  onOperationAction,
  onBulkAction,
  onOpenFile,
}: {
  message: AIChatMessage
  chatId: string
  agents: AIAgent[]
  agentColor?: string
  presenceUsers: PresenceUser[]
  currentUserId: string
  onOperationAction: (chatId: string, messageId: string, opIndex: number, action: "accept" | "reject") => void
  onBulkAction: (chatId: string, messageId: string, action: "accept" | "reject") => void
  onOpenFile: (path: string) => void
}) {
  const isUser = message.role === "user"
  const [expandedOps, setExpandedOps] = useState<Set<number>>(new Set())

  const operations = message.operations ?? []
  const statuses = message.operationStatuses ?? []
  const allResolved = operations.length > 0 && statuses.every((s) => s === "accepted" || s === "rejected")
  const hasPending = statuses.some((s) => s === "pending")

  const toggleOp = (index: number) => {
    setExpandedOps((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  if (isUser) {
    const sender = presenceUsers.find((u) => u.id.startsWith(message.userId ?? ""))
    return (
      <div className="flex items-start gap-2 justify-end">
        <div className="max-w-[85%]">
          <div className="rounded-xl rounded-tr-sm bg-brand/10 border border-brand-muted-border px-3 py-2">
            <p className="text-xs text-text-primary whitespace-pre-wrap">{message.content}</p>
          </div>
          <div className="flex items-center justify-end gap-1 mt-0.5">
            <span className="text-[10px] text-text-tertiary">
              {sender?.name || message.userName || "You"}
            </span>
          </div>
        </div>
      </div>
    )
  }

  // Assistant message
  return (
    <div className="flex items-start gap-2">
      <div
        className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-lg shrink-0"
        style={{ backgroundColor: (agentColor ?? "var(--ai)") + "22" }}
      >
        <Sparkles className="h-3.5 w-3.5" style={{ color: agentColor ?? "var(--ai)" }} />
      </div>
      <div className="flex-1 min-w-0">
        {/* Message text */}
        <div className="rounded-xl rounded-tl-sm bg-elevated border border-border-subtle px-3 py-2">
          <p className="text-xs text-text-primary whitespace-pre-wrap leading-relaxed break-words">
            {message.content}
          </p>
        </div>

        {/* File operations */}
        {operations.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {operations.map((op, i) => (
              <OperationCard
                key={i}
                operation={op}
                status={statuses[i] ?? "pending"}
                expanded={expandedOps.has(i)}
                onToggle={() => toggleOp(i)}
                onAccept={() => onOperationAction(chatId, message.id, i, "accept")}
                onReject={() => onOperationAction(chatId, message.id, i, "reject")}
                onOpenFile={() => onOpenFile(op.path)}
              />
            ))}

            {/* Bulk actions */}
            {hasPending && (
              <div className="flex items-center gap-1.5 pt-1">
                <Button
                  size="sm"
                  className="h-6 gap-1 text-[10px] bg-ai hover:bg-ai/90 text-ai-foreground"
                  onClick={() => onBulkAction(chatId, message.id, "accept")}
                >
                  <CheckCheck className="h-3 w-3" />
                  Accept All
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 gap-1 text-[10px] text-error hover:text-error"
                  onClick={() => onBulkAction(chatId, message.id, "reject")}
                >
                  <XOctagon className="h-3 w-3" />
                  Reject All
                </Button>
              </div>
            )}

            {/* All resolved indicator */}
            {allResolved && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-1.5 text-[10px] text-success pt-0.5"
              >
                <CheckCircle2 className="h-3 w-3" />
                All changes resolved
              </motion.div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Operation Card
// ═══════════════════════════════════════════════════════════════════════════

function OperationCard({
  operation,
  status,
  expanded,
  onToggle,
  onAccept,
  onReject,
  onOpenFile,
}: {
  operation: FileOperation
  status: "pending" | "accepted" | "rejected"
  expanded: boolean
  onToggle: () => void
  onAccept: () => void
  onReject: () => void
  onOpenFile: () => void
}) {
  const OpIcon = operation.type === "create" ? FilePlus : operation.type === "delete" ? FileX : FileEdit
  const opColor = operation.type === "create" ? "text-success" : operation.type === "delete" ? "text-error" : "text-warning"
  const opLabel = operation.type === "create" ? "Create" : operation.type === "delete" ? "Delete" : "Update"
  const fileName = operation.path.split("/").pop() ?? operation.path

  return (
    <motion.div
      layout
      className={cn(
        "rounded-lg border overflow-hidden transition-colors",
        status === "accepted" ? "border-success/30 bg-success-muted" :
        status === "rejected" ? "border-error/30 bg-error-muted opacity-60" :
        "border-border-subtle bg-surface"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <button onClick={onToggle} className="flex items-center gap-1.5 flex-1 min-w-0">
          {expanded ? <ChevronDown className="h-3 w-3 text-text-tertiary shrink-0" /> : <ChevronRight className="h-3 w-3 text-text-tertiary shrink-0" />}
          <OpIcon className={cn("h-3.5 w-3.5 shrink-0", opColor)} />
          <span className="text-[10px] font-medium text-text-secondary">{opLabel}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onOpenFile() }}
            className="text-xs text-text-primary font-mono truncate hover:text-brand transition-colors"
          >
            {fileName}
          </button>
        </button>

        {/* Status / Actions */}
        {status === "pending" ? (
          <div className="flex items-center gap-1 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onAccept}
                  className="flex h-5 w-5 items-center justify-center rounded-md bg-success/10 text-success hover:bg-success/20 transition-colors"
                >
                  <Check className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Accept change</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onReject}
                  className="flex h-5 w-5 items-center justify-center rounded-md bg-error/10 text-error hover:bg-error/20 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Reject change</TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <Badge
            variant={status === "accepted" ? "ai" : "error"}
            className="text-[9px] px-1.5 py-0 h-4"
          >
            {status === "accepted" ? "Accepted" : "Rejected"}
          </Badge>
        )}
      </div>

      {/* Expanded content preview */}
      <AnimatePresence>
        {expanded && operation.content && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border-subtle">
              <pre className="p-2.5 font-mono text-[11px] leading-relaxed text-text-secondary overflow-x-auto max-h-[200px] overflow-y-auto break-all whitespace-pre-wrap">
                <code>{operation.content}</code>
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Agents View
// ═══════════════════════════════════════════════════════════════════════════

function AgentsView({
  agents,
  onToggle,
  onEdit,
  onDelete,
  onNewAgent,
}: {
  agents: AIAgent[]
  onToggle: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onNewAgent: () => void
}) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          <p className="text-[10px] text-text-tertiary uppercase tracking-wider font-medium px-1 mb-2">
            Agents ({agents.length})
          </p>
          {agents.map((agent) => (
            <motion.div
              key={agent.id}
              layout
              className={cn(
                "rounded-xl border p-3 transition-all group",
                agent.isActive
                  ? "border-ai-muted-border bg-ai-muted"
                  : "border-border-subtle bg-surface hover:border-border-default"
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
                    style={{ backgroundColor: agent.color + "22" }}
                  >
                    <Sparkles className="h-4 w-4" style={{ color: agent.color }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{agent.name}</p>
                    <p className="text-xs text-text-tertiary truncate">{agent.persona}</p>
                  </div>
                </div>
                <div className="flex items-center gap-0.5">
                  <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => onEdit(agent.id)}>
                    <Settings2 className="h-3.5 w-3.5 text-text-tertiary" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => onDelete(agent.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-error" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onToggle(agent.id)}>
                    <Power className={cn("h-4 w-4", agent.isActive ? "text-ai" : "text-text-tertiary")} />
                  </Button>
                </div>
              </div>
              {agent.isActive && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  className="mt-2 pt-2 border-t border-border-subtle"
                >
                  <Badge variant="ai" className="text-[10px]">Active</Badge>
                </motion.div>
              )}
            </motion.div>
          ))}

          {agents.length === 0 && (
            <div className="text-center py-8">
              <Bot className="h-8 w-8 text-text-tertiary mx-auto mb-2" />
              <p className="text-sm text-text-secondary">No agents yet</p>
              <p className="text-xs text-text-tertiary mt-1">Create one to get started</p>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-3 border-t border-border-subtle">
        <Button
          variant="outline"
          size="sm"
          className="w-full h-8 text-xs gap-1.5"
          onClick={onNewAgent}
        >
          <Plus className="h-3 w-3" />
          Create Agent
        </Button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Agent Form (Create / Edit)
// ═══════════════════════════════════════════════════════════════════════════

function AgentForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: AIAgent
  onSave: (data: { name: string; persona: string; systemPrompt: string; color: string }) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? "")
  const [persona, setPersona] = useState(initial?.persona ?? "")
  const [systemPrompt, setSystemPrompt] = useState(initial?.systemPrompt ?? "")
  const [color, setColor] = useState(initial?.color ?? AGENT_COLORS[0])

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Frontend Lead"
              className="h-8 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">Persona</label>
            <Input
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              placeholder="e.g. Expert in React & TypeScript"
              className="h-8 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">Color</label>
            <div className="flex items-center gap-2">
              {AGENT_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-6 w-6 rounded-full ring-2 ring-offset-2 ring-offset-background transition-all",
                    color === c ? "ring-text-primary scale-110" : "ring-transparent hover:ring-border-default"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">Custom Instructions</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="e.g. Focus on accessibility and performance. Use TypeScript strict mode. Prefer functional components..."
              rows={6}
              className="w-full rounded-lg border border-border-default bg-elevated px-3 py-2 text-xs text-text-primary placeholder:text-text-tertiary outline-none focus:border-brand resize-none leading-relaxed"
            />
          </div>
        </div>
      </ScrollArea>

      <div className="flex items-center gap-2 p-3 border-t border-border-subtle">
        <Button variant="ghost" size="sm" className="flex-1 h-8 text-xs" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          className="flex-1 h-8 text-xs bg-ai hover:bg-ai/90 text-ai-foreground"
          disabled={!name.trim()}
          onClick={() => onSave({ name: name.trim(), persona: persona.trim(), systemPrompt: systemPrompt.trim(), color })}
        >
          {initial ? "Save Changes" : "Create Agent"}
        </Button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Empty State
// ═══════════════════════════════════════════════════════════════════════════

function EmptyState({
  agents,
  onStartChat,
}: {
  agents: AIAgent[]
  onStartChat: (agentId?: string) => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ai-muted mb-4">
        <Bot className="h-6 w-6 text-ai" />
      </div>
      <h3 className="text-sm font-medium text-text-primary mb-1">AI Workspace</h3>
      <p className="text-xs text-text-tertiary text-center mb-6 max-w-[200px]">
        Chat with AI agents to create, edit, and refactor code in your project.
      </p>

      <div className="space-y-2 w-full">
        {/* Default AI option */}
        <button
          onClick={() => onStartChat()}
          className="flex items-center gap-3 w-full rounded-xl border border-border-subtle bg-surface p-3 hover:border-ai-muted-border hover:bg-ai-muted/30 transition-all"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0 bg-ai-muted">
            <Bot className="h-4 w-4 text-ai" />
          </div>
          <div className="text-left min-w-0">
            <p className="text-sm font-medium text-text-primary">AI Assistant</p>
            <p className="text-xs text-text-tertiary truncate">General-purpose coding assistant</p>
          </div>
          <MessageSquare className="h-4 w-4 text-text-tertiary ml-auto shrink-0" />
        </button>
        {agents.map((agent) => (
          <button
            key={agent.id}
            onClick={() => onStartChat(agent.id)}
            className="flex items-center gap-3 w-full rounded-xl border border-border-subtle bg-surface p-3 hover:border-ai-muted-border hover:bg-ai-muted/30 transition-all"
          >
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
              style={{ backgroundColor: agent.color + "22" }}
            >
              <Sparkles className="h-4 w-4" style={{ color: agent.color }} />
            </div>
            <div className="text-left min-w-0">
              <p className="text-sm font-medium text-text-primary">{agent.name}</p>
              <p className="text-xs text-text-tertiary truncate">{agent.persona}</p>
            </div>
            <MessageSquare className="h-4 w-4 text-text-tertiary ml-auto shrink-0" />
          </button>
        ))}
      </div>
    </div>
  )
}
