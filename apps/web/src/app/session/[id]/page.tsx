"use client"

import dynamic from "next/dynamic"
import { useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { Play, ChevronDown, Bot } from "lucide-react"
import { LANG_MAP, type CodeEditorProps, type MonacoEditor } from "@/components/editor/CodeEditor"
import { AIBlock } from "@/components/editor/AIBlock"
import { useSessionSocket } from "@/hooks/useSessionSocket"
import { useRunner } from "@/hooks/useRunner"
import { useAI } from "@/hooks/useAI"
import { useCollab } from "@/hooks/useCollab"
import type { Monaco } from "@monaco-editor/react"

const CodeEditor = dynamic<CodeEditorProps>(
  () => import("@/components/editor/CodeEditor").then((m) => ({ default: m.CodeEditor })),
  { ssr: false }
)
const SharedTerminal = dynamic(
  () => import("@/components/terminal/SharedTerminal").then((m) => ({ default: m.SharedTerminal })),
  { ssr: false }
)

const LANGUAGES = Object.keys(LANG_MAP)

const LANG_COLORS: Record<string, string> = {
  Python: "#3B82F6",
  JavaScript: "#C9AA2A",
  TypeScript: "#4F86F7",
  Go: "#5EBC70",
  Rust: "#E0834A",
  "C++": "#9B8AFA",
  Java: "#C23B3B",
}

export default function SessionPage() {
  const { id } = useParams<{ id: string }>()
  const projectId = id

  const [language, setLanguage] = useState("Python")
  const [langOpen, setLangOpen] = useState(false)
  const [terminalOpen, setTerminalOpen] = useState(true)
  const [aiPrompt, setAiPrompt] = useState("Improve this code for readability and best practices.")
  const [pendingAiProposal, setPendingAiProposal] = useState<{ summary?: string; proposal: string } | null>(null)

  const editorRef = useRef<MonacoEditor | null>(null)

  const { socket, connected: socketConnected, connectError } = useSessionSocket(projectId)
  const { terminalOutput, runnerStatusLabel, runCode, sendTerminalInput } = useRunner(socket)
  const { aiState, aiStatusLabel, lastProposal, lastProposalAction, requestGenerate, sendProposalAction } = useAI(socket)
  const { bindEditor, status: collabStatus } = useCollab(projectId)

  const connectionLabel = useMemo(() => {
    if (connectError) return `socket error: ${connectError}`
    return `socket:${socketConnected ? "connected" : "disconnected"} | yjs:${collabStatus}`
  }, [socketConnected, collabStatus, connectError])

  function handleEditorMount(editor: MonacoEditor, _monaco: Monaco) {
    editorRef.current = editor
    bindEditor(editor)
  }

  function handleRun() {
    const code = editorRef.current?.getValue() ?? ""
    runCode(language.toLowerCase(), code)
  }

  function handleAiGenerate() {
    const code = editorRef.current?.getValue() ?? ""
    requestGenerate({
      language: language.toLowerCase(),
      prompt: aiPrompt,
      context: code,
      filePath: `session/${projectId}`,
    })
  }

  useEffect(() => {
    if (!lastProposal?.proposal) return
    setPendingAiProposal({
      summary: lastProposal.summary,
      proposal: stripCodeFences(lastProposal.proposal),
    })
  }, [lastProposal])

  function acceptAiProposal() {
    if (!pendingAiProposal || !editorRef.current || !lastProposal) return
    editorRef.current.setValue(pendingAiProposal.proposal)
    sendProposalAction({
      requestId: lastProposal.requestId,
      action: "accept",
      appliedCode: pendingAiProposal.proposal,
    })
    setPendingAiProposal(null)
  }

  function rejectAiProposal() {
    if (lastProposal) {
      sendProposalAction({
        requestId: lastProposal.requestId,
        action: "reject",
      })
    }
    setPendingAiProposal(null)
  }

  useEffect(() => {
    if (!lastProposalAction) return

    if (lastProposalAction.action === "accept" && lastProposalAction.appliedCode && editorRef.current) {
      editorRef.current.setValue(lastProposalAction.appliedCode)
    }

    if (lastProposalAction.action === "accept" || lastProposalAction.action === "reject") {
      setPendingAiProposal(null)
    }
  }, [lastProposalAction])

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div
        className="flex items-center gap-2 px-3 shrink-0 border-b border-border"
        style={{ height: 44, background: "var(--panel)" }}
      >
        <div className="relative">
          <button
            onClick={() => setLangOpen((o) => !o)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all"
            style={{
              background: "var(--elevated)",
              border: "1px solid var(--border-strong)",
              color: "var(--foreground)",
            }}
          >
            <span className="size-1.5 rounded-full shrink-0" style={{ background: LANG_COLORS[language] ?? "#7A9BC4" }} />
            {language}
            <ChevronDown className="size-3 text-text-dim ml-0.5" />
          </button>

          {langOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setLangOpen(false)} />
              <div
                className="absolute left-0 top-full mt-1 z-20 min-w-[140px] rounded-xl overflow-hidden py-1"
                style={{
                  background: "var(--elevated)",
                  border: "1px solid var(--border-strong)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                }}
              >
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang}
                    onClick={() => {
                      setLanguage(lang)
                      setLangOpen(false)
                    }}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left transition-colors"
                    style={{
                      color: language === lang ? "var(--accent)" : "var(--foreground)",
                      background: language === lang ? "rgba(79,134,247,0.1)" : "transparent",
                    }}
                  >
                    <span className="size-1.5 rounded-full shrink-0" style={{ background: LANG_COLORS[lang] ?? "#7A9BC4" }} />
                    {lang}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <span
          className="font-mono text-[10px] px-2.5 py-0.5 rounded-full"
          style={{ background: "var(--elevated)", color: "var(--text-dim)", border: "1px solid var(--border)" }}
        >
          {projectId}
        </span>

        <span className="font-mono text-[10px] text-text-dim">{connectionLabel}</span>

        <div className="flex-1" />

        <button
          onClick={handleAiGenerate}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
          style={{
            background: "linear-gradient(135deg, rgba(79,134,247,0.22), rgba(79,134,247,0.1))",
            border: "1px solid rgba(79,134,247,0.4)",
            color: "var(--accent)",
          }}
        >
          <Bot className="size-3" />
          AI
        </button>

        <button
          onClick={() => setTerminalOpen((o) => !o)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all"
          style={{
            background: terminalOpen ? "rgba(79,134,247,0.1)" : "var(--elevated)",
            border: terminalOpen ? "1px solid rgba(79,134,247,0.3)" : "1px solid var(--border-strong)",
            color: terminalOpen ? "var(--accent)" : "var(--text-sec)",
          }}
        >
          Terminal
        </button>

        <button
          onClick={handleRun}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold font-ui transition-all"
          style={{
            background: "linear-gradient(135deg, rgba(194,59,59,0.22), rgba(194,59,59,0.1))",
            border: "1px solid rgba(194,59,59,0.4)",
            color: "var(--red)",
          }}
        >
          <Play className="size-3" />
          Run
        </button>
      </div>

      <div className="px-3 py-1 border-b border-border text-[11px] text-text-dim font-mono">
        runner:{runnerStatusLabel} | ai:{aiStatusLabel} {aiState?.message ? `| ${aiState.message}` : ""}
      </div>

      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <input
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAiGenerate()
          }}
          placeholder="Ask AI what to generate or improve..."
          className="flex-1 h-8 px-3 rounded-full text-xs bg-elevated border border-border-strong text-foreground outline-none"
        />
        <button
          onClick={handleAiGenerate}
          disabled={!aiPrompt.trim()}
          className="px-3 py-1.5 rounded-full text-xs font-semibold disabled:opacity-50"
          style={{
            background: "linear-gradient(135deg, rgba(79,134,247,0.22), rgba(79,134,247,0.1))",
            border: "1px solid rgba(79,134,247,0.4)",
            color: "var(--accent)",
          }}
        >
          Send AI
        </button>
      </div>

      {pendingAiProposal && (
        <AIBlock
          summary={pendingAiProposal.summary}
          proposal={pendingAiProposal.proposal}
          onAccept={acceptAiProposal}
          onReject={rejectAiProposal}
        />
      )}

      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <CodeEditor language={language} onMount={handleEditorMount} />
        </div>

        {terminalOpen && (
          <SharedTerminal
            output={terminalOutput}
            defaultOpen
            onCommand={sendTerminalInput}
          />
        )}
      </div>
    </div>
  )
}

function stripCodeFences(value: string): string {
  const trimmed = value.trim()
  if (!trimmed.startsWith("```")) return trimmed

  const lines = trimmed.split("\n")
  const start = lines[0].startsWith("```") ? 1 : 0
  const end = lines[lines.length - 1].startsWith("```") ? lines.length - 1 : lines.length
  return lines.slice(start, end).join("\n").trim()
}
