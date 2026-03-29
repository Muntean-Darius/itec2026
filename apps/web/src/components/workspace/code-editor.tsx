"use client"

import { useRef, useEffect, useState, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Check, X, Sparkles, Undo2, Redo2 } from "lucide-react"
import type { FileNode, FileOperation } from "@/data/types"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"

/** Pending AI operation on this file (from AI chat messages) */
export interface AIBlock {
  messageId: string
  chatId: string
  operationIndex: number
  operation: FileOperation
  status: "pending" | "accepted" | "rejected"
  agentColor?: string
}

/** Recently accepted AI block for quick-undo */
export interface RecentAIAccept {
  messageId: string
  chatId: string
  operationIndex: number
  originalContent: string
  /** The new content after AI change (for redo) */
  newContent: string
  acceptedAt: number
  filePath: string
  /** Line range where content was inserted (for gutter positioning) */
  startLine?: number
  endLine?: number
}

/** Recently undone AI change (for redo) */
export interface RecentAIUndo {
  messageId: string
  originalContent: string
  newContent: string
  undoneAt: number
  filePath: string
  startLine?: number
}

interface CodeEditorProps {
  file: FileNode
  readOnly?: boolean
  /** Y.Text instance for this file (from collab hook) */
  yText?: unknown
  /** Yjs Awareness instance (from collab hook) */
  awareness?: unknown
  /** Fallback for when Yjs binding is not available */
  onContentChange?: (content: string) => void
  /** Pending AI operation blocks on this file */
  aiBlocks?: AIBlock[]
  /** Callback when user clicks accept/reject on an inline AI block */
  onAIBlockAction?: (chatId: string, messageId: string, opIndex: number, action: "accept" | "reject") => void
  /** Recently accepted AI operations (for quick-undo) */
  recentAccepts?: RecentAIAccept[]
  /** Callback to undo a recently accepted AI operation */
  onQuickUndo?: (accept: RecentAIAccept) => void
  /** Recently undone AI operations (for redo) */
  recentUndos?: RecentAIUndo[]
  /** Callback to redo an undone AI operation */
  onQuickRedo?: (undo: RecentAIUndo) => void
  /** When set, the editor scrolls to and focuses this 1-based line number */
  revealLine?: number | null
}

// ─── Diff Utilities ──────────────────────────────────────────────────────

type DiffLine = { type: "unchanged" | "added" | "removed"; content: string }

/**
 * Compute a unified diff between two strings using LCS (Longest Common Subsequence).
 * Returns an array of lines with their diff type.
 */
function computeUnifiedDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n")
  const newLines = newText.split("\n")
  const n = oldLines.length
  const m = newLines.length

  // Build LCS DP table
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] =
        oldLines[i - 1] === newLines[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }

  // Backtrack to produce diff
  const result: DiffLine[] = []
  let i = n
  let j = m
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.unshift({ type: "unchanged", content: oldLines[i - 1] })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: "added", content: newLines[j - 1] })
      j--
    } else {
      result.unshift({ type: "removed", content: oldLines[i - 1] })
      i--
    }
  }

  return result
}

// ─── Diff Overlay Component ──────────────────────────────────────────────

