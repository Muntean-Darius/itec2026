"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import type { FileNode } from "@/data/types"

interface CodeEditorProps {
  file: FileNode
  readOnly?: boolean
  /** Y.Text instance for this file (from collab hook) */
  yText?: unknown
  /** Yjs Awareness instance (from collab hook) */
  awareness?: unknown
  /** Fallback for when Yjs binding is not available */
  onContentChange?: (content: string) => void
}

export function CodeEditor({ file, readOnly = false, yText, awareness, onContentChange }: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [MonacoEditor, setMonacoEditor] = useState<typeof import("@monaco-editor/react").default | null>(null)
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const bindingRef = useRef<any>(null)
  const editorRef = useRef<any>(null)
  /* eslint-enable @typescript-eslint/no-explicit-any */

  useEffect(() => {
    // Dynamic import to avoid SSR issues
    import("@monaco-editor/react").then((mod) => {
      setMonacoEditor(() => mod.default)
    })
  }, [])

  // Cleanup binding on unmount
  useEffect(() => {
    return () => {
      bindingRef.current?.destroy()
      bindingRef.current = null
    }
  }, [])

  const handleEditorMount = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (editor: any) => {
      editorRef.current = editor

      // If we have a Y.Text, create a y-monaco binding for real-time CRDT sync
      if (yText && awareness) {
        import("y-monaco").then(({ MonacoBinding }) => {
          if (!editor.getModel()) return
          bindingRef.current = new MonacoBinding(
            yText as any, // Y.Text
            editor.getModel()!,
            new Set([editor]),
            awareness as any // Awareness
          )
        }).catch(() => {
          // Fallback: if y-monaco fails, use the value prop approach
          console.warn("[iTECify] y-monaco binding failed, using fallback")
        })
      }
    },
    [yText, awareness]
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
    <div ref={containerRef} className="h-full w-full">
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
        onChange={(value) => {
          // Only fire callback when NOT using y-monaco binding (fallback mode)
          if (!useBinding && value !== undefined && onContentChange) {
            onContentChange(value)
          }
        }}
        onMount={handleEditorMount}
      />
    </div>
  )
}
