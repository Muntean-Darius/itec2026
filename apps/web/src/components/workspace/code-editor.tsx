"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import type { FileNode } from "@/data/types"

interface CodeEditorProps {
  file: FileNode
  readOnly?: boolean
}

export function CodeEditor({ file, readOnly = false }: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [MonacoEditor, setMonacoEditor] = useState<typeof import("@monaco-editor/react").default | null>(null)

  useEffect(() => {
    // Dynamic import to avoid SSR issues
    import("@monaco-editor/react").then((mod) => {
      setMonacoEditor(() => mod.default)
    })
  }, [])

  const handleEditorMount = useCallback((editor: unknown) => {
    // In production: bind Yjs document to this Monaco instance via y-monaco
    // import { MonacoBinding } from 'y-monaco'
    // const ydoc = getYjsDocument(projectId)
    // const ytext = ydoc.getText(file.path)
    // new MonacoBinding(ytext, editor.getModel(), new Set([editor]), awareness)
    void editor
  }, [])

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

  return (
    <div ref={containerRef} className="h-full w-full">
      <MonacoEditor
        height="100%"
        language={file.language === "typescript" ? "typescript" : file.language}
        value={file.content}
        theme="itecify-dark"
        options={{
          readOnly,
          fontSize: 13,
          fontFamily: "var(--font-jetbrains-mono), 'JetBrains Mono', monospace",
          fontLigatures: true,
          lineHeight: 20,
          padding: { top: 12, bottom: 12 },
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
        onMount={handleEditorMount}
      />
    </div>
  )
}
