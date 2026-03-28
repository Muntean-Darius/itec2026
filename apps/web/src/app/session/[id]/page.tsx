"use client"

import dynamic from "next/dynamic"
import { useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { Play, Square, ChevronDown, Bot, Terminal as TerminalIcon, Sparkles } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { LANGUAGES, LANG_META, DEFAULT_SNIPPETS } from "@/data/mock"
import type { CodeEditorProps, MonacoEditor } from "@/components/editor/CodeEditor"
import { AIBlock } from "@/components/editor/AIBlock"
import type { Monaco } from "@monaco-editor/react"

// import { useSessionSocket } from "@/hooks/useSessionSocket"
// import { useRunner } from "@/hooks/useRunner"
// import { useAI } from "@/hooks/useAI"
// import { useCollab } from "@/hooks/useCollab"

const CodeEditor = dynamic<CodeEditorProps>(
  () => import("@/components/editor/CodeEditor").then((m) => ({ default: m.CodeEditor })),
  { ssr: false }
)
const SharedTerminal = dynamic(
  () =>
    import("@/components/terminal/SharedTerminal").then((m) => ({
      default: m.SharedTerminal,
    })),
  { ssr: false }
)

type RunStatus = "idle" | "running" | "success" | "error"

export default function SessionPage() {
  const { id } = useParams<{ id: string }>()

  const [language, setLanguage] = useState("Python")
  const [langOpen, setLangOpen] = useState(false)
  const [terminalOpen, setTerminalOpen] = useState(true)
  const [runStatus, setRunStatus] = useState<RunStatus>("idle")

  // AI state
  const [aiPromptOpen, setAiPromptOpen] = useState(false)
  const [aiPrompt, setAiPrompt] = useState("")
  const [pendingProposal, setPendingProposal] = useState<{
    summary: string
    proposal: string
  } | null>(null)

  // Mock terminal output
  const [terminalOutput, setTerminalOutput] = useState<string[]>([])

  const editorRef = useRef<MonacoEditor | null>(null)

  function handleEditorMount(editor: MonacoEditor, _monaco: Monaco) {
    editorRef.current = editor
    // TODO: bindEditor(editor) for Yjs collaboration
  }

  function handleRun() {
    if (runStatus === "running") {
      setRunStatus("idle")
      setTerminalOutput((prev) => [...prev, "\x1b[33m[cancelled]\x1b[0m Process terminated."])
      return
    }

    const code = editorRef.current?.getValue() ?? ""
    if (!code.trim()) return

    setRunStatus("running")
    setTerminalOutput((prev) => [
      ...prev,
      `\x1b[34m$\x1b[0m Running ${language.toLowerCase()} code...`,
    ])

    // Mock: simulate execution delay
    setTimeout(() => {
      setTerminalOutput((prev) => [
        ...prev,
        "[0, 1, 1, 2, 3, 5, 8, 13, 21, 34]",
        "",
        `\x1b[32m✓\x1b[0m Process exited with code 0 (${Math.floor(Math.random() * 200 + 50)}ms)`,
      ])
      setRunStatus("success")
      // Reset status after a moment
      setTimeout(() => setRunStatus("idle"), 2000)
    }, 800)
  }

  function handleAiGenerate() {
    if (!aiPrompt.trim()) return

    // Mock AI proposal
    setPendingProposal({
      summary: `AI suggestion based on: "${aiPrompt}"`,
      proposal: `# Improved version with better readability

def fibonacci(n: int) -> list[int]:
    """Generate the first n Fibonacci numbers using a generator pattern."""
    if n <= 0:
        return []
    if n == 1:
        return [0]

    sequence = [0, 1]
    while len(sequence) < n:
        next_val = sequence[-1] + sequence[-2]
        sequence.append(next_val)

    return sequence

if __name__ == "__main__":
    result = fibonacci(10)
    print(f"Fibonacci(10) = {result}")
`,
    })
    setAiPromptOpen(false)
    setAiPrompt("")
  }

  function acceptProposal() {
    if (!pendingProposal || !editorRef.current) return
    editorRef.current.setValue(pendingProposal.proposal)
    setPendingProposal(null)
  }

  function rejectProposal() {
    setPendingProposal(null)
  }

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Cmd+K → AI prompt
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setAiPromptOpen((prev) => !prev)
      }
      // Cmd+Enter → Run
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault()
        handleRun()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  })

  const langMeta = LANG_META[language]
  const monacoLang = langMeta?.monacoId ?? "python"
  const defaultCode = DEFAULT_SNIPPETS[monacoLang] ?? ""

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* ── Editor Toolbar ── */}
      <div className="flex items-center gap-2 px-3 h-11 border-b border-border bg-surface shrink-0">
        {/* Language picker */}
        <div className="relative">
          <button
            onClick={() => setLangOpen((o) => !o)}
            className="
              flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium
              bg-elevated text-text-primary border border-border-strong
              hover:border-brand-muted-border transition-all duration-150
            "
          >
            <span
              className="size-2 rounded-full shrink-0"
              style={{ background: langMeta?.color }}
            />
            {language}
            <ChevronDown className="size-3 text-text-tertiary" />
          </button>

          <AnimatePresence>
            {langOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setLangOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute left-0 top-full mt-1 z-20 min-w-[160px] rounded-xl overflow-hidden py-1 border border-border-strong"
                  style={{
                    background: "var(--bg-elevated)",
                    boxShadow: "0 8px 32px hsla(230, 13%, 4%, 0.5)",
                  }}
                >
                  {LANGUAGES.map((lang) => {
                    const meta = LANG_META[lang]
                    const active = language === lang
                    return (
                      <button
                        key={lang}
                        onClick={() => {
                          setLanguage(lang)
                          setLangOpen(false)
                        }}
                        className={`
                          flex items-center gap-2.5 w-full px-3 py-2 text-xs text-left transition-all duration-100
                          ${active ? "bg-brand-muted text-brand" : "text-text-primary hover:bg-hover"}
                        `}
                      >
                        <span
                          className="size-2 rounded-full shrink-0"
                          style={{ background: meta?.color }}
                        />
                        {lang}
                      </button>
                    )
                  })}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Session ID badge */}
        <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-elevated text-text-tertiary border border-border">
          {id}
        </span>

        <div className="flex-1" />

        {/* AI button */}
        <button
          onClick={() => setAiPromptOpen((prev) => !prev)}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
            border transition-all duration-150
            ${
              aiPromptOpen
                ? "bg-ai-muted text-ai border-[var(--ai-muted-border)]"
                : "bg-elevated text-text-secondary border-border-strong hover:text-ai hover:border-[var(--ai-muted-border)]"
            }
          `}
          title="AI Assistant (⌘K)"
        >
          <Sparkles className="size-3.5" />
          AI
        </button>

        {/* Terminal toggle */}
        <button
          onClick={() => setTerminalOpen((o) => !o)}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
            border transition-all duration-150
            ${
              terminalOpen
                ? "bg-brand-muted text-brand border-[var(--brand-muted-border)]"
                : "bg-elevated text-text-secondary border-border-strong hover:text-text-primary"
            }
          `}
        >
          <TerminalIcon className="size-3.5" />
          Terminal
        </button>

        {/* Run button */}
        <button
          onClick={handleRun}
          className={`
            flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold
            transition-all duration-200 active:scale-[0.97]
            ${
              runStatus === "running"
                ? "bg-error-muted text-error border border-[var(--error-muted-border)]"
                : runStatus === "success"
                  ? "bg-success-muted text-success border border-[hsla(150,55%,48%,0.25)]"
                  : "bg-success text-[hsl(230,40%,6%)] hover:shadow-[0_0_16px_hsla(150,55%,48%,0.25)]"
            }
          `}
          title="Run code (⌘↵)"
        >
          {runStatus === "running" ? (
            <>
              <Square className="size-3.5" />
              Stop
            </>
          ) : (
            <>
              <Play className="size-3.5" />
              Run
            </>
          )}
        </button>
      </div>

      {/* ── AI Prompt Bar (inline, not modal) ── */}
      <AnimatePresence>
        {aiPromptOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden border-b border-border bg-surface"
          >
            <div className="flex items-center gap-2 px-3 py-2">
              <Sparkles className="size-4 text-ai shrink-0" />
              <input
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAiGenerate()
                  if (e.key === "Escape") setAiPromptOpen(false)
                }}
                placeholder="Ask AI to generate, refactor, or improve code..."
                autoFocus
                className="
                  flex-1 h-8 px-3 rounded-lg text-sm
                  bg-elevated text-text-primary placeholder:text-text-tertiary
                  border border-border-strong
                  outline-none transition-all duration-200
                  focus:border-ai focus:ring-1 focus:ring-[var(--ai-muted-border)]
                "
              />
              <button
                onClick={handleAiGenerate}
                disabled={!aiPrompt.trim()}
                className="
                  px-3 py-1.5 rounded-lg text-xs font-semibold
                  bg-ai text-ai-foreground
                  hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed
                  transition-all duration-150
                "
              >
                Generate
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── AI Proposal Block ── */}
      <AnimatePresence>
        {pendingProposal && (
          <AIBlock
            summary={pendingProposal.summary}
            proposal={pendingProposal.proposal}
            onAccept={acceptProposal}
            onReject={rejectProposal}
          />
        )}
      </AnimatePresence>

      {/* ── Editor + Terminal ── */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <CodeEditor
            language={language}
            defaultValue={defaultCode}
            onMount={handleEditorMount}
          />
        </div>

        <AnimatePresence>
          {terminalOpen && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 220 }}
              exit={{ height: 0 }}
              transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="overflow-hidden"
            >
              <SharedTerminal
                output={terminalOutput}
                defaultOpen
                onCommand={(cmd) => {
                  setTerminalOutput((prev) => [...prev, `\x1b[34m$\x1b[0m ${cmd}`])
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