function DiffOverlay({
  block,
  currentContent,
  onAction,
}: {
  block: AIBlock
  currentContent: string
  onAction: (action: "accept" | "reject") => void
}) {
  const diffLines = useMemo(() => {
    if (block.operation.type === "create") {
      return (block.operation.content ?? "").split("\n").map((line) => ({
        type: "added" as const,
        content: line,
      }))
    }
    if (block.operation.type === "delete") {
      return currentContent.split("\n").map((line) => ({
        type: "removed" as const,
        content: line,
      }))
    }
    return computeUnifiedDiff(currentContent, block.operation.content ?? "")
  }, [block, currentContent])

  const typeLabel =
    block.operation.type === "create"
      ? "New file"
      : block.operation.type === "delete"
        ? "Delete file"
        : "Update file"

  const addedCount = diffLines.filter((l) => l.type === "added").length
  const removedCount = diffLines.filter((l) => l.type === "removed").length

  // Line number counters for old/new
  let oldLineNo = 0
  let newLineNo = 0

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-[hsl(230,13%,7%)]/98 backdrop-blur-sm">
      {/* Banner */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-ai-muted-border bg-ai-muted/40 shrink-0">
        <Sparkles
          className="h-4 w-4 shrink-0"
          style={{ color: block.agentColor ?? "hsl(172, 66%, 50%)" }}
        />
        <span className="text-xs font-semibold text-ai">{typeLabel}</span>
        <span className="text-xs text-text-tertiary font-mono truncate">{block.operation.path}</span>
        <div className="flex-1" />
        {addedCount > 0 && (
          <span className="text-[10px] font-mono text-success">+{addedCount}</span>
        )}
        {removedCount > 0 && (
          <span className="text-[10px] font-mono text-error">-{removedCount}</span>
        )}
        <button
          onClick={() => onAction("accept")}
          className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium bg-success/15 text-success hover:bg-success/25 border border-success/20 transition-colors"
        >
          <Check className="h-3 w-3" />
          Accept
        </button>
        <button
          onClick={() => onAction("reject")}
          className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium bg-error/15 text-error hover:bg-error/25 border border-error/20 transition-colors"
        >
          <X className="h-3 w-3" />
          Reject
        </button>
      </div>

      {/* Diff content */}
      <ScrollArea className="flex-1">
        <div className="font-mono text-[13px] leading-[20px]">
          {diffLines.map((line, i) => {
            let leftNum = ""
            let rightNum = ""
            if (line.type === "unchanged") {
              oldLineNo++
              newLineNo++
              leftNum = String(oldLineNo)
              rightNum = String(newLineNo)
            } else if (line.type === "removed") {
              oldLineNo++
              leftNum = String(oldLineNo)
            } else {
              newLineNo++
              rightNum = String(newLineNo)
            }

            return (
              <div
                key={i}
                className={cn(
                  "flex",
                  line.type === "added" && "bg-success/8",
                  line.type === "removed" && "bg-error/8"
                )}
              >
                {/* Left line number (old) */}
                <span
                  className={cn(
                    "w-12 shrink-0 select-none text-right pr-1 text-[11px] leading-[20px]",
                    line.type === "removed"
                      ? "text-error/50"
                      : line.type === "added"
                        ? "text-transparent"
                        : "text-text-tertiary/40"
                  )}
                >
                  {leftNum}
                </span>
                {/* Right line number (new) */}
                <span
                  className={cn(
                    "w-12 shrink-0 select-none text-right pr-2 text-[11px] leading-[20px]",
                    line.type === "added"
                      ? "text-success/50"
                      : line.type === "removed"
                        ? "text-transparent"
                        : "text-text-tertiary/40"
                  )}
                >
                  {rightNum}
                </span>
                {/* Prefix */}
                <span
                  className={cn(
                    "w-5 shrink-0 select-none text-center",
                    line.type === "added" && "text-success font-semibold",
                    line.type === "removed" && "text-error font-semibold",
                    line.type === "unchanged" && "text-text-tertiary/30"
                  )}
                >
                  {line.type === "added" ? "+" : line.type === "removed" ? "−" : " "}
                </span>
                {/* Content */}
                <span
                  className={cn(
                    "flex-1 whitespace-pre pr-4",
                    line.type === "added" && "text-success/90",
                    line.type === "removed" && "text-error/70 line-through decoration-error/30",
                    line.type === "unchanged" && "text-text-secondary/70"
                  )}
                >
                  {line.content}
                </span>
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}

// ─── AI Quick-Undo/Redo Gutter Icons ─────────────────────────────────────

const QUICK_ACTION_DURATION_MS = 15000 // 15 seconds

function AIQuickActionsGutter({
  accepts,
  undos,
  onUndo,
  onRedo,
}: {
  accepts: RecentAIAccept[]
  undos: RecentAIUndo[]
  onUndo: (accept: RecentAIAccept) => void
  onRedo: (undo: RecentAIUndo) => void
}) {
  const [now, setNow] = useState(() => Date.now())

  // Update "now" to trigger expiration
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  // Filter to only show non-expired items
  const visibleAccepts = accepts.filter(
    (a) => now - a.acceptedAt < QUICK_ACTION_DURATION_MS
  )
  const visibleUndos = undos.filter(
    (u) => now - u.undoneAt < QUICK_ACTION_DURATION_MS
  )

  if (visibleAccepts.length === 0 && visibleUndos.length === 0) return null

  return (
    <div className="absolute top-0 left-0 z-30 pointer-events-none">
      <AnimatePresence>
        {/* Undo buttons for recent accepts */}
        {visibleAccepts.map((accept) => {
          const elapsed = now - accept.acceptedAt
          const remaining = QUICK_ACTION_DURATION_MS - elapsed
          const opacity = Math.max(0.3, remaining / QUICK_ACTION_DURATION_MS)

          return (
            <motion.div
              key={`undo-${accept.messageId}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-auto"
              style={{
                position: "absolute",
                top: ((accept.startLine ?? 1) - 1) * 20 + 12,
                left: 8,
              }}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onUndo(accept)}
                    className="flex items-center justify-center w-5 h-5 rounded bg-ai/20 hover:bg-ai/40 border border-ai/30 transition-all hover:scale-110"
                    style={{ opacity }}
                  >
                    <Undo2 className="h-3 w-3 text-ai" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <div className="space-y-1">
                    <p className="font-medium text-text-primary">Undo AI Action</p>
                    <p className="text-text-secondary text-xs">
                      Revert this AI-generated change
                    </p>
                    <p className="text-text-tertiary text-[10px]">
                      {Math.ceil(remaining / 1000)}s remaining
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </motion.div>
          )
        })}

        {/* Redo buttons for recent undos */}
        {visibleUndos.map((undo) => {
          const elapsed = now - undo.undoneAt
          const remaining = QUICK_ACTION_DURATION_MS - elapsed
          const opacity = Math.max(0.3, remaining / QUICK_ACTION_DURATION_MS)

          return (
            <motion.div
              key={`redo-${undo.messageId}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-auto"
              style={{
                position: "absolute",
                top: ((undo.startLine ?? 1) - 1) * 20 + 12,
                left: 36, // Offset from undo button
              }}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onRedo(undo)}
                    className="flex items-center justify-center w-5 h-5 rounded bg-brand/20 hover:bg-brand/40 border border-brand/30 transition-all hover:scale-110"
                    style={{ opacity }}
                  >
                    <Redo2 className="h-3 w-3 text-brand" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <div className="space-y-1">
                    <p className="font-medium text-text-primary">Redo AI Action</p>
                    <p className="text-text-secondary text-xs">
                      Restore the AI-generated change
                    </p>
                    <p className="text-text-tertiary text-[10px]">
                      {Math.ceil(remaining / 1000)}s remaining
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

// ─── Code Editor ─────────────────────────────────────────────────────────

// ─── Remote Cursor Overlay ──────────────────────────────────────────────

interface RemoteCursor {
  clientId: number
  name: string
  color: string
  top: number
  left: number
  height: number
}

export function CodeEditor({
  file,
  readOnly = false,
  yText,
  awareness,
  onContentChange,
  aiBlocks,
  onAIBlockAction,
  recentAccepts = [],
  onQuickUndo,
  recentUndos = [],
  onQuickRedo,
  revealLine,
}: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [MonacoEditor, setMonacoEditor] = useState<typeof import("@monaco-editor/react").default | null>(null)
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const bindingRef = useRef<any>(null)
  const undoManagerRef = useRef<any>(null)
  const editorRef = useRef<any>(null)
  const yjsModuleRef = useRef<any>(null)
  /* eslint-enable @typescript-eslint/no-explicit-any */
  const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([])
  const [editorReady, setEditorReady] = useState(false)

  useEffect(() => {
    import("@monaco-editor/react").then((mod) => {
      setMonacoEditor(() => mod.default)
    })
  }, [])

  // Cleanup binding on unmount
  useEffect(() => {
    return () => {
      bindingRef.current?.destroy()
      bindingRef.current = null
      undoManagerRef.current?.destroy()
      undoManagerRef.current = null
    }
  }, [])

  // ── Reveal a specific line when requested (e.g. from Search panel) ──
  useEffect(() => {
    if (!editorReady || !revealLine) return
    const editor = editorRef.current
    if (!editor) return
    // Center the target line and place the cursor at column 1
    editor.revealLineInCenter(revealLine)
    editor.setPosition({ lineNumber: revealLine, column: 1 })
    editor.focus()
  }, [revealLine, editorReady])

  // ── React-based cursor overlay ──
  // Reads awareness selections, converts to pixel positions via Monaco API,
  // and renders as positioned divs. Fully independent of Monaco's decoration
  // rendering pipeline — always visible regardless of editor focus state.
  useEffect(() => {
    if (!awareness || !yText || !editorReady) return
    const aw = awareness as any
    const yt = yText as any

    let Y: any = yjsModuleRef.current
    let disposed = false
    const disposables: Array<{ dispose(): void }> = []
    let rafId: number | undefined

    const computeCursors = () => {
      const editor = editorRef.current
      if (!editor || !Y || disposed) return
      const model = editor.getModel()
      const doc = yt.doc
      if (!model || !doc) return

      const localClientId = doc.clientID
      const states = aw.getStates() as Map<number, Record<string, unknown>>
      const cursors: RemoteCursor[] = []

      states.forEach((state: Record<string, unknown>, clientId: number) => {
        if (clientId === localClientId) return

        const name = (state.name as string) || "User"
        const color = (state.color as string) || "hsl(172, 66%, 50%)"

        // Try y-monaco selection first (user has clicked in the editor)
        const sel = state.selection as { anchor?: unknown; head?: unknown } | undefined
        if (sel?.head) {
          const headAbs = Y.createAbsolutePositionFromRelativePosition(sel.head, doc)
          if (headAbs && headAbs.type === yt) {
            const pos = model.getPositionAt(headAbs.index)
            const pixelPos = editor.getScrolledVisiblePosition(pos)
            if (pixelPos) {
              cursors.push({ clientId, name, color, top: pixelPos.top, left: pixelPos.left, height: pixelPos.height })
            }
          }
          // User has a selection — don't fall through to line-1 fallback.
          // If we can't resolve yet (doc still syncing), skip for now;
          // onDidChangeModelContent will re-trigger once content arrives.
          return
        }

        // No selection at all — user is viewing this file but hasn't clicked
        const userState = state.user as { activeFile?: string } | undefined
        if (userState?.activeFile === file.path) {
          const pixelPos = editor.getScrolledVisiblePosition({ lineNumber: 1, column: 1 })
          if (pixelPos) {
            cursors.push({ clientId, name, color, top: pixelPos.top, left: pixelPos.left, height: pixelPos.height })
          }
        }
      })

      setRemoteCursors(cursors)
    }

    // Load Yjs module then wire up listeners
    const init = async () => {
      if (!Y) {
        Y = await import("yjs")
        yjsModuleRef.current = Y
      }
      if (disposed) return

      aw.on("change", computeCursors)

      // Clear stale selection from a previously viewed file
      aw.setLocalStateField("selection", null)

      // Recompute on scroll, layout, or content change (pixel positions shift,
      // and content changes mean the doc synced so relative positions can resolve)
      const editor = editorRef.current
      if (editor) {
        disposables.push(editor.onDidScrollChange(computeCursors))
        disposables.push(editor.onDidLayoutChange(computeCursors))
        disposables.push(editor.onDidChangeModelContent(computeCursors))

        // Broadcast local cursor position via awareness (replaces y-monaco's
        // built-in broadcasting which we disabled to prevent duplicate cursors)
        disposables.push(editor.onDidChangeCursorSelection(() => {
          if (disposed) return
          const model = editor.getModel()
          if (!model) return
          const sel = editor.getSelection()
          if (sel) {
            const anchor = Y.createRelativePositionFromTypeIndex(yt, model.getOffsetAt(sel.getStartPosition()))
            const head = Y.createRelativePositionFromTypeIndex(yt, model.getOffsetAt(sel.getEndPosition()))
            aw.setLocalStateField("selection", { anchor, head })
          }
        }))
      }

      computeCursors()

      // Second pass after Monaco layout settles
      rafId = requestAnimationFrame(() => {
        if (!disposed) computeCursors()
      })
    }
    init()

    return () => {
      disposed = true
      aw.off("change", computeCursors)
      disposables.forEach((d) => d.dispose())
      if (rafId !== undefined) cancelAnimationFrame(rafId)
    }
  }, [awareness, yText, editorReady])

  // Find the first pending AI block for this file
  const pendingBlock = aiBlocks?.find((b) => b.status === "pending")

  const handleEditorMount = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (editor: any, monaco: any) => {
      editorRef.current = editor
      setEditorReady(true)

      // If we have a Y.Text, create a y-monaco binding for CRDT text sync only.
      // We do NOT pass awareness here — y-monaco would render its own cursor
      // decorations which duplicate our custom React overlay. Cursor broadcasting
      // is handled manually in the cursor useEffect below.
      //
      // We also create a Y.UndoManager and override Monaco's Ctrl+Z / Ctrl+Shift+Z
      // so that undo/redo only reverts the current user's local changes, preventing
      // CRDT corruption from replaying raw model operations.
      if (yText) {
        Promise.all([
          import("y-monaco"),
          import("yjs"),
        ]).then(([{ MonacoBinding }, Y]) => {
          if (!editor.getModel()) return

          bindingRef.current = new MonacoBinding(
            yText as any,
            editor.getModel()!,
            new Set([editor])
          )

          // Create an UndoManager scoped to this Y.Text so undo only
          // reverts the current user's changes, not remote CRDT ops.
          const undoManager = new Y.UndoManager(yText as any, {
            captureTimeout: 500,
          })
          undoManagerRef.current = undoManager

          // Override Monaco's built-in undo/redo to use Y.UndoManager.
          // This prevents CRDT state corruption when pressing Ctrl+Z in a
          // collaborative session — only LOCAL changes are undone.
          const { KeyMod, KeyCode } = monaco

          editor.addAction({
            id: "itecify-undo",
            label: "Undo (CRDT-safe)",
            keybindings: [KeyMod.CtrlCmd | KeyCode.KeyZ],
            run: () => {
              if (undoManager.undoStack.length > 0) {
                undoManager.undo()
              }
            },
          })

          editor.addAction({
            id: "itecify-redo",
            label: "Redo (CRDT-safe)",
            keybindings: [
              KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyZ,
              KeyMod.CtrlCmd | KeyCode.KeyY,
            ],
            run: () => {
              if (undoManager.redoStack.length > 0) {
                undoManager.redo()
              }
            },
          })
        }).catch(() => {
          console.warn("[iTECify] y-monaco binding failed, using fallback")
        })
      }
    },
    [yText]
  )

  if (!MonacoEditor) {
    // Skeleton loading state per design guidelines
    return (
      <div className="flex h-full flex-col bg-background p-4">
        <div className="space-y-2">
          {Array.from({ length: 15 }).map((_, i) => (
            <div
              key={i}
              className="skeleton h-4 rounded"
              style={{ width: `${30 + Math.random() * 60}%` }}
            />
          ))}
        </div>
      </div>
    )
  }

  // When using y-monaco binding, don't use value/onChange (the binding handles sync).
  // Only use controlled mode as a fallback when no Y.Text is available.
  const useBinding = !!yText && !!awareness

  return (
    <div ref={containerRef} className="h-full w-full relative">
      <MonacoEditor
        height="100%"
        language={file.language === "typescript" ? "typescript" : file.language}
        {...(useBinding ? {} : { value: file.content })}
        theme="itecify-dark"
        options={{
          readOnly,
          fontSize: 13,
          fontFamily: "var(--font-jetbrains-mono), 'JetBrains Mono', monospace",
          fontLigatures: true,
          lineHeight: 20,
          // Reserve a thin header lane for collaborator cursor badges so
          // top-line flags never sit under chrome or over the code itself.
          padding: { top: 28, bottom: 12 },
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          cursorSmoothCaretAnimation: "on",
          cursorBlinking: "smooth",
          renderLineHighlight: "line",
          renderLineHighlightOnlyWhenFocus: true,
          bracketPairColorization: { enabled: true },
          guides: {
            bracketPairs: true,
            indentation: true,
          },
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          scrollbar: {
            verticalScrollbarSize: 6,
            horizontalScrollbarSize: 6,
            useShadows: false,
          },
          wordWrap: "off",
          automaticLayout: true,
        }}
        beforeMount={(monaco) => {
          // Define the custom iTECify dark theme
          monaco.editor.defineTheme("itecify-dark", {
            base: "vs-dark",
            inherit: true,
            rules: [
              { token: "comment", foreground: "546178", fontStyle: "italic" },
              { token: "keyword", foreground: "8b8bf9" },
              { token: "string", foreground: "3dd68c" },
              { token: "number", foreground: "f0a050" },
              { token: "type", foreground: "5bc0de" },
              { token: "function", foreground: "dcdcaa" },
              { token: "variable", foreground: "d4d4e0" },
            ],
            colors: {
              "editor.background": "#0f1014",
              "editor.foreground": "#d4d4e0",
              "editor.lineHighlightBackground": "#1a1a22",
              "editor.selectionBackground": "#3c3c8c40",
              "editorLineNumber.foreground": "#3a3a50",
              "editorLineNumber.activeForeground": "#7a7a9e",
              "editorCursor.foreground": "#6366f1",
              "editor.inactiveSelectionBackground": "#2a2a3c30",
              "editorIndentGuide.background": "#1e1e2e",
              "editorIndentGuide.activeBackground": "#3a3a50",
              "editorBracketMatch.background": "#3c3c8c30",
              "editorBracketMatch.border": "#6366f1",
            },
          })
        }}
        onChange={(value) => {
          // Only fire callback when NOT using y-monaco binding (fallback mode)
          if (!useBinding && value !== undefined && onContentChange) {
            onContentChange(value)
          }
        }}
        onMount={handleEditorMount}
      />

      {/* AI Quick-Undo/Redo Gutter Icons — show for recently accepted/undone AI changes */}
      {(onQuickUndo || onQuickRedo) && (recentAccepts.length > 0 || recentUndos.length > 0) && (
        <AIQuickActionsGutter
          accepts={recentAccepts.filter((a) => a.filePath === file.path)}
          undos={recentUndos.filter((u) => u.filePath === file.path)}
          onUndo={onQuickUndo ?? (() => {})}
          onRedo={onQuickRedo ?? (() => {})}
        />
      )}

      {/* AI Diff Overlay — renders on top of editor when there are pending changes */}
      {pendingBlock && (
        <DiffOverlay
          block={pendingBlock}
          currentContent={file.content}
          onAction={(action) =>
            onAIBlockAction?.(pendingBlock.chatId, pendingBlock.messageId, pendingBlock.operationIndex, action)
          }
        />
      )}

      {/* Remote cursor overlays — always visible regardless of editor focus */}
      {remoteCursors.map((cursor) => (
        (() => {
          const labelAbsoluteTop = Math.max(4, cursor.top - 16)
          const isDockedToTopRail = labelAbsoluteTop <= 6

          return (
            <div
              key={cursor.clientId}
              className="pointer-events-none absolute z-40"
              style={{
                top: cursor.top,
                left: cursor.left,
                transition: "top 120ms ease-out, left 120ms ease-out",
              }}
            >
              {/* Cursor line */}
              <div
                style={{
                  width: 2,
                  height: cursor.height,
                  backgroundColor: cursor.color,
                }}
              />
              {/* Name label */}
              <div
                className="absolute whitespace-nowrap rounded px-1 py-0.5 text-[10px] font-medium leading-none text-white shadow-sm"
                style={{
                  backgroundColor: cursor.color,
                  top: labelAbsoluteTop - cursor.top,
                  left: isDockedToTopRail ? 8 : 0,
                }}
              >
                {cursor.name}
              </div>
            </div>
          )
        })()
      ))}
    </div>
  )
}
