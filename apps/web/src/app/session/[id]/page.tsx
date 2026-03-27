"use client"

import dynamic from "next/dynamic"
import { useParams } from "next/navigation"
import { useState, useRef } from "react"
import { Play, ChevronDown, Terminal } from "lucide-react"
import { LANG_MAP, type CodeEditorProps, type MonacoEditor } from "@/components/editor/CodeEditor"
import type { Monaco } from "@monaco-editor/react"

const CodeEditor = dynamic<CodeEditorProps>(
  () => import("@/components/editor/CodeEditor").then((m) => ({ default: m.CodeEditor })),
  { ssr: false }
)

const LANGUAGES = Object.keys(LANG_MAP)

const LANG_COLORS: Record<string, string> = {
  Python:     "#3B82F6",
  JavaScript: "#C9AA2A",
  TypeScript: "#4F86F7",
  Go:         "#5EBC70",
  Rust:       "#E0834A",
  "C++":      "#9B8AFA",
  Java:       "#C23B3B",
}

const TERMINAL_HEIGHT = 220

export default function SessionPage() {
  const { id } = useParams<{ id: string }>()
  const [language, setLanguage] = useState("Python")
  const [langOpen, setLangOpen] = useState(false)
  const [terminalOpen, setTerminalOpen] = useState(true)
  const editorRef = useRef<MonacoEditor | null>(null)

  function handleEditorMount(editor: MonacoEditor, _monaco: Monaco) {
    editorRef.current = editor
  }

  function handleRun() {
    // Phase 2: useRunner hook will wire this up to the server
    const code = editorRef.current?.getValue() ?? ""
    console.log("[run]", { sessionId: id, language, code })
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* ── Editor toolbar ── */}
      <div
        className="flex items-center gap-2 px-3 shrink-0 border-b border-border"
        style={{ height: 44, background: "var(--panel)" }}
      >
        {/* Language picker */}
        <div className="relative">
          <button
            onClick={() => setLangOpen((o) => !o)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all"
            style={{
              background: "var(--elevated)",
              border: "1px solid var(--border-strong)",
              color: "var(--foreground)",
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(79,134,247,0.35)")}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border-strong)")}
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
                    onClick={() => { setLanguage(lang); setLangOpen(false) }}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left transition-colors"
                    style={{
                      color: language === lang ? "var(--accent)" : "var(--foreground)",
                      background: language === lang ? "rgba(79,134,247,0.1)" : "transparent",
                    }}
                    onMouseEnter={e => {
                      if (language !== lang) e.currentTarget.style.background = "var(--hover)"
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = language === lang ? "rgba(79,134,247,0.1)" : "transparent"
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

        {/* Session ID chip */}
        <span
          className="font-mono text-[10px] px-2.5 py-0.5 rounded-full"
          style={{ background: "var(--elevated)", color: "var(--text-dim)", border: "1px solid var(--border)" }}
        >
          {id}
        </span>

        <div className="flex-1" />

        {/* Terminal toggle */}
        <button
          onClick={() => setTerminalOpen((o) => !o)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all"
          style={{
            background: terminalOpen ? "rgba(79,134,247,0.1)" : "var(--elevated)",
            border: terminalOpen ? "1px solid rgba(79,134,247,0.3)" : "1px solid var(--border-strong)",
            color: terminalOpen ? "var(--accent)" : "var(--text-sec)",
          }}
        >
          <Terminal className="size-3" />
          Terminal
        </button>

        {/* Run button — crimson (secondary accent) */}
        <button
          onClick={handleRun}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold font-ui transition-all"
          style={{
            background: "linear-gradient(135deg, rgba(194,59,59,0.22), rgba(194,59,59,0.1))",
            border: "1px solid rgba(194,59,59,0.4)",
            color: "var(--crimson)",
          }}
          onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 0 14px var(--crimson-glow)")}
          onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
        >
          <Play className="size-3" />
          Run
        </button>
      </div>

      {/* ── Editor + Terminal split ── */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <CodeEditor language={language} onMount={handleEditorMount} />
        </div>

        {terminalOpen && (
          <div
            className="shrink-0 flex flex-col border-t border-border overflow-hidden"
            style={{ height: TERMINAL_HEIGHT, background: "var(--terminal-bg)" }}
          >
            <div
              className="flex items-center gap-2 px-3 shrink-0 border-b"
              style={{ height: 32, borderColor: "rgba(79,134,247,0.08)" }}
            >
              <Terminal className="size-3 text-text-dim" />
              <span className="text-[10px] font-mono text-text-dim uppercase tracking-wider">Output</span>
              <div className="flex-1" />
              <span className="text-[10px] text-text-dim font-mono">{language}</span>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <span className="text-[11px] font-mono text-text-dim">
                Press <span style={{ color: "var(--crimson)" }}>Run</span> to execute your code
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
